import axios from 'axios';

class YouTubeAPI {
  constructor() {
    this.accessToken = localStorage.getItem('youtube_access_token');
    this.channelId = localStorage.getItem('youtube_channel_id');
    this.channels = [];
  }

  async getAuthUrl(forceLogin = false) {
    try {
      const response = await axios.post('/api/youtube-init-oauth', {
        user_id: localStorage.getItem('user_id') || null,
        workspace_id: localStorage.getItem('workspace_id') || null
      });

      if (!response.data.success) {
        throw new Error('Failed to initialize OAuth: ' + response.data.error);
      }

      const { state, code_challenge, code_challenge_method, code_verifier, client_id, redirect_uri } = response.data.data;

      if (!client_id) {
        throw new Error('CLIENT_ID not received from server. Please check server configuration.');
      }

      if (!redirect_uri) {
        throw new Error('REDIRECT_URI not received from server. Please check server configuration.');
      }

      sessionStorage.setItem('youtube_oauth_state', state);
      sessionStorage.setItem('youtube_oauth_code_verifier', code_verifier);

      const scope = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';

      const params = new URLSearchParams({
        client_id: client_id,
        redirect_uri: redirect_uri,
        response_type: 'code',
        scope: scope,
        state: state,
        code_challenge: code_challenge,
        code_challenge_method: code_challenge_method,
        access_type: 'offline',
        prompt: forceLogin ? 'consent' : 'select_account'
      });

      if (forceLogin) {
        sessionStorage.setItem('youtube_oauth_adding_channel', 'true');
      } else {
        sessionStorage.removeItem('youtube_oauth_adding_channel');
      }

      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } catch (error) {
      console.error('Failed to initialize YouTube OAuth:', error.message);
      throw error;
    }
  }

  async getAccessToken(code, state) {
    try {
      const storedState = sessionStorage.getItem('youtube_oauth_state');
      const codeVerifier = sessionStorage.getItem('youtube_oauth_code_verifier');

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

      const response = await axios.post('/api/youtube-oauth-callback', {
        code,
        state,
        code_verifier: codeVerifier
      });

      sessionStorage.removeItem('youtube_oauth_state');
      sessionStorage.removeItem('youtube_oauth_code_verifier');

      if (response.data.success) {
        const { channel_id, channel_title, thumbnail_url, is_new } = response.data.data;
        await this.loadChannels();

        const allChannels = this.getChannels();
        if (allChannels.length === 1 || is_new) {
          await this.useChannel(channel_id);
        }

        return { 
          success: true, 
          data: { 
            channel_id, 
            channel_title, 
            thumbnail_url,
            is_new,
            message: is_new ? 'New channel connected' : 'Channel re-authenticated'
          } 
        };
      }

      return { success: false, error: response.data.error || 'Unknown error' };

    } catch (error) {
      sessionStorage.removeItem('youtube_oauth_state');
      sessionStorage.removeItem('youtube_oauth_code_verifier');

      return { 
        success: false, 
        error: error.response?.data?.error || error.message 
      };
    }
  }

  async loadChannels() {
    try {
      const response = await axios.get('/api/youtube-get-channels');
      if (response.data.success) {
        this.channels = response.data.channels;
        return this.channels;
      }
      return [];
    } catch (error) {
      console.error('Failed to load channels from DB:', error);
      return [];
    }
  }

  getChannels() {
    return this.channels;
  }

  async removeChannel(channelId) {
    try {
      await axios.delete(`/api/youtube-delete-channel?channel_id=${channelId}`);
      await this.loadChannels();
      
      if (this.channelId === channelId) {
        this.channelId = null;
        this.accessToken = null;
        localStorage.removeItem('youtube_channel_id');
        localStorage.removeItem('youtube_access_token');
      }
    } catch (error) {
      console.error('Failed to remove channel:', error);
    }
  }

  async useChannel(channelId) {
    const channel = this.channels.find(c => c.channel_id === channelId);
    if (!channel) {
      return false;
    }
    this.channelId = channel.channel_id;
    this.accessToken = channel.access_token;
    localStorage.setItem('youtube_channel_id', this.channelId);
    localStorage.setItem('youtube_access_token', this.accessToken);
    return true;
  }

  async uploadVideo(videoFile, videoTitle, videoDescription, privacyStatus = 'private') {
    if (!this.accessToken || !this.channelId) {
      console.error('Not authenticated:', { accessToken: !!this.accessToken, channelId: !!this.channelId });
      return { success: false, error: 'Not authenticated' };
    }

    console.log('=== YouTube Upload (Frontend) ===');
    console.log('Channel ID:', this.channelId);
    console.log('Title:', videoTitle);
    console.log('Video file:', videoFile.name, 'Size:', videoFile.size);
    console.log('Access Token (first 20 chars):', this.accessToken.substring(0, 20) + '...');

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('title', videoTitle);
      formData.append('description', videoDescription || '');
      formData.append('privacyStatus', privacyStatus);
      formData.append('accessToken', this.accessToken);
      formData.append('channelId', this.channelId);

      const response = await axios.post('/api/youtube-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Upload progress: ${percentCompleted}%`);
        }
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Upload failed:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  logout() {
    this.accessToken = null;
    this.channelId = null;
    localStorage.removeItem('youtube_access_token');
    localStorage.removeItem('youtube_channel_id');
  }
}

export default new YouTubeAPI();
