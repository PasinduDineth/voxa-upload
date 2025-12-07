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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accessToken, videoFile } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token required' });
  }

  try {
    // TikTok requires chunk_size in bytes
    // According to TikTok docs: chunk_size should be between 5MB and 64MB
    // And must be aligned to 5MB boundaries for optimal performance
    const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_CHUNK_SIZE = 64 * 1024 * 1024; // 64MB
    
    let chunkSize = videoFile.size;
    
    // If file is larger than max chunk, use max chunk
    if (chunkSize > MAX_CHUNK_SIZE) {
      chunkSize = MAX_CHUNK_SIZE;
    }
    
    // If file is smaller than min chunk but not tiny, round up to min
    if (chunkSize < MIN_CHUNK_SIZE && chunkSize > 0) {
      chunkSize = MIN_CHUNK_SIZE;
    }
    
    // Calculate total chunks needed
    const totalChunks = Math.ceil(videoFile.size / chunkSize);
    
    console.log('Upload params:', {
      video_size: videoFile.size,
      chunk_size: chunkSize,
      total_chunk_count: totalChunks
    });
    
    const response = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        post_info: {
          title: videoFile.title || 'Uploaded via TikTok API',
          privacy_level: videoFile.privacyLevel || 'SELF_ONLY',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoFile.size,
          chunk_size: chunkSize,
          total_chunk_count: totalChunks
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        }
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
};
