const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { open_id, access_token, refresh_token, display_name, avatar_url, scope, user_id, workspace_id } = req.body;

  if (!open_id || !access_token) {
    return res.status(400).json({ error: 'Missing required fields: open_id, access_token' });
  }

  try {
    console.log('[Save Account] Saving account to database', { open_id, display_name });
    
    // Save to database
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
        ${display_name || 'TikTok User'},
        ${avatar_url || null},
        ${scope || ''},
        ${user_id || null},
        ${workspace_id || null},
        NOW()
      )
      ON CONFLICT (open_id) 
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        scope = EXCLUDED.scope,
        user_id = EXCLUDED.user_id,
        workspace_id = EXCLUDED.workspace_id,
        created_at = NOW()
    `;

    console.log('[Save Account] Account saved successfully', { open_id });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Save Account] Error saving account to database:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
