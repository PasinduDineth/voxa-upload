const { sql } = require('@vercel/postgres');
const axios = require('axios').default || require('axios');
const FormData = require('form-data');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channel_id, video_data, video_size, video_type } = req.body;

  if (!channel_id || !video_data || !video_size) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required parameters' 
    });
  }

  try {
    // Get the access token for this channel from accounts table
    const channelResult = await sql`
      SELECT access_token, refresh_token, expires_at, display_name
      FROM accounts
      WHERE open_id = ${channel_id}
      AND type = 'YOUTUBE'
    `;

    console.log('Channel lookup for:', channel_id, 'found:', channelResult.rows.length, 'rows');

    if (channelResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Channel not found. Please re-authenticate your YouTube channel.',
        channel_id: channel_id
      });
    }

    let { access_token, refresh_token, expires_at, display_name } = channelResult.rows[0];
    
    console.log('Channel:', display_name, 'Token expires:', expires_at, 'Has refresh token:', !!refresh_token);

    console.log('Channel:', display_name, 'Token expires:', expires_at, 'Has refresh token:', !!refresh_token);

    // Check if token is expired or will expire soon (within 5 minutes)
    const expiryDate = expires_at ? new Date(expires_at) : null;
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    const needsRefresh = !expiryDate || expiryDate <= fiveMinutesFromNow;
    
    if (needsRefresh) {
      console.log('Token needs refresh. Expired:', !expiryDate || expiryDate <= new Date(), 'Expires soon:', expiryDate && expiryDate <= fiveMinutesFromNow);
      
      // Check if refresh token exists
      if (!refresh_token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Access token expired and no refresh token available. Please re-authenticate your YouTube channel.',
          requires_reauth: true
        });
      }

      // Refresh the token
      const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
      const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;

      try {
        console.log('Refreshing token...');
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: refresh_token,
          grant_type: 'refresh_token'
        });

        access_token = tokenResponse.data.access_token;
        const expires_in = tokenResponse.data.expires_in;
        const new_expires_at = new Date(Date.now() + expires_in * 1000);

        console.log('Token refreshed successfully. New expiry:', new_expires_at);

        // Update the token in database
        await sql`
          UPDATE accounts
          SET access_token = ${access_token},
              expires_at = ${new_expires_at.toISOString()},
              updated_at = CURRENT_TIMESTAMP
          WHERE open_id = ${channel_id}
          AND type = 'YOUTUBE'
        `;
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError.response?.data || refreshError.message);
        return res.status(401).json({ 
          success: false, 
          error: 'Failed to refresh access token. Please re-authenticate your YouTube channel.',
          requires_reauth: true,
          details: refreshError.response?.data
        });
      }
    } else {
      console.log('Token is still valid until:', expiryDate);
    }

    // Step 1: Initialize resumable upload
    const initResponse = await axios.post(
      'https://www.googleapis.com/upload/youtube/v3/videos',
      JSON.stringify(video_data),
      {
        params: {
          part: 'snippet,status',
          uploadType: 'resumable'
        },
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': video_type || 'video/*',
          'X-Upload-Content-Length': video_size
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      }
    );

    const uploadUrl = initResponse.headers.location || initResponse.headers['location'];

    if (!uploadUrl) {
      console.error('No upload URL in response headers:', initResponse.headers);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to get upload URL from YouTube',
        details: 'No location header in response'
      });
    }

    // Return the upload URL to the client so they can upload the file directly
    return res.status(200).json({ 
      success: true, 
      data: { upload_url: uploadUrl }
    });

  } catch (error) {
    console.error('YouTube upload initialization failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
    return res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message,
      details: error.response?.data
    });
  }
};
