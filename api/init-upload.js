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
    
    // Build request EXACTLY like PHP SDK does
    // PHP: $post->publish(['post_info' => [...], 'source_info' => [...]])
    const params = {
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
    
    console.log('📦 Request params object:', JSON.stringify(params, null, 2));
    
    // PHP SDK sends:
    // - URL: https://open.tiktokapis.com/v2/post/publish/video/init/?access_token=XXX
    // - Method: POST
    // - Body: application/x-www-form-urlencoded (http_build_query of params)
    // - Headers: Authorization: Bearer XXX
    
    // Create URL-encoded form data EXACTLY like PHP's http_build_query
    const formData = new URLSearchParams();
    formData.append('post_info[title]', params.post_info.title);
    formData.append('post_info[privacy_level]', params.post_info.privacy_level);
    formData.append('post_info[disable_duet]', params.post_info.disable_duet);
    formData.append('post_info[disable_comment]', params.post_info.disable_comment);
    formData.append('post_info[disable_stitch]', params.post_info.disable_stitch);
    formData.append('source_info[source]', params.source_info.source);
    formData.append('source_info[video_size]', params.source_info.video_size);
    
    const formDataString = formData.toString();
    
    console.log('📝 Form-encoded body (like PHP):', formDataString);
    
    const url = `https://open.tiktokapis.com/v2/post/publish/video/init/?access_token=${accessToken}`;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    
    console.log('🌐 Request details:', {
      url: url.substring(0, 80) + '...',
      method: 'POST',
      headers: headers,
      bodyLength: formDataString.length,
      bodyPreview: formDataString.substring(0, 200)
    });

    const response = await axios.post(url, formDataString, { headers });

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
