import axios from 'axios';
import { sql } from '@vercel/postgres';

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || process.env.NEXT_PUBLIC_TIKTOK_REDIRECT_URI || process.env.REACT_APP_REDIRECT_URI;

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [key, ...val] = part.trim().split('=');
    if (key) {
      acc[key] = decodeURIComponent(val.join('='));
    }
    return acc;
  }, {});
}

function decodeCookiePayload(raw) {
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to decode OAuth cookie:', error);
    return null;
  }
}

function clearOAuthCookie(res) {
  const parts = ['tiktok_oauth=','HttpOnly','Path=/','SameSite=Lax','Max-Age=0'];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!CLIENT_KEY || !CLIENT_SECRET || !REDIRECT_URI) {
    return res.status(500).json({ success: false, error: 'Missing TikTok OAuth configuration' });
  }

  const { code, state } = req.body || {};

  if (!code || !state) {
    return res.status(400).json({ success: false, error: 'Missing code or state' });
  }

  const cookies = parseCookies(req);
  const rawCookie = cookies['tiktok_oauth'];

  if (!rawCookie) {
    return res.status(400).json({ success: false, error: 'OAuth session not found' });
  }

  const payload = decodeCookiePayload(rawCookie);

  if (!payload || payload.state !== state) {
    return res.status(400).json({ success: false, error: 'Invalid OAuth state' });
  }

  try {
    const params = new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code_verifier: payload.codeVerifier
    });

    const tokenResponse = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token: accessToken, refresh_token: refreshToken, open_id: openId, scope, expires_in: expiresIn } = tokenResponse.data;

    console.log('TikTok token exchange success for open_id:', openId);

    if (!openId) {
      clearOAuthCookie(res);
      return res.status(500).json({ success: false, error: 'TikTok did not return an open_id' });
    }

    const userInfoResponse = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
      params: { fields: 'open_id,avatar_url,display_name' },
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const user = userInfoResponse.data?.data?.user || {};

    const existing = await sql`SELECT open_id FROM accounts WHERE open_id = ${openId}`;

    if (existing.rows.length > 0) {
      console.log('Existing TikTok account found, refreshing tokens for open_id:', openId);
    }

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
        ${openId},
        ${accessToken},
        ${refreshToken || null},
        ${user.display_name || 'TikTok User'},
        ${user.avatar_url || null},
        ${scope || ''},
        NOW()
      )
      ON CONFLICT (open_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        scope = EXCLUDED.scope,
        created_at = NOW()
    `;

    clearOAuthCookie(res);

    return res.status(200).json({
      success: true,
      account: {
        open_id: openId,
        access_token: accessToken,
        refresh_token: refreshToken || null,
        display_name: user.display_name || 'TikTok User',
        avatar_url: user.avatar_url || null,
        scope,
        expires_in: expiresIn
      }
    });
  } catch (error) {
    const errorMessage = error.response?.data || error.message;
    console.error('TikTok token exchange failed:', errorMessage);
    clearOAuthCookie(res);
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
