import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { open_id, access_token, refresh_token, display_name, avatar_url, scope } = req.body;

  if (!open_id || !access_token) {
    return res.status(400).json({ error: 'Missing required fields: open_id, access_token' });
  }

  try {
    // Save to database
    await sql`
      INSERT INTO accounts (
        open_id, 
        access_token, 
        refresh_token, 
        display_name, 
        avatar_url, 
        scope, 
        created_at
      )
      VALUES (
        ${open_id},
        ${access_token},
        ${refresh_token || null},
        ${display_name || 'TikTok User'},
        ${avatar_url || null},
        ${scope || ''},
        NOW()
      )
      ON CONFLICT (open_id) 
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        scope = EXCLUDED.scope,
        created_at = NOW()
    `;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving account to database:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
