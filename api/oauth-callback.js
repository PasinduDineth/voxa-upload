const { sql } = require('@vercel/postgres');
const axios = require('axios').default || require('axios');

// Server-side OAuth callback handler
// Handles token exchange with PKCE validation and state verification
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, code_verifier } = req.body;

  console.log('[OAuth Callback] Starting token exchange', {
    has_code: !!code,
    has_state: !!state,
    has_verifier: !!code_verifier,
    timestamp: new Date().toISOString()
  });

  // Validate required parameters
  if (!code || !state || !code_verifier) {
    console.error('[OAuth Callback] Missing required parameters', { code: !!code, state: !!state, code_verifier: !!code_verifier });
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required parameters: code, state, or code_verifier' 
    });
  }

  try {
    // Step 1: Validate state and get stored code_verifier from database
    console.log('[OAuth Callback] Validating state:', state);
    
    const stateResult = await sql`
      SELECT code_verifier, user_id, workspace_id, created_at
      FROM oauth_states
      WHERE state = ${state}
      AND used = false
      AND created_at > NOW() - INTERVAL '10 minutes'
    `;

    if (stateResult.rows.length === 0) {
      console.error('[OAuth Callback] Invalid or expired state:', state);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired state. Please restart the authentication flow.' 
      });
    }

    const stateData = stateResult.rows[0];
    console.log('[OAuth Callback] State validated successfully', {
      user_id: stateData.user_id,
      workspace_id: stateData.workspace_id,
      state_age_seconds: Math.floor((Date.now() - new Date(stateData.created_at).getTime()) / 1000)
    });

    // Verify code_verifier matches
    if (stateData.code_verifier !== code_verifier) {
      console.error('[OAuth Callback] Code verifier mismatch');
      return res.status(400).json({ 
        success: false, 
        error: 'Code verifier mismatch. Possible CSRF attack.' 
      });
    }

    // Mark state as used to prevent replay attacks
    await sql`
      UPDATE oauth_states
      SET used = true, used_at = NOW()
      WHERE state = ${state}
    `;

    // Step 2: Exchange authorization code for access token (SERVER-SIDE ONLY)
    const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
    const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
    const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;

    if (!CLIENT_KEY || !CLIENT_SECRET || !REDIRECT_URI) {
      console.error('[OAuth Callback] Missing environment variables');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error: missing credentials' 
      });
    }

    console.log('[OAuth Callback] Exchanging code for token with TikTok API');

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
      console.error('[OAuth Callback] No access token in response', tokenResponse.data);
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to obtain access token from TikTok' 
      });
    }

    const { access_token, refresh_token, open_id, expires_in, scope } = tokenResponse.data;

    console.log('[OAuth Callback] Token obtained successfully', {
      open_id,
      has_access_token: !!access_token,
      has_refresh_token: !!refresh_token,
      expires_in,
      scope
    });

    // Step 3: Fetch user info
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
      console.log('[OAuth Callback] User info fetched', {
        display_name: userInfo.display_name,
        open_id: userInfo.open_id
      });
    } catch (error) {
      console.error('[OAuth Callback] Failed to fetch user info:', error.response?.data || error.message);
      // Continue even if user info fetch fails
    }

    // Step 4: Check if this open_id is already linked to prevent duplicate linking
    const existingAccount = await sql`
      SELECT open_id, display_name
      FROM accounts
      WHERE open_id = ${open_id}
    `;

    if (existingAccount.rows.length > 0) {
      console.log('[OAuth Callback] Account already exists, updating tokens', { open_id });
      
      // Update existing account with new tokens
      await sql`
        UPDATE accounts
        SET 
          access_token = ${access_token},
          refresh_token = ${refresh_token || null},
          display_name = ${userInfo?.display_name || existingAccount.rows[0].display_name},
          avatar_url = ${userInfo?.avatar_url || null},
          scope = ${scope || ''},
          created_at = NOW()
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

    // Step 5: Save new account to database
    console.log('[OAuth Callback] Creating new account', { open_id });
    
    await sql`
      INSERT INTO accounts (
        open_id, 
        access_token, 
        refresh_token, 
        display_name, 
        avatar_url, 
        scope, 
        user_id,
        workspace_id,
        created_at
      )
      VALUES (
        ${open_id},
        ${access_token},
        ${refresh_token || null},
        ${userInfo?.display_name || 'TikTok User'},
        ${userInfo?.avatar_url || null},
        ${scope || ''},
        ${stateData.user_id || null},
        ${stateData.workspace_id || null},
        NOW()
      )
    `;

    console.log('[OAuth Callback] Account created successfully', {
      open_id,
      display_name: userInfo?.display_name || 'TikTok User'
    });

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
    console.error('[OAuth Callback] Error during token exchange:', {
      error: error.message,
      response: error.response?.data,
      stack: error.stack
    });

    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error_description || error.response?.data?.message || error.message
    });
  }
}
