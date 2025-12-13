import axios from 'axios';

const CLIENT_KEY = 'sbaw0lz3d1a0f32yv3';
const CLIENT_SECRET = 'd3UvL0TgwNkuDVfirIT4UuI2wnCrXUMY';
const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI || 'https://www.pasindu.website/callback';

class TikTokAPI {
  constructor() {
    this.accessToken = ""
    this.openId = ""
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

  getAuthUrl(forceLogin = false) {
    const csrfState = Math.random().toString(36).substring(2);
    localStorage.setItem('csrf_state', csrfState);

    const codeChallenge = this.generateCodeChallenge();
    const scope = 'user.info.basic,video.upload,video.publish';

    const baseUrl = `https://www.tiktok.com/v2/auth/authorize?client_key=${CLIENT_KEY}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${csrfState}&code_challenge=${codeChallenge}&code_challenge_method=plain`;

    // Add force_verify=1 to prompt login screen even if user is already logged in
    return forceLogin ? `${baseUrl}&force_verify=1` : baseUrl;
  }

  async getUserInfo(accessToken) {
    try {
      const response = await axios.get(
        'https://open.tiktokapis.com/v2/user/info/',
        {
          params: { fields: 'open_id,union_id,avatar_url,display_name' },
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      return response.data.data.user;
    } catch (error) {
      console.error('❌ Failed to fetch user info:====', error.response?.data || error.message);
      return null;
    }
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
        const accessToken = response.data.access_token;
        const openId = response.data.open_id;

        console.log('✅ Authentication successful');

        // Fetch user info to display username and avatar
        const userInfo = await this.getUserInfo(accessToken);

        // Save to account list (don't set as active yet)
        await this.saveAccount({
          open_id: openId,
          access_token: accessToken,
          expires_in: response.data.expires_in,
          scope: response.data.scope,
          display_name: userInfo?.display_name || 'TikTok User',
          avatar_url: userInfo?.avatar_url || ''
        });

        // Set as active account only if this is the first account
        const allAccounts = await this.loadAccounts();
        if (allAccounts.length === 1) {
          this.accessToken = accessToken;
          this.openId = openId;
          // localStorage.setItem('tiktok_access_token', accessToken);
          // localStorage.setItem('tiktok_open_id', openId);
        }

        return { success: true, data: response.data };
      }

      return { success: false, error: 'No access token received' };
    } catch (error) {
      console.error('❌ Authentication failed:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Fetch accounts from database
  async loadAccounts() {
    try {
      const response = await axios.get('/api/get-accounts');
      if (response.data.success) {
        this.accounts = response.data.accounts;
        return this.accounts;
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to load accounts from DB:', error);
      return [];
    }
  }

  async saveAccountToDB(account) {
    try {
      await axios.post('/api/save-account-to-db', {
        open_id: account.open_id,
        access_token: account.access_token,
        refresh_token: null,
        display_name: account.display_name,
        avatar_url: account.avatar_url,
        scope: account.scope
      });
      console.log('✅ Account saved to database');
      return true;
    } catch (error) {
      console.error('❌ Failed to save to database:', error);
      return false;
    }
  }

  async saveAccount(account) {
    await this.saveAccountToDB(account);
    // Reload accounts from database
    await this.loadAccounts();
  }

  getAccounts() {
    return this.accounts;
  }

  async removeAccount(openId) {
    try {
      // Call API to delete from database
      await axios.delete(`/api/delete-account?open_id=${openId}`);
      
      // Reload accounts from database
      await this.loadAccounts();
      
      // If removing active account, clear it
      // if (this.openId === openId) {
      //   this.openId = null;
      //   this.accessToken = null;
      //   localStorage.removeItem('tiktok_open_id');
      //   localStorage.removeItem('tiktok_access_token');
      // }
    } catch (error) {
      console.error('❌ Failed to remove account:', error);
    }
  }

  // Switch the active account without breaking existing flow
  useAccount(openId) {
    const account = this.accounts.find(a => a.open_id === openId);
    if (!account) return false;
    this.openId = account.open_id;
    this.accessToken = account.access_token;
    localStorage.setItem('tiktok_open_id', this.openId);
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
    // this.accessToken = null;
    // this.openId = null;
    // localStorage.removeItem('tiktok_access_token');
    // localStorage.removeItem('tiktok_open_id');
  }
}

export default new TikTokAPI();
