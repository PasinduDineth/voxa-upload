const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Missing accessToken' });
    }

    console.log('Testing token:', accessToken.substring(0, 20) + '...');

    // Test 1: Get channel info
    const channelResponse = await axios.get(
      'https://www.googleapis.com/youtube/v3/channels',
      {
        params: { 
          part: 'snippet,contentDetails',
          mine: true
        },
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    console.log('Channel info retrieved successfully');

    // Test 2: Check upload permissions
    const testInitResponse = await axios.post(
      'https://www.googleapis.com/upload/youtube/v3/videos',
      JSON.stringify({
        snippet: {
          title: 'Test',
          description: 'Test',
          categoryId: '22'
        },
        status: {
          privacyStatus: 'private'
        }
      }),
      {
        params: {
          part: 'snippet,status',
          uploadType: 'resumable'
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': 1000
        }
      }
    );

    console.log('Upload initialization test successful');
    console.log('Upload URL received:', !!testInitResponse.headers.location);

    return res.status(200).json({
      success: true,
      message: 'Token is valid and has upload permissions',
      channelId: channelResponse.data.items[0]?.id,
      channelTitle: channelResponse.data.items[0]?.snippet?.title,
      uploadUrlReceived: !!testInitResponse.headers.location,
      scopes: 'Valid for reading channel info and initiating uploads'
    });

  } catch (error) {
    console.error('Token test failed:', error.response?.status, error.response?.data);
    
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
      details: 'Token validation or upload permission test failed'
    });
  }
};
