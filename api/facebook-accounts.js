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

  // GET: Fetch all Facebook pages
  if (req.method === 'GET') {
    try {
      const result = await sql`
        SELECT 
          open_id,
          access_token,
          display_name,
          avatar_url,
          created_at
        FROM accounts
        WHERE type = 'FACEBOOK'
        ORDER BY created_at DESC
      `;

      return res.status(200).json({
        success: true,
        accounts: result.rows
      });
    } catch (error) {
      console.error('Error fetching Facebook pages:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        accounts: []
      });
    }
  }

  // POST: Add Facebook page with access token
  if (req.method === 'POST' && req.body.action === 'add_page') {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    try {
      // Fetch user's pages using the provided token
      const pagesResponse = await axios.get(
        'https://graph.facebook.com/v18.0/me/accounts',
        {
          params: {
            fields: 'id,name,access_token,picture',
            access_token: access_token
          }
        }
      );

      if (!pagesResponse.data.data || pagesResponse.data.data.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No Facebook pages found for this token. Make sure you have admin access to at least one page.'
        });
      }

      const pages = pagesResponse.data.data;
      const addedPages = [];

      // Add all pages to database
      for (const page of pages) {
        const existingPage = await sql`
          SELECT open_id FROM accounts
          WHERE open_id = ${page.id} AND type = 'FACEBOOK'
        `;

        if (existingPage.rows.length === 0) {
          await sql`
            INSERT INTO accounts (
              open_id,
              access_token,
              display_name,
              avatar_url,
              type,
              created_at
            ) VALUES (
              ${page.id},
              ${page.access_token},
              ${page.name},
              ${page.picture?.data?.url || null},
              'FACEBOOK',
              NOW()
            )
          `;
          addedPages.push(page.name);
        } else {
          // Update existing page token
          await sql`
            UPDATE accounts
            SET access_token = ${page.access_token},
                display_name = ${page.name},
                avatar_url = ${page.picture?.data?.url || null},
                created_at = NOW()
            WHERE open_id = ${page.id} AND type = 'FACEBOOK'
          `;
        }
      }

      return res.status(200).json({
        success: true,
        message: addedPages.length > 0
          ? `Added ${addedPages.length} page(s): ${addedPages.join(', ')}`
          : 'All pages were already connected. Tokens refreshed.',
        pages_count: pages.length
      });

    } catch (error) {
      console.error('Error adding Facebook pages:', error.response?.data || error);
      return res.status(500).json({
        success: false,
        error: error.response?.data?.error?.message || error.message
      });
    }
  }

  // DELETE: Remove a Facebook page
  if (req.method === 'DELETE') {
    const { page_id } = req.query;

    if (!page_id) {
      return res.status(400).json({ error: 'Missing page_id parameter' });
    }

    try {
      await sql`
        DELETE FROM accounts
        WHERE open_id = ${page_id}
        AND type = 'FACEBOOK'
      `;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting Facebook page:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
