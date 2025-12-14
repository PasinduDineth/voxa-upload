const crypto = require('crypto');

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || process.env.NEXT_PUBLIC_TIKTOK_REDIRECT_URI || process.env.REACT_APP_REDIRECT_URI;

function base64UrlEncode(buffer) {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!CLIENT_KEY || !REDIRECT_URI) {
    return res.status(500).json({ success: false, error: 'Missing TikTok OAuth configuration' });
  }

  try {
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = base64UrlEncode(crypto.randomBytes(64));
    const codeChallenge = base64UrlEncode(
      crypto.createHash('sha256').update(codeVerifier).digest()
    );
    const forceLogin = req.query.force_login === '1';
    const disableAutoAuth = req.query.disable_auto_auth === '1';

    const scope = 'user.info.basic,video.upload,video.publish';
    const params = new URLSearchParams({
      client_key: CLIENT_KEY,
      scope,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    if (forceLogin) {
      params.append('force_login', '1');
      params.append('force_verify', '1');
    }

    if (disableAutoAuth) {
      params.append('disable_auto_auth', '1');
    }

    console.log('Building TikTok auth URL', {
      forceLogin,
      disableAutoAuth,
      state
    });

    const cookieValue = base64UrlEncode(Buffer.from(JSON.stringify({ state, codeVerifier })));
    const cookieParts = [
      `tiktok_oauth=${cookieValue}`,
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
      'Max-Age=600'
    ];

    if (process.env.NODE_ENV === 'production') {
      cookieParts.push('Secure');
    }

    res.setHeader('Set-Cookie', cookieParts.join('; '));

    return res.status(200).json({
      success: true,
      authUrl: `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`,
      state
    });
  } catch (error) {
    console.error('Error building TikTok auth URL:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
