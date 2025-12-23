const axios = require('axios');
const formidable = require('formidable');
const fs = require('fs');

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

        const fileSize = videoFile.size;

        // Step 1: Initialize resumable upload and get upload URL
        const initResponse = await axios.post(
          'https://www.googleapis.com/upload/youtube/v3/videos',
          JSON.stringify(videoData),
          {
            params: {
              part: 'snippet,status',
              uploadType: 'resumable'
            },
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Upload-Content-Type': videoFile.mimetype || 'video/*',
              'X-Upload-Content-Length': fileSize
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
