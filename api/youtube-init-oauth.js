const { sql } = require('@vercel/postgres');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, workspace_id } = req.body;

  try {
    const state = 'youtube_' + crypto.randomBytes(32).toString('base64url');
    const code_verifier = crypto.randomBytes(32).toString('base64url');
    const code_challenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url');

    await sql`
      INSERT INTO youtube_oauth_states (
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
      DELETE FROM youtube_oauth_states
      WHERE created_at < NOW() - INTERVAL '10 minutes'
    `;

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

    if (!clientId) {
      return res.status(500).json({
        success: false,
        error: 'YouTube CLIENT_ID is not configured. Please set YOUTUBE_CLIENT_ID environment variable.'
      });
    }

    if (!redirectUri) {
      return res.status(500).json({
        success: false,
        error: 'YouTube REDIRECT_URI is not configured. Please set YOUTUBE_REDIRECT_URI environment variable.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        state,
        code_challenge,
        code_challenge_method: 'S256',
        code_verifier,
        client_id: clientId,
        redirect_uri: redirectUri
      }
    });

  } catch (error) {
    console.error('Error initializing YouTube OAuth:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
