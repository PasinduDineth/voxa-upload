const { sql } = require('@vercel/postgres');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, workspace_id } = req.body;

  try {
    const state = crypto.randomBytes(32).toString('base64url');
    const code_verifier = crypto.randomBytes(32).toString('base64url');
    const code_challenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url');

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

    await sql`
      DELETE FROM oauth_states
      WHERE created_at < NOW() - INTERVAL '10 minutes'
    `;

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    if (!clientKey) {
      return res.status(500).json({
        success: false,
        error: 'TikTok CLIENT_KEY is not configured. Please set TIKTOK_CLIENT_KEY environment variable.'
      });
    }

    if (!redirectUri) {
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
        code_verifier,
        client_key: clientKey,
        redirect_uri: redirectUri
      }
    });

  } catch (error) {
    console.error('Error initializing OAuth:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
