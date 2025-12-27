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

  // Handle multipart upload_chunk FIRST (before JSON parsing)
  if (req.method === 'POST' && req.headers['content-type']?.includes('multipart/form-data')) {
    const formidable = require('formidable');
    const form = new formidable.IncomingForm({ maxFileSize: 5 * 1024 * 1024 });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Formidable parse error:', err);
        return res.status(400).json({ success: false, error: err.message });
      }

      const { page_id, upload_session_id, start_offset, access_token } = fields;
      const videoChunk = files.video_chunk;

      if (!page_id || !upload_session_id || !start_offset || !access_token || !videoChunk) {
        return res.status(400).json({ 
          success: false,
          error: 'Missing required parameters' 
        });
      }

      try {
        const fs = require('fs');
        const FormData = require('form-data');
        const fbForm = new FormData();
        
        fbForm.append('upload_phase', 'transfer');
        fbForm.append('upload_session_id', upload_session_id[0]);
        fbForm.append('start_offset', start_offset[0]);
        fbForm.append('video_file_chunk', fs.createReadStream(videoChunk[0].filepath));
        fbForm.append('access_token', access_token[0]);

        const uploadResponse = await axios.post(
          `https://graph.facebook.com/v18.0/${page_id[0]}/videos`,
          fbForm,
          {
            headers: fbForm.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          }
        );

        return res.status(200).json({
          success: true,
          data: {
            start_offset: uploadResponse.data.start_offset,
            end_offset: uploadResponse.data.end_offset
          }
        });

      } catch (error) {
        console.error('Facebook chunk upload error:', error.response?.data || error.message);
        return res.status(500).json({
          success: false,
          error: error.response?.data?.error?.message || error.message
        });
      }
    });
    return;
  }

  // Initialize body for non-multipart requests
  if (!req.body) {
    req.body = {};
  }

  // Parse body for JSON requests
  if (req.method === 'POST' && req.headers['content-type']?.includes('application/json')) {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString();
      req.body = JSON.parse(body);
    } catch (error) {
      console.error('JSON parse error:', error.message);
      return res.status(400).json({ success: false, error: 'Invalid JSON body' });
    }
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
      return res.status(400).json({ success: false, error: 'Access token is required' });
    }

    try {
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
      console.error('Error adding Facebook page:', error.response?.data || error.message);
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

  // POST: Initialize resumable upload for Facebook
  if (req.method === 'POST' && req.body.action === 'init_upload') {
    const { page_id, file_size } = req.body;

    if (!page_id || !file_size) {
      return res.status(400).json({ 
        success: false,
        error: 'Page ID and file size are required' 
      });
    }

    try {
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

      const initResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${page_id}/videos`,
        {
          upload_phase: 'start',
          file_size: file_size,
          access_token: pageAccessToken
        }
      );

      return res.status(200).json({
        success: true,
        data: {
          upload_session_id: initResponse.data.upload_session_id,
          video_id: initResponse.data.video_id,
          start_offset: initResponse.data.start_offset || 0,
          end_offset: initResponse.data.end_offset || file_size,
          access_token: pageAccessToken
        }
      });

    } catch (error) {
      console.error('Facebook init upload error:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: error.response?.data?.error?.message || error.message
      });
    }
  }

  // POST: Finalize Facebook upload
  if (req.method === 'POST' && req.body.action === 'finalize_upload') {
    const { page_id, upload_session_id, title, description } = req.body;

    if (!page_id || !upload_session_id) {
      return res.status(400).json({ 
        success: false,
        error: 'Page ID and upload session ID are required' 
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

      // Finalize upload
      const finalizeResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${page_id}/videos`,
        {
          upload_phase: 'finish',
          upload_session_id: upload_session_id,
          description: `${title}\n\n${description || ''}`,
          access_token: pageAccessToken
        }
      );

      return res.status(200).json({
        success: true,
        data: {
          success: finalizeResponse.data.success,
          video_id: finalizeResponse.data.video_id
        }
      });

    } catch (error) {
      console.error('Facebook finalize error:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: error.response?.data?.error?.message || error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

// Disable body parser for multipart upload
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
