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

  // POST: Upload video to Facebook Page
  if (req.method === 'POST' && req.body.action === 'upload_video') {
    const { page_id, video_data, video_name, video_type, title, description } = req.body;

    if (!page_id || !video_data) {
      return res.status(400).json({ 
        success: false,
        error: 'Page ID and video data are required' 
      });
    }

    try {
      // Get page access token from database
      const pageResult = await sql`
        SELECT access_token FROM accounts
        WHERE open_id = ${page_id} AND type = 'FACEBOOK'
      `;

      if (pageResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Page not found'
        });
      }

      const pageAccessToken = pageResult.rows[0].access_token;

      // Convert base64 to buffer
      const base64Data = video_data.split(',')[1] || video_data;
      const videoBuffer = Buffer.from(base64Data, 'base64');

      // Create form data
      const FormData = require('form-data');
      const form = new FormData();
      form.append('source', videoBuffer, {
        filename: video_name || 'video.mp4',
        contentType: video_type || 'video/mp4'
      });
      form.append('description', `${title}\n\n${description || ''}`);
      form.append('access_token', pageAccessToken);

      // Upload to Facebook
      const uploadResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${page_id}/videos`,
        form,
        {
          headers: {
            ...form.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      return res.status(200).json({
        success: true,
        data: {
          video_id: uploadResponse.data.id,
          post_id: uploadResponse.data.id
        }
      });

    } catch (error) {
      console.error('Facebook upload error:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: error.response?.data?.error?.message || error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
