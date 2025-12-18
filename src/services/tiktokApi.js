import axios from 'axios';

// CLIENT_KEY is safe to expose in frontend (it's meant to be public)
// CLIENT_SECRET must NEVER be in frontend code - it's server-side only
const CLIENT_KEY = process.env.REACT_APP_TIKTOK_CLIENT_KEY || 'sbaw0lz3d1a0f32yv3';
const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI || 'https://www.pasindu.website/callback';

class TikTokAPI {
  constructor() {
    this.accessToken = localStorage.getItem('tiktok_access_token');
    this.openId = localStorage.getItem('tiktok_open_id');
    this.accounts = [];
  }

  /**
   * Initialize OAuth flow with proper PKCE S256
   * Calls server to generate state and code_challenge
   * @param {boolean} forceLogin - Whether to force TikTok to show login screen
   * @returns {Promise<string>} Authorization URL
   */
  async getAuthUrl(forceLogin = false) {
    console.log('[OAuth] Initializing OAuth flow', { 
      forceLogin,
      CLIENT_KEY_defined: !!CLIENT_KEY,
      CLIENT_KEY_value: CLIENT_KEY,
      REDIRECT_URI_defined: !!REDIRECT_URI,
      REDIRECT_URI_value: REDIRECT_URI,
      env_REACT_APP_TIKTOK_CLIENT_KEY: process.env.REACT_APP_TIKTOK_CLIENT_KEY,
      env_REACT_APP_REDIRECT_URI: process.env.REACT_APP_REDIRECT_URI
    });

    try {
      // Call server to generate state, code_verifier, and code_challenge
      console.log('[OAuth] Calling /api/init-oauth endpoint');
      const response = await axios.post('/api/init-oauth', {
        user_id: localStorage.getItem('user_id') || null,
        workspace_id: localStorage.getItem('workspace_id') || null
      });

      console.log('[OAuth] Received response from init-oauth', {
        success: response.data.success,
        has_data: !!response.data.data
      });

      if (!response.data.success) {
        console.error('[OAuth] Init OAuth failed', response.data);
        throw new Error('Failed to initialize OAuth: ' + response.data.error);
      }

      const { state, code_challenge, code_challenge_method, code_verifier } = response.data.data;

      console.log('[OAuth] Extracted OAuth parameters', {
        state_length: state?.length,
        code_challenge_length: code_challenge?.length,
        code_challenge_method,
        code_verifier_length: code_verifier?.length
      });

      // Store code_verifier and state in sessionStorage (more secure than localStorage)
      // These are temporary and should be cleared after OAuth completes
      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('oauth_code_verifier', code_verifier);

      console.log('[OAuth] Stored in sessionStorage', {
        stored_state: sessionStorage.getItem('oauth_state')?.substring(0, 10) + '...',
        stored_verifier: sessionStorage.getItem('oauth_code_verifier')?.substring(0, 10) + '...'
      });

      const scope = 'user.info.basic,video.upload,video.publish';

      // Ensure CLIENT_KEY is defined
      if (!CLIENT_KEY) {
        throw new Error('CLIENT_KEY is not defined. Check REACT_APP_TIKTOK_CLIENT_KEY environment variable.');
      }

      console.log('[OAuth] Building authorize URL with', {
        CLIENT_KEY,
        REDIRECT_URI,
        state_length: state.length,
        code_challenge_length: code_challenge.length
      });

      // Build authorization URL with proper parameters
      const params = new URLSearchParams({
        client_key: CLIENT_KEY,
        scope: scope,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        state: state,
        code_challenge: code_challenge,
        code_challenge_method: code_challenge_method
      });

      // Add disable_auto_auth=1 when adding another account
      // This prevents TikTok from auto-logging in with existing session
      if (forceLogin) {
        params.append('disable_auto_auth', '1');
        console.log('[OAuth] Force login enabled - disable_auto_auth=1 added');
      }

      const authUrl = `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;
      
      console.log('[OAuth] Authorization URL generated', {
        has_disable_auto_auth: forceLogin,
        url_length: authUrl.length,
        full_url: authUrl
      });

      return authUrl;
    } catch (error) {
      console.error('[OAuth] Failed to initialize OAuth:', {
        error_message: error.message,
        error_stack: error.stack,
        error_response: error.response?.data
      });
      throw error;
    }
  }

  async getUserInfo(accessToken) {
    try {
      console.log('[TikTok API] Fetching user info');
      const response = await axios.get(
        'https://open.tiktokapis.com/v2/user/info/',
        {
          params: { fields: 'open_id,union_id,avatar_url,display_name' },
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      console.log('[TikTok API] User info fetched successfully', {
        display_name: response.data.data.user.display_name,
        open_id: response.data.data.user.open_id
      });
      return response.data.data.user;
    } catch (error) {
      console.error('[TikTok API] Failed to fetch user info:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Exchange authorization code for access token
   * This now happens SERVER-SIDE ONLY for security
   * @param {string} code - Authorization code from TikTok callback
   * @param {string} state - State parameter from TikTok callback
   * @returns {Promise<Object>} Result with success status and data
   */
  async getAccessToken(code, state) {
    console.log('[OAuth] Starting token exchange', { has_code: !!code, has_state: !!state });

    try {
      // Retrieve code_verifier and stored state from sessionStorage
      const storedState = sessionStorage.getItem('oauth_state');
      const codeVerifier = sessionStorage.getItem('oauth_code_verifier');

      console.log('[OAuth] Retrieved session data', {
        has_stored_state: !!storedState,
        has_code_verifier: !!codeVerifier,
        states_match: storedState === state
      });

      // Validate state to prevent CSRF attacks
      if (!storedState || storedState !== state) {
        console.error('[OAuth] State mismatch - possible CSRF attack', {
          received_state: state,
          stored_state: storedState
        });
        return { 
          success: false, 
          error: 'State mismatch. Please restart the authentication flow.' 
        };
      }

      if (!codeVerifier) {
        console.error('[OAuth] Missing code verifier');
        return { 
          success: false, 
          error: 'Missing code verifier. Please restart the authentication flow.' 
        };
      }

      // Call server-side endpoint to exchange code for token
      // This keeps CLIENT_SECRET secure on the server
      console.log('[OAuth] Calling server-side token exchange');
      const response = await axios.post('/api/oauth-callback', {
        code,
        state,
        code_verifier: codeVerifier
      });

      // Clear session storage after successful exchange
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_code_verifier');

      if (response.data.success) {
        const { open_id, display_name, avatar_url, is_new } = response.data.data;

        console.log('[OAuth] Token exchange successful', {
          open_id,
          display_name,
          is_new_account: is_new
        });

        // Reload accounts from database
        await this.loadAccounts();

        // Set as active account only if this is the first account
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
      console.error('[OAuth] Token exchange failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      // Clear session storage on error
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_code_verifier');

      return { 
        success: false, 
        error: error.response?.data?.error || error.message 
      };
    }
  }

  // Fetch accounts from database
  async loadAccounts() {
    try {
      console.log('[TikTok API] Loading accounts from database');
      const response = await axios.get('/api/get-accounts');
      if (response.data.success) {
        this.accounts = response.data.accounts;
        console.log('[TikTok API] Loaded accounts', {
          count: this.accounts.length,
          open_ids: this.accounts.map(a => a.open_id)
        });
        return this.accounts;
      }
      return [];
    } catch (error) {
      console.error('[TikTok API] Failed to load accounts from DB:', error);
      return [];
    }
  }

  async saveAccountToDB(account) {
    try {
      console.log('[TikTok API] Saving account to database', { open_id: account.open_id });
      await axios.post('/api/save-account-to-db', {
        open_id: account.open_id,
        access_token: account.access_token,
        refresh_token: null,
        display_name: account.display_name,
        avatar_url: account.avatar_url,
        scope: account.scope
      });
      console.log('[TikTok API] Account saved to database successfully');
      return true;
    } catch (error) {
      console.error('[TikTok API] Failed to save to database:', error);
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
      console.log('[TikTok API] Removing account', { open_id: openId });
      // Call API to delete from database
      await axios.delete(`/api/delete-account?open_id=${openId}`);
      
      console.log('[TikTok API] Account removed from database');
      
      // Reload accounts from database
      await this.loadAccounts();
      
      // If removing active account, clear it
      if (this.openId === openId) {
        this.openId = null;
        this.accessToken = null;
        localStorage.removeItem('tiktok_open_id');
        localStorage.removeItem('tiktok_access_token');
        console.log('[TikTok API] Cleared active account');
      }
    } catch (error) {
      console.error('[TikTok API] Failed to remove account:', error);
    }
  }

  // Switch the active account without breaking existing flow
  async useAccount(openId) {
    console.log('[TikTok API] Switching to account', { open_id: openId });
    const account = this.accounts.find(a => a.open_id === openId);
    if (!account) {
      console.error('[TikTok API] Account not found', { open_id: openId });
      return false;
    }
    this.openId = account.open_id;
    this.accessToken = account.access_token;
    // Store in localStorage for persistence across page reloads
    localStorage.setItem('tiktok_open_id', this.openId);
    localStorage.setItem('tiktok_access_token', this.accessToken);
    console.log('[TikTok API] Switched to account successfully', {
      display_name: account.display_name,
      open_id: account.open_id
    });
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
