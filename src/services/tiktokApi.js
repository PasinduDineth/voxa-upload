// src/tiktokApi.js
import axios from 'axios';

const CLIENT_KEY = 'sbaw0lz3d1a0f32yv3';
const CLIENT_SECRET = 'd3UvL0TgwNkuDVfirIT4UuI2wnCrXUMY';
const REDIRECT_URI =
  process.env.REACT_APP_REDIRECT_URI || 'https://www.pasindu.website/callback';

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
    const codeVerifier = this.generateRandomString(43);
    localStorage.setItem('code_verifier', codeVerifier);
    // Using "plain" for code_challenge_method
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

    const authUrl = `https://www.tiktok.com/v2/auth/authorize?client_key=${CLIENT_KEY}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${csrfState}&code_challenge=${codeChallenge}&code_challenge_method=plain`;

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
        code: code?.substring(0, 10) + '...',
        code_verifier: codeVerifier?.substring(0, 10) + '...',
        redirect_uri: REDIRECT_URI
      });

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
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

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

  // Initialize video upload (call backend)
  async initializeUpload(videoFile, videoTitle, privacyLevel) {
    if (!this.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log('🚀 Initializing upload via backend...');

      const response = await axios.post('/api/init-upload', {
        accessToken: this.accessToken,
        videoFile: {
          size: videoFile.size,
          title: videoTitle,
          privacyLevel: privacyLevel
        }
      });

      console.log('✅ Upload initialized:', response.data);

      // TikTok's init returns: { data: { upload_url, publish_id, ... }, ... }
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('❌ Error initializing upload:', error);
      console.error('Response data:', error.response?.data);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Upload video in chunks (for files > 64MB)
  async uploadVideo(uploadUrl, videoFile) {
    try {
      const CHUNK_SIZE = 10_000_000; // 10 MB - MUST match backend
      const totalSize = videoFile.size;

      // Must match what backend sent to TikTok: floor(video_size / chunk_size)
      const totalChunkCount = Math.floor(totalSize / CHUNK_SIZE) || 1;

      console.log('📤 Starting chunk upload:', {
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        chunkSizeBytes: CHUNK_SIZE,
        chunkSizeMB: (CHUNK_SIZE / 1024 / 1024).toFixed(2),
        totalChunkCount
      });

      for (let chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++) {
        const isLastChunk = chunkIndex === totalChunkCount - 1;

        const start = chunkIndex * CHUNK_SIZE;
        const end = isLastChunk
          ? totalSize // last chunk absorbs all remaining bytes
          : start + CHUNK_SIZE;

        const chunk = videoFile.slice(start, end);
        const chunkSize = end - start;

        const firstByte = start;
        const lastByte = end - 1; // inclusive
        const contentRangeHeader = `bytes ${firstByte}-${lastByte}/${totalSize}`;

        console.log(`📦 Uploading chunk ${chunkIndex + 1}/${totalChunkCount}:`, {
          start,
          endExclusive: end,
          firstByte,
          lastByte,
          chunkSize,
          chunkSizeMB: (chunkSize / 1024 / 1024).toFixed(2),
          contentRange: contentRangeHeader
        });

        const response = await axios.put(uploadUrl, chunk, {
          headers: {
            'Content-Type': videoFile.type || 'video/mp4',
            'Content-Length': chunkSize,
            'Content-Range': contentRangeHeader
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });

        console.log(`✅ Chunk ${chunkIndex + 1} response:`, {
          status: response.status,
          statusText: response.statusText,
          responseContentRange: response.headers['content-range']
        });

        // TikTok:
        // - 206 Partial Content for intermediate chunks
        // - 201 Created for final chunk
        if (isLastChunk) {
          if (response.status !== 201) {
            throw new Error(
              `Expected 201 on last chunk, got ${response.status}`
            );
          }
          console.log('🎉 All chunks uploaded successfully!');
          return { success: true, data: response.data };
        } else {
          if (response.status !== 206) {
            throw new Error(
              `Unexpected response status for non-final chunk: ${response.status}`
            );
          }
        }
      }

      throw new Error('Upload loop ended without sending last chunk');
    } catch (error) {
      console.error('❌ Error uploading video:', error);
      console.error('Response:', error.response?.data);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  // Publish the uploaded video (via backend)
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
