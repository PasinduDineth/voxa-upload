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

  try {
    // TikTok chunk restrictions:
    // - Files < 5MB: upload as whole (chunk_size = video_size)
    // - Files 5MB-64MB: can upload as whole OR in chunks (5MB-64MB each)
    // - Files > 64MB: MUST split into chunks (5MB-64MB each, last chunk can be up to 128MB)
    // - Min chunks: 1, Max chunks: 1000
    const videoSize = videoFile.size;
    const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_CHUNK_SIZE = 64 * 1024 * 1024; // 64MB
    const STANDARD_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB - safe middle ground
    
    let chunkSize;
    let totalChunks;
    
    if (videoSize < MIN_CHUNK_SIZE) {
      // Very small files: must upload as whole
      chunkSize = videoSize;
      totalChunks = 1;
    } else if (videoSize <= MAX_CHUNK_SIZE) {
      // Medium files: can upload as whole
      chunkSize = videoSize;
      totalChunks = 1;
    } else {
      // Large files: split into chunks
      chunkSize = STANDARD_CHUNK_SIZE;
      // Calculate chunks: total_chunk_count = floor(video_size / chunk_size)
      totalChunks = Math.floor(videoSize / chunkSize);
      
      // Check if there's a remainder
      const remainder = videoSize % chunkSize;
      if (remainder > 0) {
        // If remainder exists, it will be merged with the last chunk
        // So we still count it as part of the chunks
        totalChunks = totalChunks > 0 ? totalChunks : 1;
      }
    }
    
    const requestPayload = {
      post_info: {
        title: videoFile.title || 'Uploaded via TikTok API',
        privacy_level: 'SELF_ONLY', // Force private for sandbox
        disable_duet: true,
        disable_comment: true,
        disable_stitch: true,
        video_cover_timestamp_ms: 1000
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunks
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
