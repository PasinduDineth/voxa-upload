import React, { useState, useEffect } from 'react';
import tiktokApi from '../services/tiktokApi';
import './TikTokUploader.css';

function TikTokUploader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState('SELF_ONLY');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if user is authenticated
    setIsAuthenticated(tiktokApi.isAuthenticated());

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      const savedState = localStorage.getItem('csrf_state');
      if (state === savedState) {
        handleOAuthCallback(code);
      }
    }
  }, []);

  const handleOAuthCallback = async (code) => {
    setUploadStatus('Authenticating...');
    const result = await tiktokApi.getAccessToken(code);
    
    if (result.success) {
      setIsAuthenticated(true);
      setUploadStatus('Authentication successful!');
      // Clean up URL
      window.history.replaceState({}, document.title, '/');
    } else {
      setError('Authentication failed: ' + JSON.stringify(result.error));
    }
    
    setTimeout(() => setUploadStatus(''), 3000);
  };

  const handleLogin = () => {
    const authUrl = tiktokApi.getAuthUrl();
    window.location.href = authUrl;
  };

  const handleLogout = () => {
    tiktokApi.logout();
    setIsAuthenticated(false);
    setSelectedFile(null);
    setVideoTitle('');
    setUploadStatus('Logged out successfully');
    setTimeout(() => setUploadStatus(''), 3000);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file');
        return;
      }
      
      // Validate file size (max 4GB for TikTok)
      if (file.size > 4 * 1024 * 1024 * 1024) {
        setError('File size must be less than 4GB');
        return;
      }
      
      setSelectedFile(file);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a video file');
      return;
    }

    if (!videoTitle.trim()) {
      setError('Please enter a video title');
      return;
    }

    setUploading(true);
    setUploadStatus('Initializing upload...');
    setError('');

    try {
      // Step 1: Initialize upload
      const initResult = await tiktokApi.initializeUpload(selectedFile);
      
      if (!initResult.success) {
        throw new Error(JSON.stringify(initResult.error));
      }

      const { publish_id, upload_url } = initResult.data;
      
      // Step 2: Upload video
      setUploadStatus('Uploading video...');
      const uploadResult = await tiktokApi.uploadVideo(upload_url, selectedFile);
      
      if (!uploadResult.success) {
        throw new Error(JSON.stringify(uploadResult.error));
      }

      // Step 3: Check publish status
      setUploadStatus('Publishing video...');
      
      // Poll for status
      let attempts = 0;
      const maxAttempts = 30;
      const checkStatus = async () => {
        const statusResult = await tiktokApi.publishVideo(publish_id);
        
        if (statusResult.success) {
          const status = statusResult.data.status;
          
          if (status === 'PUBLISH_COMPLETE') {
            setUploadStatus('✅ Video uploaded successfully!');
            setSelectedFile(null);
            setVideoTitle('');
            setUploading(false);
            return;
          } else if (status === 'FAILED') {
            throw new Error('Publishing failed');
          } else if (attempts < maxAttempts) {
            attempts++;
            setUploadStatus(`Publishing... (${attempts}/${maxAttempts})`);
            setTimeout(checkStatus, 2000);
          } else {
            throw new Error('Publishing timeout');
          }
        } else {
          throw new Error(JSON.stringify(statusResult.error));
        }
      };
      
      await checkStatus();

    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed: ' + err.message);
      setUploading(false);
      setUploadStatus('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="uploader-container">
        <div className="auth-card">
          <h1>TikTok Video Uploader</h1>
          <p>Connect your TikTok account to start uploading videos</p>
          <button onClick={handleLogin} className="btn-primary">
            Connect TikTok Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="uploader-container">
      <div className="upload-card">
        <div className="header">
          <h1>TikTok Video Uploader</h1>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>

        <div className="upload-form">
          <div className="form-group">
            <label htmlFor="video-file">Select Video</label>
            <input
              id="video-file"
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            {selectedFile && (
              <div className="file-info">
                <p>📹 {selectedFile.name}</p>
                <p>Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="video-title">Video Title</label>
            <input
              id="video-title"
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Enter video title"
              maxLength={150}
              disabled={uploading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="privacy">Privacy Level</label>
            <select
              id="privacy"
              value={privacyLevel}
              onChange={(e) => setPrivacyLevel(e.target.value)}
              disabled={uploading}
            >
              <option value="SELF_ONLY">Private (Only Me)</option>
              <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
              <option value="PUBLIC_TO_EVERYONE">Public</option>
            </select>
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || !videoTitle.trim() || uploading}
            className="btn-upload"
          >
            {uploading ? 'Uploading...' : 'Upload to TikTok'}
          </button>
        </div>

        {uploadStatus && (
          <div className="status-message success">
            {uploadStatus}
          </div>
        )}

        {error && (
          <div className="status-message error">
            {error}
          </div>
        )}

        <div className="info-section">
          <h3>Upload Requirements:</h3>
          <ul>
            <li>Video format: MP4, MOV, or other common video formats</li>
            <li>Maximum file size: 4GB</li>
            <li>Recommended resolution: 720p or higher</li>
            <li>Duration: 3 seconds to 10 minutes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default TikTokUploader;
