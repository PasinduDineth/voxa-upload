const { sql } = require('@vercel/postgres');
const axios = require('axios');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch all accounts
  if (req.method === 'GET') {
    try {
      const result = await sql`
        SELECT 
          open_id,
          access_token,
          display_name,
          avatar_url,
          scope,
          created_at
        FROM accounts
        WHERE type = 'TIKTOK'
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

  // DELETE: Remove an account
  if (req.method === 'DELETE') {
    const { open_id } = req.query;

    if (!open_id) {
      return res.status(400).json({ error: 'Missing open_id parameter' });
    }

    try {
      await sql`
        DELETE FROM accounts
        WHERE open_id = ${open_id}
        AND type = 'TIKTOK'
      `;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting account:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST: Check upload status
  if (req.method === 'POST') {
    const { accessToken, publishId } = req.body;

    if (!accessToken || !publishId) {
      return res.status(400).json({ error: 'Access token and publish ID required' });
    }

    try {
      const response = await axios.post(
        'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
        { publish_id: publishId },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
          }
        }
      );

      return res.status(200).json(response.data);
    } catch (error) {
      console.error('Status check error:', error.response?.data || error.message);
      return res.status(error.response?.status || 500).json({
        error: error.response?.data || error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
