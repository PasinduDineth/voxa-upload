import axios from 'axios';

const CLIENT_KEY = 'sbaw0lz3d1a0f32yv3';
const CLIENT_SECRET = 'd3UvL0TgwNkuDVfirIT4UuI2wnCrXUMY';
const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI || 'https://www.pasindu.website/callback';

class TikTokAPI {
  constructor() {
    this.accessToken = localStorage.getItem('tiktok_access_token');
    this.openId = localStorage.getItem('tiktok_open_id');
    this.accounts = this.loadAccounts();
  }

  generateCodeChallenge() {
    const codeVerifier = this.generateRandomString(43);
    localStorage.setItem('code_verifier', codeVerifier);
    return codeVerifier; // Using "plain" method
  }

  generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }

    return result;
  }

  getAuthUrl() {
    const csrfState = Math.random().toString(36).substring(2);
    localStorage.setItem('csrf_state', csrfState);

    const codeChallenge = this.generateCodeChallenge();
    const scope = 'user.info.basic,video.upload,video.publish';

    return `https://www.tiktok.com/v2/auth/authorize?client_key=${CLIENT_KEY}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${csrfState}&code_challenge=${codeChallenge}&code_challenge_method=plain`;
  }

  async getAccessToken(code) {
    try {
      const codeVerifier = localStorage.getItem('code_verifier');

      const params = new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier
      });

      const response = await axios.post(
        'https://open.tiktokapis.com/v2/oauth/token/',
        params,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        this.openId = response.data.open_id;

        localStorage.setItem('tiktok_access_token', this.accessToken);
        localStorage.setItem('tiktok_open_id', this.openId);

        console.log('✅ Authentication successful');

        // Save/Update account list
        this.saveAccount({
          open_id: this.openId,
          access_token: this.accessToken,
          expires_in: response.data.expires_in,
          scope: response.data.scope
        });
        return { success: true, data: response.data };
      }

      return { success: false, error: 'No access token received' };
    } catch (error) {
      console.error('❌ Authentication failed:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Multi-account storage helpers
  loadAccounts() {
    try {
      const raw = localStorage.getItem('tiktok_accounts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveAccounts(accounts) {
    this.accounts = accounts;
    localStorage.setItem('tiktok_accounts', JSON.stringify(accounts));
  }

  saveAccount(account) {
    const accounts = this.loadAccounts();
    const idx = accounts.findIndex(a => a.open_id === account.open_id);
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], ...account };
    } else {
      accounts.push(account);
    }
    this.saveAccounts(accounts);
  }

  getAccounts() {
    return this.accounts;
  }

  // Switch the active account without breaking existing flow
  useAccount(openId) {
    const account = this.accounts.find(a => a.open_id === openId);
    if (!account) return false;
    this.openId = account.open_id;
    this.accessToken = account.access_token;
    localStorage.setItem('tiktok_open_id', this.openId);
    localStorage.setItem('tiktok_access_token', this.accessToken);
    return true;
  }

  async initializeUpload(videoFile, videoTitle, privacyLevel) {
    if (!this.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await axios.post('/api/init-upload', {
        accessToken: this.accessToken,
        videoFile: {
          size: videoFile.size,
          title: videoTitle,
          privacyLevel: privacyLevel
        }
      });

      console.log('✅ Upload initialized:', response.data.data.publish_id);
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('❌ Init upload failed:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async uploadVideo(uploadUrl, videoFile) {
    try {
      const CHUNK_SIZE = 10_000_000; // 10 MB - must match backend
      const totalSize = videoFile.size;
      const totalChunkCount = Math.floor(totalSize / CHUNK_SIZE) || 1;

      console.log(`📤 Uploading ${totalChunkCount} chunk(s) (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

      for (let chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++) {
        const isLastChunk = chunkIndex === totalChunkCount - 1;
        const start = chunkIndex * CHUNK_SIZE;
        const end = isLastChunk ? totalSize : start + CHUNK_SIZE;
        const chunk = videoFile.slice(start, end);
        const chunkSize = end - start;

        console.log(`📦 Chunk ${chunkIndex + 1}/${totalChunkCount} (${(chunkSize / 1024 / 1024).toFixed(2)} MB)`);

        const response = await axios.put(uploadUrl, chunk, {
          headers: {
            'Content-Type': videoFile.type || 'video/mp4',
            'Content-Length': chunkSize,
            'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });

        if (isLastChunk) {
          if (response.status !== 201) {
            throw new Error(`Expected 201 on last chunk, got ${response.status}`);
          }
          console.log('✅ All chunks uploaded successfully');
          return { success: true, data: response.data };
        } else if (response.status !== 206) {
          throw new Error(`Expected 206 for chunk ${chunkIndex + 1}, got ${response.status}`);
        }
      }

      throw new Error('Upload loop ended unexpectedly');
    } catch (error) {
      console.error('❌ Upload failed:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async publishVideo(publishId) {
    if (!this.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await axios.post('/api/check-status', {
        accessToken: this.accessToken,
        publishId: publishId
      });

      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('❌ Status check failed:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  logout() {
    this.accessToken = null;
    this.openId = null;
    localStorage.removeItem('tiktok_access_token');
    localStorage.removeItem('tiktok_open_id');
  }
}

export default new TikTokAPI();
