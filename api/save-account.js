import { sql } from '@vercel/postgres';
import axios from 'axios';

const CLIENT_KEY = 'sbaw0lz3d1a0f32yv3';
const CLIENT_SECRET = 'd3UvL0TgwNkuDVfirIT4UuI2wnCrXUMY';

const REDIRECT_PATH = process.env.TIKTOK_REDIRECT_PATH || '/callback';

function resolveBaseUrl(req) {
  if (process.env.SITE_BASE_URL) {
    return process.env.SITE_BASE_URL.replace(/\/$/, '');
  }

  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  if (host) {
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  return 'http://localhost:3000';
}

export default async function handler(req, res) {
  // Only allow GET requests (OAuth callback)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state } = req.query;
  const baseUrl = resolveBaseUrl(req);
  const redirectUri = `${baseUrl}${REDIRECT_PATH}`;

  console.log('🔄 save-account invoked', { codePresent: !!code, statePresent: !!state });

  if (!code || !state) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h2 class="error">Authentication Failed</h2>
          <p>Missing authorization code or state parameter.</p>
          <button onclick="window.close()">Close Window</button>
        </body>
      </html>
    `);
  }

  try {
    const [csrfState, codeVerifierFromState] = state.split('::');
    if (!codeVerifierFromState) {
      throw new Error('Missing code verifier in callback state');
    }

    // Step 1: Exchange code for access token
    const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';

    // Get code_verifier from cookie or generate (in production, should be stored server-side)
    // Use the plain method with the original code challenge as the verifier
    const codeVerifier = codeVerifierFromState;

    const formData = new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    });

    const tokenResponse = await axios.post(tokenUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache'
      }
    });

    const tokenData = tokenResponse.data;
    
    if (!tokenData.access_token) {
      throw new Error('No access token received');
    }

    // Step 2: Fetch user info from TikTok
    const userInfoResponse = await axios.get(
      'https://open.tiktokapis.com/v2/user/info/',
      {
        params: { fields: 'open_id,union_id,avatar_url,display_name' },
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      }
    );

    const userInfo = userInfoResponse.data.data.user;

    // Step 3: Save to database
    await sql`
      INSERT INTO accounts (
        open_id, 
        access_token, 
        refresh_token, 
        display_name, 
        avatar_url, 
        scope, 
        expires_in,
        created_at
      )
      VALUES (
        ${userInfo.open_id},
        ${tokenData.access_token},
        ${tokenData.refresh_token || null},
        ${userInfo.display_name || 'TikTok User'},
        ${userInfo.avatar_url || null},
        ${tokenData.scope || ''},
        ${tokenData.expires_in || 0},
        NOW()
      )
      ON CONFLICT (open_id) 
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        scope = EXCLUDED.scope,
        expires_in = EXCLUDED.expires_in,
        created_at = NOW()
    `;

    // Step 4: Return success page that closes the popup
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Account Added</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              text-align: center;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .success-icon {
              font-size: 80px;
              margin-bottom: 20px;
              animation: scaleIn 0.5s ease-out;
            }
            h2 { margin: 0 0 10px 0; }
            p { margin: 10px 0; opacity: 0.9; }
            @keyframes scaleIn {
              from { transform: scale(0); }
              to { transform: scale(1); }
            }
          </style>
        </head>
        <body>
          <div class="success-icon">✅</div>
          <h2>Account Added Successfully!</h2>
          <p>${userInfo.display_name || 'TikTok User'}</p>
          <p style="font-size: 0.9em; margin-top: 20px;">This window will close automatically...</p>
          <script>
            // Close the popup window after 2 seconds
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Error saving account:', error);
    
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              text-align: center;
              background: #f44336;
              color: white;
            }
            .error-details {
              background: rgba(0,0,0,0.2);
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              font-family: monospace;
              font-size: 0.9em;
            }
            button {
              background: white;
              color: #f44336;
              border: none;
              padding: 12px 24px;
              border-radius: 6px;
              font-size: 16px;
              cursor: pointer;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <h2>❌ Failed to Add Account</h2>
          <div class="error-details">
            ${error.response?.data ? JSON.stringify(error.response.data) : error.message}
          </div>
          <button onclick="window.close()">Close Window</button>
        </body>
      </html>
    `);
  }
}
