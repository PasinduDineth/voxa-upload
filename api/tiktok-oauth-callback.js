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
      FROM oauth_states
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
      UPDATE oauth_states
      SET used = true, used_at = NOW()
      WHERE state = ${state}
    `;

    const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
    const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;

    if (!CLIENT_KEY || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error: missing credentials' 
      });
    }

    const tokenParams = new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code_verifier: code_verifier
    });

    const tokenResponse = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      tokenParams,
      {
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        }
      }
    );

    if (!tokenResponse.data.access_token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to obtain access token from TikTok' 
      });
    }

    const { access_token, refresh_token, open_id, expires_in, scope } = tokenResponse.data;
    
    // Calculate token expiration time
    const expires_at = new Date(Date.now() + (expires_in * 1000));

    let userInfo = null;
    try {
      const userInfoResponse = await axios.get(
        'https://open.tiktokapis.com/v2/user/info/',
        {
          params: { fields: 'open_id,union_id,avatar_url,display_name' },
          headers: { 'Authorization': `Bearer ${access_token}` }
        }
      );
      userInfo = userInfoResponse.data.data.user;
    } catch (error) {
      console.error('Failed to fetch user info:', error.response?.data || error.message);
    }

    const existingAccount = await sql`
      SELECT open_id, display_name
      FROM accounts
      WHERE open_id = ${open_id}
    `;

    if (existingAccount.rows.length > 0) {
      await sql`
        UPDATE accounts
        SET 
          access_token = ${access_token},
          refresh_token = ${refresh_token || null},
          display_name = ${userInfo?.display_name || existingAccount.rows[0].display_name},
          avatar_url = ${userInfo?.avatar_url || null},
          scope = ${scope || ''},
          expires_at = ${expires_at.toISOString()},
          type = 'TIKTOK',
          updated_at = NOW()
        WHERE open_id = ${open_id}
      `;

      return res.status(200).json({
        success: true,
        data: {
          open_id,
          display_name: userInfo?.display_name || existingAccount.rows[0].display_name,
          avatar_url: userInfo?.avatar_url,
          is_new: false,
          message: 'Account re-authenticated successfully'
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
        ${open_id},
        ${access_token},
        ${refresh_token || null},
        ${userInfo?.display_name || 'TikTok User'},
        ${userInfo?.avatar_url || null},
        ${scope || ''},
        ${expires_at.toISOString()},
        'TIKTOK',
        ${stateData.user_id || null},
        ${stateData.workspace_id || null},
        NOW(),
        NOW()
      )
    `;

    return res.status(200).json({
      success: true,
      data: {
        open_id,
        display_name: userInfo?.display_name || 'TikTok User',
        avatar_url: userInfo?.avatar_url,
        is_new: true,
        message: 'Account connected successfully'
      }
    });

  } catch (error) {
    console.error('Error during token exchange:', error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error_description || error.response?.data?.message || error.message
    });
  }
}
