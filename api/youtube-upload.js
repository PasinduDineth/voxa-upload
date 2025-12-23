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
      grant_channelId = fields.channelId?.[0] || fields.channelId;
      const title = fields.title?.[0] || fields.title;
      const description = fields.description?.[0] || fields.description || '';
      const privacyStatus = fields.privacyStatus?.[0] || fields.privacyStatus || 'private';
      const videoFile = files.video?.[0] || files.video;

      if (!accessToken || !title || !videoFile || !channelId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      let currentAccessToken = accessToken; headers: { 
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
      const title = fields.title?.[0] || fields.title;
      const description = fields.description?.[0] || fields.description || '';
      const privacyStatus = fields.privacyStatus?.[0] || fields.privacyStatus || 'private';
      const videoFile = files.video?.[0] || files.video;

      if (!accessToken || !title || !videoFile) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

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
        } catch (initError) {
          // If we get 401/403, try refreshing the token
          if (initError.response?.status === 401 || initError.response?.status === 403) {
            console.log('Access token expired, refreshing...');
            currentAccessToken = await refreshAccessToken(channelId);
            
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
          } else {
            throw initError;
          }
        }    'X-Upload-Content-Length': fileSize
            }
          }
        );

        const uploadUrl = initResponse.headers.location;

        if (!uploadUrl) {
          throw new Error('Failed to get upload URL from YouTube');
        }

        // Step 2: Upload the video file to the upload URL
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

        fs.unlinkSync(videoFile.filepath);

        return res.status(200).json({
          success: true,
          data: uploadResponse.data
        });

      } catch (uploadError) {
        console.error('Upload error:', uploadError.response?.data || uploadError.message);
        if (videoFile?.filepath && fs.existsSync(videoFile.filepath)) {
          fs.unlinkSync(videoFile.filepath);
        }
        return res.status(uploadError.response?.status || 500).json({
          error: uploadError.response?.data || uploadError.message
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
