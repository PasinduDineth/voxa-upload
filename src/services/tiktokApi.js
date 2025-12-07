import axios from 'axios';

const CLIENT_KEY = process.env.REACT_APP_TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.REACT_APP_TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI;

class TikTokAPI {
  constructor() {
    this.accessToken = localStorage.getItem('tiktok_access_token');
    this.openId = localStorage.getItem('tiktok_open_id');
  }

  // Generate code verifier and challenge for PKCE
  generateCodeChallenge() {
    // Generate random code verifier
    const codeVerifier = this.generateRandomString(43);
    localStorage.setItem('code_verifier', codeVerifier);
    
    // Create code challenge (for simplicity, using plain method)
    // In production, use SHA256 hash
    return codeVerifier;
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

  // Generate OAuth URL for user authorization
  getAuthUrl() {
    const csrfState = Math.random().toString(36).substring(2);
    localStorage.setItem('csrf_state', csrfState);
    
    const codeChallenge = this.generateCodeChallenge();
    
    const scope = 'video.upload,user.info.basic';
    const authUrl = `https://www.tiktok.com/v2/auth/authorize?client_key=${CLIENT_KEY}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${csrfState}&code_challenge=${codeChallenge}&code_challenge_method=plain`;
    
    return authUrl;
  }

  // Exchange authorization code for access token
  async getAccessToken(code) {
    try {
      const codeVerifier = localStorage.getItem('code_verifier');
      
      // Note: In production, this should be done on backend to protect client secret
      const params = new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier
      });

      const response = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        this.openId = response.data.open_id;
        
        localStorage.setItem('tiktok_access_token', this.accessToken);
        localStorage.setItem('tiktok_open_id', this.openId);
        
        return { success: true, data: response.data };
      }
      
      return { success: false, error: 'No access token received' };
    } catch (error) {
      console.error('Error getting access token:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Initialize video upload
  async initializeUpload(videoFile) {
    if (!this.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await axios.post(
        'https://open.tiktokapis.com/v2/post/publish/video/init/',
        {
          post_info: {
            title: 'Uploaded via TikTok API',
            privacy_level: 'SELF_ONLY', // Options: PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, SELF_ONLY
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoFile.size,
            chunk_size: videoFile.size,
            total_chunk_count: 1
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
          }
        }
      );

      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('Error initializing upload:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Upload video chunk
  async uploadVideo(uploadUrl, videoFile) {
    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await axios.put(uploadUrl, videoFile, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': videoFile.size
        }
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error uploading video:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Publish the uploaded video
  async publishVideo(publishId) {
    if (!this.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await axios.post(
        'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
        {
          publish_id: publishId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
          }
        }
      );

      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('Error checking publish status:', error);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.accessToken;
  }

  // Logout
  logout() {
    this.accessToken = null;
    this.openId = null;
    localStorage.removeItem('tiktok_access_token');
    localStorage.removeItem('tiktok_open_id');
  }
}

export default new TikTokAPI();
