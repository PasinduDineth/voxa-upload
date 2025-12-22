import axios from 'axios';

class TikTokAPI {
  constructor() {
    this.accessToken = localStorage.getItem('tiktok_access_token');
    this.openId = localStorage.getItem('tiktok_open_id');
    this.accounts = [];
  }

  async getAuthUrl(forceLogin = false) {
    try {
      const response = await axios.post('/api/init-oauth', {
        user_id: localStorage.getItem('user_id') || null,
        workspace_id: localStorage.getItem('workspace_id') || null
      });

      if (!response.data.success) {
        throw new Error('Failed to initialize OAuth: ' + response.data.error);
      }

      const { state, code_challenge, code_challenge_method, code_verifier, client_key, redirect_uri } = response.data.data;

      if (!client_key) {
        throw new Error('CLIENT_KEY not received from server. Please check server configuration.');
      }

      if (!redirect_uri) {
        throw new Error('REDIRECT_URI not received from server. Please check server configuration.');
      }

      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('oauth_code_verifier', code_verifier);

      const scope = 'user.info.basic,video.upload,video.publish';

      const params = new URLSearchParams({
        client_key: client_key,
        scope: scope,
        response_type: 'code',
        redirect_uri: redirect_uri,
        state: state,
        code_challenge: code_challenge,
        code_challenge_method: code_challenge_method
      });

      if (forceLogin) {
        params.append('disable_auto_auth', '1');
        sessionStorage.setItem('oauth_adding_account', 'true');
      } else {
        sessionStorage.removeItem('oauth_adding_account');
      }

      return `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;
    } catch (error) {
      console.error('Failed to initialize OAuth:', error.message);
      throw error;
    }
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
      console.error('Failed to fetch user info:', error.response?.data || error.message);
      return null;
    }
  }

  async getAccessToken(code, state) {
    try {
      const storedState = sessionStorage.getItem('oauth_state');
      const codeVerifier = sessionStorage.getItem('oauth_code_verifier');

      if (!storedState || storedState !== state) {
        return { 
          success: false, 
          error: 'State mismatch. Please restart the authentication flow.' 
        };
      }

      if (!codeVerifier) {
        return { 
          success: false, 
          error: 'Missing code verifier. Please restart the authentication flow.' 
        };
      }

      const response = await axios.post('/api/oauth-callback', {
        code,
        state,
        code_verifier: codeVerifier
      });

      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_code_verifier');

      if (response.data.success) {
        const { open_id, display_name, avatar_url, is_new } = response.data.data;
        await this.loadAccounts();

        const allAccounts = this.getAccounts();
        if (allAccounts.length === 1 || is_new) {
          await this.useAccount(open_id);
        }

        return { 
          success: true, 
          data: { 
            open_id, 
            display_name, 
            avatar_url,
            is_new,
            message: is_new ? 'New account connected' : 'Account re-authenticated'
          } 
        };
      }

      return { success: false, error: response.data.error || 'Unknown error' };

    } catch (error) {
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_code_verifier');

      return { 
        success: false, 
        error: error.response?.data?.error || error.message 
      };
    }
  }

  async loadAccounts() {
    try {
      const response = await axios.get('/api/get-accounts');
      if (response.data.success) {
        this.accounts = response.data.accounts;
        return this.accounts;
      }
      return [];
    } catch (error) {
      console.error('Failed to load accounts from DB:', error);
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
      return true;
    } catch (error) {
      console.error('Failed to save to database:', error);
      return false;
    }
  }

  async saveAccount(account) {
    await this.saveAccountToDB(account);
    await this.loadAccounts();
  }

  getAccounts() {
    return this.accounts;
  }

  async removeAccount(openId) {
    try {
      await axios.delete(`/api/delete-account?open_id=${openId}`);
      await this.loadAccounts();
      
      if (this.openId === openId) {
        this.openId = null;
        this.accessToken = null;
        localStorage.removeItem('tiktok_open_id');
        localStorage.removeItem('tiktok_access_token');
      }
    } catch (error) {
      console.error('Failed to remove account:', error);
    }
  }

  async useAccount(openId) {
    const account = this.accounts.find(a => a.open_id === openId);
    if (!account) {
      return false;
    }
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

      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('Init upload failed:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async uploadVideo(uploadUrl, videoFile) {
    try {
      const CHUNK_SIZE = 10_000_000;
      const totalSize = videoFile.size;
      const totalChunkCount = Math.floor(totalSize / CHUNK_SIZE) || 1;

      for (let chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++) {
        const isLastChunk = chunkIndex === totalChunkCount - 1;
        const start = chunkIndex * CHUNK_SIZE;
        const end = isLastChunk ? totalSize : start + CHUNK_SIZE;
        const chunk = videoFile.slice(start, end);
        const chunkSize = end - start;

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
          return { success: true, data: response.data };
        } else if (response.status !== 206) {
          throw new Error(`Expected 206 for chunk ${chunkIndex + 1}, got ${response.status}`);
        }
      }

      throw new Error('Upload loop ended unexpectedly');
    } catch (error) {
      console.error('Upload failed:', error.response?.data || error.message);
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
      console.error('Status check failed:', error.response?.data || error.message);
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
