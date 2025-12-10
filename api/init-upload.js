const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accessToken, videoFile } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token required' });
  }

  if (!videoFile || videoFile.size == null) {
    return res.status(400).json({ error: 'Video file and size required' });
  }

  try {
    const videoSize = Number(videoFile.size);

    if (!Number.isFinite(videoSize) || videoSize <= 0) {
      return res.status(400).json({ error: 'Invalid video size' });
    }

    // TikTok chunk calculation: total_chunk_count = floor(video_size / chunk_size)
    const CHUNK_SIZE = 10_000_000; // 10 MB
    const totalChunkCount = Math.floor(videoSize / CHUNK_SIZE);

    const requestPayload = {
      post_info: {
        title: videoFile.title || 'Sandbox test video #fyp',
        privacy_level: videoFile.privacyLevel || 'SELF_ONLY',
        disable_duet: false,
        disable_comment: true,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: CHUNK_SIZE,
        total_chunk_count: totalChunkCount
      }
    };

    const response = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      requestPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        }
      }
    );

    console.log('✅ Upload initialized:', response.data.data.publish_id);
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('❌ Init upload error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
};
