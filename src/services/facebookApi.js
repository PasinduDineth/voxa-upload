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

      console.log('✅ Upload session initialized:', upload_session_id);

      // Step 2: Upload binary chunks via multipart to backend
      const chunkSize = 1024 * 1024 * 4; // 4MB chunks (Vercel limit is 4.5MB)
      let offset = start_offset || 0;
      const totalSize = videoFile.size;
      
      console.log(`📹 Video size: ${(totalSize / 1024 / 1024).toFixed(2)}MB, chunk size: ${(chunkSize / 1024 / 1024).toFixed(0)}MB`);
      
      while (offset < videoFile.size) {
        const progress = Math.round((offset / totalSize) * 100);
        const chunkNum = Math.floor(offset / chunkSize) + 1;
        console.log(`⬆️ Uploading... ${progress}% (offset: ${offset})`);
        
        const endByte = Math.min(offset + chunkSize, videoFile.size);
        const chunk = videoFile.slice(offset, endByte);
        const actualChunkSize = endByte - offset;
        
        console.log(`📦 Chunk ${chunkNum}: ${(actualChunkSize / 1024 / 1024).toFixed(2)}MB (${offset} to ${endByte})`);
        
        // Send binary chunk to backend via multipart form-data
        const formData = new FormData();
        formData.append('action', 'upload_chunk');
        formData.append('page_id', this.pageId);
        formData.append('upload_session_id', upload_session_id);
        formData.append('start_offset', offset);
        formData.append('access_token', access_token);
        formData.append('video_chunk', chunk, 'chunk.mp4');

        const uploadResponse = await axios.post('/api/facebook-accounts', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        if (!uploadResponse.data.success) {
          console.error('❌ Chunk upload failed:', uploadResponse.data.error);
          throw new Error(uploadResponse.data.error || 'Chunk upload failed');
        }

        console.log('✅ Chunk uploaded successfully');
        console.log('Facebook response:', uploadResponse.data.data);
        
        // Move to next chunk based on what we actually sent
        offset = endByte;
        console.log(`📍 Next offset: ${offset}`);
      }

      // Step 3: Finalize upload
      console.log('🏁 Finalizing upload...');
      const finalizeResponse = await axios.post('/api/facebook-accounts', {
        action: 'finalize_upload',
        page_id: this.pageId,
        upload_session_id: upload_session_id,
        title: videoTitle,
        description: description
      });

      if (finalizeResponse.data.success) {
        console.log('🎉 Video uploaded successfully!', finalizeResponse.data.data);
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
