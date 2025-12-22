const { sql } = require('@vercel/postgres');
const crypto = require('crypto');

// Initialize OAuth flow by generating and storing state + code_verifier
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, workspace_id } = req.body;

  console.log('[Init OAuth] Starting OAuth initialization', {
    user_id: user_id || 'anonymous',
    workspace_id: workspace_id || 'default',
    timestamp: new Date().toISOString()
  });

  try {
    // Generate cryptographically secure random state
    const state = crypto.randomBytes(32).toString('base64url');
    
    // Generate code_verifier for PKCE (43-128 characters)
    const code_verifier = crypto.randomBytes(32).toString('base64url');
    
    // Generate code_challenge using S256 method
    const code_challenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url');

    console.log('[Init OAuth] Generated PKCE parameters', {
      state,
      code_verifier_length: code_verifier.length,
      code_challenge_length: code_challenge.length,
      method: 'S256'
    });

    // Store state and code_verifier in database (expires in 10 minutes)
    await sql`
      INSERT INTO oauth_states (
        state,
        code_verifier,
        code_challenge,
        user_id,
        workspace_id,
        created_at,
        used
      )
      VALUES (
        ${state},
        ${code_verifier},
        ${code_challenge},
        ${user_id || null},
        ${workspace_id || null},
        NOW(),
        false
      )
    `;

    // Clean up expired states (older than 10 minutes)
    await sql`
      DELETE FROM oauth_states
      WHERE created_at < NOW() - INTERVAL '10 minutes'
    `;

    console.log('[Init OAuth] OAuth state stored successfully');

    // Get CLIENT_KEY and REDIRECT_URI from server environment variables
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    if (!clientKey) {
      console.error('[Init OAuth] TIKTOK_CLIENT_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'TikTok CLIENT_KEY is not configured. Please set TIKTOK_CLIENT_KEY environment variable.'
      });
    }

    if (!redirectUri) {
      console.error('[Init OAuth] TIKTOK_REDIRECT_URI not configured');
      return res.status(500).json({
        success: false,
        error: 'TikTok REDIRECT_URI is not configured. Please set TIKTOK_REDIRECT_URI environment variable.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        state,
        code_challenge,
        code_challenge_method: 'S256',
        code_verifier, // Send to client to be stored temporarily
        client_key: clientKey, // Safe to send (it's meant to be public)
        redirect_uri: redirectUri
      }
    });

  } catch (error) {
    console.error('[Init OAuth] Error initializing OAuth:', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
