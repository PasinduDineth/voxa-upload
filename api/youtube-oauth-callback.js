const { sql } = require('@vercel/postgres');
const axios = require('axios').default || require('axios');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, code_verifier } = req.body;

  if (!code || !state || !code_verifier) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required parameters: code, state, or code_verifier' 
    });
  }

  try {
    const stateResult = await sql`
      SELECT code_verifier, user_id, workspace_id, created_at
      FROM youtube_oauth_states
      WHERE state = ${state}
      AND used = false
      AND created_at > NOW() - INTERVAL '10 minutes'
    `;

    if (stateResult.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired state. Please restart the authentication flow.' 
      });
    }

    const stateData = stateResult.rows[0];

    if (stateData.code_verifier !== code_verifier) {
      return res.status(400).json({ 
        success: false, 
        error: 'Code verifier mismatch. Possible CSRF attack.' 
      });
    }

    await sql`
      UPDATE youtube_oauth_states
      SET used = true, used_at = NOW()
      WHERE state = ${state}
    `;

    const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
    const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
    const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error: missing credentials' 
      });
    }

    const tokenParams = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code_verifier: code_verifier
    });

    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      tokenParams,
      {
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (!tokenResponse.data.access_token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to obtain access token from YouTube' 
      });
    }

    const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;
    
    // Calculate token expiration time
    const expires_at = new Date(Date.now() + (expires_in * 1000));

    let channelInfo = null;
    try {
      const channelResponse = await axios.get(
        'https://www.googleapis.com/youtube/v3/channels',
        {
          params: { 
            part: 'snippet,contentDetails',
            mine: true
          },
          headers: { 'Authorization': `Bearer ${access_token}` }
        }
      );
      
      if (channelResponse.data.items && channelResponse.data.items.length > 0) {
        const channel = channelResponse.data.items[0];
        channelInfo = {
          channel_id: channel.id,
          channel_title: channel.snippet.title,
          thumbnail_url: channel.snippet.thumbnails?.default?.url || null
        };
      }
    } catch (error) {
      console.error('Failed to fetch channel info:', error.response?.data || error.message);
    }

    if (!channelInfo) {
      return res.status(400).json({
        success: false,
        error: 'No YouTube channel found for this account'
      });
    }

    const existingChannel = await sql`
      SELECT open_id, display_name
      FROM accounts
      WHERE open_id = ${channelInfo.channel_id}
      AND type = 'YOUTUBE'
    `;

    if (existingChannel.rows.length > 0) {
      // Only update refresh_token if a new one is provided
      // YouTube doesn't always return a new refresh_token
      const updateQuery = refresh_token 
        ? sql`
            UPDATE accounts
            SET 
              access_token = ${access_token},
              refresh_token = ${refresh_token},
              display_name = ${channelInfo.channel_title},
              avatar_url = ${channelInfo.thumbnail_url},
              scope = ${scope || ''},
              expires_at = ${expires_at.toISOString()},
              updated_at = NOW()
            WHERE open_id = ${channelInfo.channel_id}
            AND type = 'YOUTUBE'
          `
        : sql`
            UPDATE accounts
            SET 
              access_token = ${access_token},
              display_name = ${channelInfo.channel_title},
              avatar_url = ${channelInfo.thumbnail_url},
              scope = ${scope || ''},
              expires_at = ${expires_at.toISOString()},
              updated_at = NOW()
            WHERE open_id = ${channelInfo.channel_id}
            AND type = 'YOUTUBE'
          `;

      await updateQuery;

      return res.status(200).json({
        success: true,
        data: {
          channel_id: channelInfo.channel_id,
          channel_title: channelInfo.channel_title,
          thumbnail_url: channelInfo.thumbnail_url,
          is_new: false,
          message: 'Channel re-authenticated successfully'
        }
      });
    }

    await sql`
      INSERT INTO accounts (
        open_id,
        access_token, 
        refresh_token, 
        display_name, 
        avatar_url, 
        scope,
        expires_at,
        type,
        user_id,
        workspace_id,
        created_at,
        updated_at
      )
      VALUES (
        ${channelInfo.channel_id},
        ${access_token},
        ${refresh_token || null},
        ${channelInfo.channel_title},
        ${channelInfo.thumbnail_url},
        ${scope || ''},
        ${expires_at.toISOString()},
        'YOUTUBE',
        ${stateData.user_id || null},
        ${stateData.workspace_id || null},
        NOW(),
        NOW()
      )
    `;

    return res.status(200).json({
      success: true,
      data: {
        channel_id: channelInfo.channel_id,
        channel_title: channelInfo.channel_title,
        thumbnail_url: channelInfo.thumbnail_url,
        is_new: true,
        message: 'Channel connected successfully'
      }
    });

  } catch (error) {
    console.error('Error during token exchange:', error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error_description || error.response?.data?.error || error.message
    });
  }
}
