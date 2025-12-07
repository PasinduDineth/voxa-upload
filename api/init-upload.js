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

  console.log('🔍 RAW REQUEST BODY:', JSON.stringify(req.body, null, 2));

  const { accessToken, videoFile } = req.body;

  console.log('📥 Parsed request data:', {
    hasAccessToken: !!accessToken,
    accessTokenLength: accessToken?.length,
    accessTokenPreview: accessToken ? `${accessToken.substring(0, 20)}...` : null,
    videoFile: videoFile,
    videoFileType: typeof videoFile,
    videoFileKeys: videoFile ? Object.keys(videoFile) : null
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
    
    console.log('📊 Video size validation:', {
      originalSize: videoFile.size,
      originalType: typeof videoFile.size,
      parsedSize: videoSize,
      parsedType: typeof videoSize,
      isValid: videoSize > 0
    });
    
    if (!videoSize || videoSize <= 0) {
      console.log('❌ Invalid video size:', videoSize);
      return res.status(400).json({ error: 'Invalid video size' });
    }
    
    // Build request EXACTLY matching official TikTok documentation
    // https://developers.tiktok.com/doc/content-posting-api-get-started/
    // For FILE_UPLOAD, they show: video_size, chunk_size, total_chunk_count
    const params = {
      post_info: {
        title: String(videoFile.title || 'Video Upload'),
        privacy_level: String(videoFile.privacyLevel || 'SELF_ONLY'),
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: Number(videoSize),
        chunk_size: Number(videoSize),  // Upload entire file as 1 chunk
        total_chunk_count: 1
      }
    };
    
    console.log('📦 Request params (matching TikTok docs):', JSON.stringify(params, null, 2));
    
    console.log('📦 Request params (matching TikTok docs):', JSON.stringify(params, null, 2));
    
    // Official TikTok docs example:
    // https://developers.tiktok.com/doc/content-posting-api-get-started/
    const url = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8'
    };
    
    console.log('🌐 Final request to TikTok API:', {
      url: url,
      method: 'POST',
      headers: headers,
      bodyJSON: JSON.stringify(params, null, 2)
    });

    const response = await axios.post(url, params, { headers });

    console.log('✅ TikTok API SUCCESS:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });
    
    res.status(200).json(response.data);
  } catch (error) {
    console.error('❌ TikTok API ERROR - Full details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      responseHeaders: error.response?.headers,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      requestHeaders: error.config?.headers,
      requestData: error.config?.data
    });
    
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
};
