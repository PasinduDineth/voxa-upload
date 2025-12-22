const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await sql`
      SELECT 
        open_id as channel_id,
        access_token,
        display_name as channel_title,
        avatar_url as thumbnail_url,
        scope,
        created_at
      FROM accounts
      WHERE type = 'YOUTUBE'
      ORDER BY created_at DESC
    `;

    return res.status(200).json({
      success: true,
      channels: result.rows
    });
  } catch (error) {
    console.error('Error fetching YouTube channels:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      channels: []
    });
  }
}
