const axios = require('axios');
const formidable = require('formidable');
const fs = require('fs');
const { sql } = require('@vercel/postgres');

async function refreshAccessToken(channelId) {
  try {
    const result = await sql`
      SELECT refresh_token, open_id
      FROM accounts
      WHERE open_id = ${channelId}
      AND type = 'YOUTUBE'
      AND refresh_token IS NOT NULL
    `;

    if (result.rows.length === 0) {
      throw new Error('No refresh token found for this channel');
    }

    const { refresh_token } = result.rows[0];

    const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
    const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;

    const tokenParams = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refresh_token,
      grant_type: 'refresh_token'
    });

    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      tokenParams,
      {
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token } = tokenResponse.data;

    await sql`
      UPDATE accounts
      SET access_token = ${access_token}
      WHERE open_id = ${channelId}
      AND type = 'YOUTUBE'
    `;

    return access_token;
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({ multiples: false });
    
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Form parse error:', err);
        return res.status(400).json({ error: 'Failed to parse form data' });
      }

      const accessToken = fields.accessToken?.[0] || fields.accessToken;
      const channelId = fields.channelId?.[0] || fields.channelId;
      const title = fields.title?.[0] || fields.title;
      const description = fields.description?.[0] || fields.description || '';
      const privacyStatus = fields.privacyStatus?.[0] || fields.privacyStatus || 'private';
      const videoFile = files.video?.[0] || files.video;

      console.log('=== YouTube Upload Request ===');
      console.log('Channel ID:', channelId);
      console.log('Title:', title);
      console.log('Access Token (first 20 chars):', accessToken?.substring(0, 20) + '...');
      console.log('Video file:', videoFile?.originalFilename, 'Size:', videoFile?.size);

      if (!accessToken || !title || !videoFile || !channelId) {
        console.error('Missing required fields:', { accessToken: !!accessToken, title: !!title, videoFile: !!videoFile, channelId: !!channelId });
        return res.status(400).json({ error: 'Missing required fields' });
      }

      let currentAccessToken = accessToken;

      try {
        const videoData = {
          snippet: {
            title: title,
            description: description,
            categoryId: '22'
          },
          status: {
            privacyStatus: privacyStatus
          }
        };

        const fileSize = videoFile.size;

        // Step 1: Initialize resumable upload and get upload URL
        console.log('Step 1: Initializing resumable upload...');
        let initResponse;
        try {
          initResponse = await axios.post(
            'https://www.googleapis.com/upload/youtube/v3/videos',
            JSON.stringify(videoData),
            {
              params: {
                part: 'snippet,status',
                uploadType: 'resumable'
              },
              headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': videoFile.mimetype || 'video/*',
                'X-Upload-Content-Length': fileSize
              }
            }
          );
          console.log('Step 1 successful, upload URL received');
        } catch (initError) {
          console.error('Step 1 failed:', initError.response?.status, initError.response?.data);
          // If we get 401/403, try refreshing the token
          if (initError.response?.status === 401 || initError.response?.status === 403) {
            console.log('Access token expired (401/403), attempting token refresh...');
            try {
              currentAccessToken = await refreshAccessToken(channelId);
              console.log('Token refreshed successfully, retrying upload initialization...');
              
              // Retry with new token
              initResponse = await axios.post(
                'https://www.googleapis.com/upload/youtube/v3/videos',
                JSON.stringify(videoData),
                {
                  params: {
                    part: 'snippet,status',
                    uploadType: 'resumable'
                  },
                  headers: {
                    'Authorization': `Bearer ${currentAccessToken}`,
                    'Content-Type': 'application/json',
                    'X-Upload-Content-Type': videoFile.mimetype || 'video/*',
                    'X-Upload-Content-Length': fileSize
                  }
                }
              );
              console.log('Retry Step 1 successful after token refresh');
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError.message);
              throw initError; // Throw original error if refresh fails
            }
          } else {
            throw initError;
          }
        }

        const uploadUrl = initResponse.headers.location;

        console.log('Upload URL received:', uploadUrl ? 'Yes' : 'No');

        if (!uploadUrl) {
          console.error('No upload URL in response headers');
          throw new Error('Failed to get upload URL from YouTube');
        }

        // Step 2: Upload the video file to the upload URL
        console.log('Step 2: Uploading video file to YouTube...');
        const fileStream = fs.createReadStream(videoFile.filepath);

        const uploadResponse = await axios.put(
          uploadUrl,
          fileStream,
          {
            headers: {
              'Content-Type': videoFile.mimetype || 'video/*',
              'Content-Length': fileSize
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          }
        );

        console.log('Step 2 successful, video uploaded!');
        console.log('Video ID:', uploadResponse.data?.id);

        fs.unlinkSync(videoFile.filepath);

        return res.status(200).json({
          success: true,
          data: uploadResponse.data
        });

      } catch (uploadError) {
        console.error('=== Upload Error ===');
        console.error('Status:', uploadError.response?.status);
        console.error('Status Text:', uploadError.response?.statusText);
        console.error('Error Data:', JSON.stringify(uploadError.response?.data, null, 2));
        console.error('Error Message:', uploadError.message);
        if (videoFile?.filepath && fs.existsSync(videoFile.filepath)) {
          fs.unlinkSync(videoFile.filepath);
        }
        
        // Return detailed error information
        const errorDetails = {
          message: uploadError.message,
          status: uploadError.response?.status,
          statusText: uploadError.response?.statusText,
          data: uploadError.response?.data,
          step: uploadError.config?.url?.includes('googleapis.com/upload/youtube') ? 'Step 1: Init Upload' : 'Step 2: File Upload',
          url: uploadError.config?.url
        };
        
        return res.status(uploadError.response?.status || 500).json({
          error: 'Upload failed',
          details: errorDetails
        });
      }
    });

  } catch (error) {
    console.error('YouTube upload error:', error.message);
    return res.status(500).json({
      error: error.message
    });
  }
};
