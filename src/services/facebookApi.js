import axios from 'axios';

class FacebookAPI {
  constructor() {
    this.accessToken = localStorage.getItem('facebook_access_token');
    this.pageId = localStorage.getItem('facebook_page_id');
    this.accounts = [];
  }

  async addPagesWithToken(accessToken) {
    try {
      const response = await axios.post('/api/facebook-accounts', {
        action: 'add_page',
        access_token: accessToken
      });

      if (response.data.success) {
        await this.loadAccounts();
        return {
          success: true,
          message: response.data.message,
          pages_count: response.data.pages_count
        };
      }

      return { success: false, error: response.data.error || 'Unknown error' };
    } catch (error) {
      console.error('Failed to add Facebook pages:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  async loadAccounts() {
    try {
      const response = await axios.get('/api/facebook-accounts');
      if (response.data.success) {
        this.accounts = response.data.accounts;
        return this.accounts;
      }
      return [];
    } catch (error) {
      console.error('Failed to load Facebook pages from DB:', error);
      return [];
    }
  }

  getAccounts() {
    return this.accounts;
  }

  async removeAccount(pageId) {
    try {
      await axios.delete(`/api/facebook-accounts?page_id=${pageId}`);
      await this.loadAccounts();
      
      if (this.pageId === pageId) {
        this.pageId = null;
        this.accessToken = null;
        localStorage.removeItem('facebook_page_id');
        localStorage.removeItem('facebook_access_token');
      }
    } catch (error) {
      console.error('Failed to remove Facebook page:', error);
    }
  }

  async useAccount(pageId) {
    const account = this.accounts.find(a => a.open_id === pageId);
    if (!account) {
      return false;
    }
    this.pageId = account.open_id;
    this.accessToken = account.access_token;
    localStorage.setItem('facebook_page_id', this.pageId);
    localStorage.setItem('facebook_access_token', this.accessToken);
    return true;
  }

  async uploadVideo(videoFile, videoTitle, description) {
    if (!this.accessToken || !this.pageId) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Step 1: Initialize resumable upload
      const initResponse = await axios.post('/api/facebook-accounts', {
        action: 'init_upload',
        page_id: this.pageId,
        file_size: videoFile.size,
        title: videoTitle,
        description: description
      });

      if (!initResponse.data.success) {
        return {
          success: false,
          error: initResponse.data.error || 'Failed to initialize upload'
        };
      }

      const { upload_session_id, start_offset, end_offset, access_token } = initResponse.data.data;

      // Step 2: Upload video chunks directly to Facebook (no CORS issue)
      const chunkSize = 1024 * 1024 * 5; // 5MB chunks
      let offset = start_offset || 0;
      
      while (offset < videoFile.size) {
        const chunk = videoFile.slice(offset, Math.min(offset + chunkSize, videoFile.size));
        const formData = new FormData();
        formData.append('upload_phase', 'transfer');
        formData.append('upload_session_id', upload_session_id);
        formData.append('start_offset', offset);
        formData.append('video_file_chunk', chunk);
        formData.append('access_token', access_token);

        const uploadResponse = await axios.post(
          `https://graph.facebook.com/v18.0/${this.pageId}/videos`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        if (!uploadResponse.data.success && uploadResponse.data.start_offset === undefined) {
          throw new Error('Chunk upload failed');
        }

        offset = uploadResponse.data.start_offset || uploadResponse.data.end_offset || (offset + chunk.size);
      }

      // Step 3: Finalize upload
      const finalizeResponse = await axios.post('/api/facebook-accounts', {
        action: 'finalize_upload',
        page_id: this.pageId,
        upload_session_id: upload_session_id,
        title: videoTitle,
        description: description
      });

      if (finalizeResponse.data.success) {
        return {
          success: true,
          data: finalizeResponse.data.data
        };
      } else {
        return {
          success: false,
          error: finalizeResponse.data.error || 'Failed to finalize upload'
        };
      }

    } catch (error) {
      console.error('Facebook upload failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  isAuthenticated() {
    return !!this.accessToken && !!this.pageId;
  }

  logout() {
    this.accessToken = null;
    this.pageId = null;
    localStorage.removeItem('facebook_access_token');
    localStorage.removeItem('facebook_page_id');
  }
}

export default new FacebookAPI();
