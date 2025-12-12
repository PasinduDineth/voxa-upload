import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all accounts from database
    const result = await sql`
      SELECT 
        open_id,
        access_token,
        display_name,
        avatar_url,
        scope,
        created_at
      FROM accounts
      ORDER BY created_at DESC
    `;

    return res.status(200).json({
      success: true,
      accounts: result.rows
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      accounts: []
    });
  }
}
