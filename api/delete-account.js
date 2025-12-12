import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Only allow DELETE requests
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { open_id } = req.query;

  if (!open_id) {
    return res.status(400).json({ error: 'Missing open_id parameter' });
  }

  try {
    // Delete account from database
    await sql`
      DELETE FROM accounts
      WHERE open_id = ${open_id}
    `;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
