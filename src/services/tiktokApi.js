import axios from 'axios';

const CLIENT_KEY = 'sbaw0lz3d1a0f32yv3';
const CLIENT_SECRET = 'd3UvL0TgwNkuDVfirIT4UuI2wnCrXUMY';
const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI || 'https://www.pasindu.website/callback';

console.log('🔑 TikTok API Config:', {
  CLIENT_KEY,
  CLIENT_SECRET: CLIENT_SECRET ? '***' + CLIENT_SECRET.slice(-4) : 'MISSING',
  REDIRECT_URI
});

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
    
    const scope = 'user.info.basic,video.upload,video.publish';
    const authUrl = `https://www.tiktok.com/v2/auth/authorize?client_key=${CLIENT_KEY}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${csrfState}&code_challenge=${codeChallenge}&code_challenge_method=plain`;
    
    console.log('🔗 Generated Auth URL:', authUrl);
    console.log('📋 Auth params:', {
      client_key: CLIENT_KEY,
      redirect_uri: REDIRECT_URI,
      state: csrfState,
      code_challenge: codeChallenge
    });
    
    return authUrl;
  }

  // Exchange authorization code for access token
  async getAccessToken(code) {
    try {
      const codeVerifier = localStorage.getItem('code_verifier');
      
      console.log('🔄 Getting access token with:', {
        code: code.substring(0, 10) + '...',
        code_verifier: codeVerifier?.substring(0, 10) + '...',
        redirect_uri: REDIRECT_URI
      });
      
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

      console.log('✅ Token response:', response.data);

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        this.openId = response.data.open_id;
        
        localStorage.setItem('tiktok_access_token', this.accessToken);
        localStorage.setItem('tiktok_open_id', this.openId);
        
        console.log('💾 Token saved successfully');
        
        return { success: true, data: response.data };
      }
      
      console.error('❌ No access token in response');
      return { success: false, error: 'No access token received' };
    } catch (error) {
      console.error('❌ Error getting access token:', error);
      console.error('Response data:', error.response?.data);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Initialize video upload
  async initializeUpload(videoFile, videoTitle, privacyLevel) {
    if (!this.accessToken) {
      console.error('❌ No access token available');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('🚀 Initializing upload via backend...');
      
      const requestData = {
        accessToken: this.accessToken,
        videoFile: {
          size: videoFile.size,
          title: videoTitle,
          privacyLevel: privacyLevel
        }
      };
      
      console.log('📤 Frontend sending to /api/init-upload:', {
        accessTokenLength: this.accessToken.length,
        accessTokenPreview: `${this.accessToken.substring(0, 20)}...`,
        videoFileSize: videoFile.size,
        videoFileSizeType: typeof videoFile.size,
        videoTitle: videoTitle,
        privacyLevel: privacyLevel,
        fullPayload: JSON.stringify(requestData)
      });
      
      const response = await axios.post('/api/init-upload', requestData);

      console.log('✅ Backend response received:', {
        status: response.status,
        data: response.data
      });
      
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('❌ Error initializing upload:', {
        message: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        fullError: error
      });
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Upload entire video file (matching PHP SDK approach)
  async uploadVideo(uploadUrl, videoFile) {
    try {
      const videoSize = videoFile.size;
      console.log(`📤 Uploading entire file (${(videoSize / 1024 / 1024).toFixed(2)} MB)...`);
      
      // Upload entire file in one PUT request (like PHP SDK does)
      const response = await axios.put(uploadUrl, videoFile, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': videoSize,
          'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      console.log('✅ Upload complete:', response.status);
      return { success: true, data: response.data }
    } catch (error) {
      console.error('❌ Error uploading video:', error);
      console.error('Response:', error.response?.data);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Publish the uploaded video
  async publishVideo(publishId) {
    if (!this.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('📊 Checking publish status via backend...');
      
      const response = await axios.post('/api/check-status', {
        accessToken: this.accessToken,
        publishId: publishId
      });

      console.log('✅ Status response:', response.data);
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('❌ Error checking publish status:', error);
      console.error('Response data:', error.response?.data);
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
