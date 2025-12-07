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
    
    // Calculate chunks according to TikTok Media Transfer Guide:
    // - Videos >64MB MUST use chunks
    // - Each chunk: 5MB min, 64MB max (final chunk can be up to 128MB)
    // - total_chunk_count = floor(video_size / chunk_size)
    const CHUNK_SIZE = 64 * 1024 * 1024; // 64MB in bytes
    const chunkSize = Math.min(CHUNK_SIZE, videoSize);
    const totalChunkCount = Math.max(1, Math.ceil(videoSize / CHUNK_SIZE));
    
    console.log('📦 Chunk calculation:', {
      chunkSize,
      totalChunkCount,
      isChunked: totalChunkCount > 1
    });
    
    // Build request exactly like TikTok docs
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
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount
      }
    };
    
    console.log('📤 Request payload:', JSON.stringify(requestPayload, null, 2));
    
    // TikTok API expects JSON body with access_token as query param (PHP SDK does this)
    const response = await axios.post(
      `https://open.tiktokapis.com/v2/post/publish/video/init/`,
      requestPayload,
      {
        params: {
          access_token: accessToken
        },
        headers: {
          'Content-Type': 'application/json'
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
