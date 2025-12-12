import axios from 'axios';

const CLIENT_KEY = 'sbaw0lz3d1a0f32yv3';
const CLIENT_SECRET = 'd3UvL0TgwNkuDVfirIT4UuI2wnCrXUMY';
const runtimeBaseUrl = process.env.REACT_APP_SITE_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
const baseUrl = (runtimeBaseUrl || 'http://localhost:3000').replace(/\/$/, '');
const REDIRECT_PATH = process.env.REACT_APP_TIKTOK_REDIRECT_PATH || '/callback';
const REDIRECT_URI = `${baseUrl}${REDIRECT_PATH}`;

class TikTokAPI {
  constructor() {
    this.accessToken = localStorage.getItem('tiktok_access_token');
    this.openId = localStorage.getItem('tiktok_open_id');
    this.accounts = [];
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

  openAuthPopup() {
    const csrfState = Math.random().toString(36).substring(2);
    localStorage.setItem('csrf_state', csrfState);

    const codeChallenge = this.generateCodeChallenge();
    const state = `${csrfState}::${codeChallenge}`;
    const scope = 'user.info.basic,video.upload,video.publish';

    const authUrl = `https://www.tiktok.com/v2/auth/authorize?client_key=${CLIENT_KEY}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${encodeURIComponent(state)}&code_challenge=${codeChallenge}&code_challenge_method=plain`;

    // Open OAuth in popup window (provides fresh TikTok session)
    const popup = window.open(
      authUrl,
      'TikTok OAuth',
      'width=600,height=800,left=200,top=100'
    );

    return popup;
  }

  // OAuth is now handled by popup window -> api/save-account.js
  // Frontend only needs to poll for new accounts

  // Fetch accounts from database via API
  async loadAccounts() {
    try {
      const response = await axios.get('/api/get-accounts');
      if (response.data.success) {
        this.accounts = response.data.accounts;
        return this.accounts;
      }
      return [];
    } catch (error) {
      console.error('Error loading accounts:', error);
      return [];
    }
  }

  getAccounts() {
    return this.accounts;
  }

  async removeAccount(openId) {
    // For now, just filter locally - in production, add DELETE /api/accounts/:id endpoint
    this.accounts = this.accounts.filter(a => a.open_id !== openId);
    
    // If removing active account, clear it
    if (this.openId === openId) {
      this.openId = null;
      this.accessToken = null;
      localStorage.removeItem('tiktok_open_id');
      localStorage.removeItem('tiktok_access_token');
    }
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
