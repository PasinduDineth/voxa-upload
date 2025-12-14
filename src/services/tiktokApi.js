import axios from 'axios';

class TikTokAPI {
  constructor() {
    this.accessToken = ""
    this.openId = ""
    this.accounts = [];
  }

  async getAuthUrl(forceLogin = false, disableAutoAuth = false) {
    try {
      const params = new URLSearchParams();
      if (forceLogin) {
        params.append('force_login', '1');
      }
      if (disableAutoAuth) {
        params.append('disable_auto_auth', '1');
      }

      const query = params.toString();
      const response = await axios.get(`/api/tiktok-authorize${query ? `?${query}` : ''}`);

      if (response.data?.state) {
        localStorage.setItem('csrf_state', response.data.state);
      }

      return response.data?.authUrl || null;
    } catch (error) {
      console.error('❌ Failed to build TikTok auth URL:', error.response?.data || error.message);
      return null;
    }
  }

  async getAccessToken(code, state) {
    try {
      const response = await axios.post('/api/tiktok-exchange', { code, state });

      if (response.data?.success && response.data?.account) {
        const account = response.data.account;

        console.log('✅ Authentication successful for open_id:', account.open_id);

        // Save to account list (don't set as active yet)
        await this.saveAccount({
          open_id: account.open_id,
          access_token: account.access_token,
          expires_in: account.expires_in,
          scope: account.scope,
          display_name: account.display_name,
          avatar_url: account.avatar_url || ''
        });

        // Set as active account only if this is the first account
        const allAccounts = await this.loadAccounts();
        if (allAccounts.length === 1) {
          this.accessToken = account.access_token;
          this.openId = account.open_id;
        }

        return { success: true, data: account };
      }

      return { success: false, error: response.data?.error || 'No access token received' };
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
