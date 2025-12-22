const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channel_id } = req.query;

  if (!channel_id) {
    return res.status(400).json({ error: 'Missing channel_id parameter' });
  }

  try {
    await sql`
      DELETE FROM accounts
      WHERE open_id = ${channel_id}
      AND type = 'YOUTUBE'
    `;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting YouTube channel:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
