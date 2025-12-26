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
      // For Facebook, we need to upload the video file to a temporary location first
      // then provide the URL to Facebook. Since we can't do direct CORS uploads,
      // we'll use Facebook's file upload approach through our backend.
      
      // Convert file to base64 for backend transfer
      const reader = new FileReader();
      const fileData = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(videoFile);
      });

      // Send to backend to handle Facebook upload
      const response = await axios.post('/api/facebook-accounts', {
        action: 'upload_video',
        page_id: this.pageId,
        video_data: fileData,
        video_name: videoFile.name,
        video_type: videoFile.type,
        title: videoTitle,
        description: description
      }, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000 // 5 minute timeout for large files
      });

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Upload failed'
        };
      }
    } catch (error) {
      console.error('Facebook upload failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || error.message
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
