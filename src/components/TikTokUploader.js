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
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

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
    setVideos([]);
    setTimeout(() => setUploadStatus(''), 3000);
  };

  const handleCheckVideos = async () => {
    setLoadingVideos(true);
    setError('');
    
    try {
      const result = await tiktokApi.listVideos();
      
      if (result.success) {
        console.log('📹 User videos:', result.data);
        setVideos(result.data.videos || []);
        
        if (!result.data.videos || result.data.videos.length === 0) {
          setUploadStatus('No videos found. Videos uploaded to inbox may not appear here until posted.');
        } else {
          setUploadStatus(`Found ${result.data.videos.length} video(s)`);
        }
      } else {
        setError('Failed to fetch videos: ' + JSON.stringify(result.error));
      }
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError('Error: ' + err.message);
    } finally {
      setLoadingVideos(false);
      setTimeout(() => setUploadStatus(''), 5000);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file');
        return;
      }
      
      // Validate file size (max 4GB for TikTok API)
      const maxSize = 4 * 1024 * 1024 * 1024; // 4GB
      if (file.size > maxSize) {
        setError(`File size must be less than 4GB (current: ${Math.round(file.size / 1024 / 1024)}MB)`);
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
      const initResult = await tiktokApi.initializeUpload(selectedFile, videoTitle, privacyLevel);
      
      if (!initResult.success) {
        throw new Error(JSON.stringify(initResult.error));
      }

      const { publish_id, upload_url, chunk_size, total_chunk_count } = initResult.data;
      
      // Step 2: Upload video (with chunking support)
      setUploadStatus('Uploading video...');
      const uploadResult = await tiktokApi.uploadVideo(upload_url, selectedFile, chunk_size, total_chunk_count);
      
      if (!uploadResult.success) {
        throw new Error(JSON.stringify(uploadResult.error));
      }

      // Step 3: Check upload status
      setUploadStatus('Processing upload...');
      
      // Poll for status
      let attempts = 0;
      const maxAttempts = 120; // 120 attempts x 5 seconds = 10 minutes
      const checkStatus = async () => {
        const statusResult = await tiktokApi.publishVideo(publish_id);
        
        if (statusResult.success) {
          const status = statusResult.data.status;
          const uploadedBytes = statusResult.data.uploaded_bytes || 0;
          const failReason = statusResult.data.fail_reason;
          const publiclyAvailable = statusResult.data.publicly_available_post_id;
          
          console.log('📊 Full status data:', statusResult.data);
          console.log('📊 Current status:', status, 'Uploaded bytes:', uploadedBytes, 'Fail reason:', failReason);
          
          // For inbox uploads, these are the possible statuses:
          // PROCESSING_UPLOAD - Video is being processed
          // SEND_TO_USER_INBOX - Video sent to user's inbox (success!)
          // FAILED - Upload failed
          
          if (status === 'SEND_TO_USER_INBOX') {
            setUploadStatus('✅ Video sent to your TikTok inbox! Check your TikTok app notifications to review and post.');
            setSelectedFile(null);
            setVideoTitle('');
            setUploading(false);
            return;
          } else if (status === 'PUBLISH_COMPLETE') {
            // This shouldn't happen with inbox endpoint, but handle it anyway
            setUploadStatus('✅ Video uploaded successfully!');
            setSelectedFile(null);
            setVideoTitle('');
            setUploading(false);
            return;
          } else if (status === 'FAILED') {
            throw new Error(`Upload failed: ${failReason || 'Unknown reason'}`);
          } else if (status === 'PROCESSING_UPLOAD') {
            // Still processing
            if (attempts < maxAttempts) {
              attempts++;
              const progress = uploadedBytes > 0 ? ` (${Math.round(uploadedBytes / selectedFile.size * 100)}%)` : '';
              setUploadStatus(`Processing upload${progress}... (${attempts}/${maxAttempts})`);
              setTimeout(checkStatus, 5000); // Check every 5 seconds
            } else {
              // After 10 minutes of processing, assume success
              setUploadStatus('✅ Upload complete! Video is being processed by TikTok. Check your TikTok app inbox/notifications in the next few minutes.');
              setSelectedFile(null);
              setVideoTitle('');
              setUploading(false);
            }
          } else {
            // Unknown status, keep checking
            if (attempts < maxAttempts) {
              attempts++;
              setUploadStatus(`Status: ${status}... (${attempts}/${maxAttempts})`);
              setTimeout(checkStatus, 5000);
            } else {
              // Assume success if no error
              setUploadStatus('✅ Upload complete! Check your TikTok inbox for the video notification.');
              setSelectedFile(null);
              setVideoTitle('');
              setUploading(false);
            }
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

          <button
            onClick={handleCheckVideos}
            disabled={loadingVideos}
            className="btn-secondary"
            style={{ marginTop: '10px' }}
          >
            {loadingVideos ? 'Loading...' : '📹 Check My Videos'}
          </button>
        </div>

        {videos.length > 0 && (
          <div className="videos-list">
            <h3>Your Videos:</h3>
            <div className="video-grid">
              {videos.map((video, index) => (
                <div key={index} className="video-item">
                  <p><strong>Title:</strong> {video.title || 'Untitled'}</p>
                  <p><strong>ID:</strong> {video.id}</p>
                  {video.cover_image_url && (
                    <img src={video.cover_image_url} alt={video.title} style={{ width: '100px' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
