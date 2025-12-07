const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accessToken, videoFile } = req.body;

  console.log('📥 Init upload request:', {
    hasAccessToken: !!accessToken,
    videoFileSize: videoFile?.size,
    videoTitle: videoFile?.title,
    privacyLevel: videoFile?.privacyLevel
  });

  if (!accessToken) {
    console.log('❌ Missing access token');
    return res.status(400).json({ error: 'Access token required' });
  }

  if (!videoFile || !videoFile.size) {
    console.log('❌ Missing video file or size:', videoFile);
    return res.status(400).json({ error: 'Video file and size required' });
  }

  try {
    const videoSize = parseInt(videoFile.size, 10);
    
    console.log('📊 Video size:', videoSize, 'Type:', typeof videoSize);
    
    if (!videoSize || videoSize <= 0) {
      console.log('❌ Invalid video size:', videoSize);
      return res.status(400).json({ error: 'Invalid video size' });
    }
    
    const requestPayload = {
      post_info: {
        title: videoFile.title || 'Video Upload',
        privacy_level: videoFile.privacyLevel || 'SELF_ONLY',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize
      }
    };
    
    console.log('📤 Sending to TikTok API:', JSON.stringify(requestPayload, null, 2));
    
    const response = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      requestPayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        }
      }
    );

    console.log('✅ TikTok API response:', JSON.stringify(response.data, null, 2));
    res.status(200).json(response.data);
  } catch (error) {
    console.error('❌ TikTok API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
};
