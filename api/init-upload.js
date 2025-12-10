// /api/init-upload.js
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

  if (!videoFile || videoFile.size == null) {
    console.log('❌ Missing video file or size:', videoFile);
    return res.status(400).json({ error: 'Video file and size required' });
  }

  try {
    const videoSize = Number(videoFile.size);

    console.log('📊 Video size:', videoSize, 'Type:', typeof videoSize);

    if (!Number.isFinite(videoSize) || videoSize <= 0) {
      console.log('❌ Invalid video size:', videoSize);
      return res.status(400).json({ error: 'Invalid video size' });
    }

    // TikTok Media Transfer: total_chunk_count = floor(video_size / chunk_size)
    const CHUNK_SIZE = 10_000_000; // 10 MB
    const chunkSize = CHUNK_SIZE;
    const totalChunkCount = Math.floor(videoSize / CHUNK_SIZE);

    console.log('📦 Chunk calculation:', {
      videoSize,
      chunkSize,
      totalChunkCount,
      calculation: `${videoSize} / ${CHUNK_SIZE} = ${videoSize / CHUNK_SIZE} → floor = ${totalChunkCount}`
    });

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
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount
      }
    };

    console.log('📤 Request payload to TikTok init:', JSON.stringify(requestPayload, null, 2));

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

    console.log('✅ TikTok init response:', JSON.stringify(response.data, null, 2));

    // Keep response shape the same as before
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('❌ TikTok API Error (init-upload):', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });

    return res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
};
