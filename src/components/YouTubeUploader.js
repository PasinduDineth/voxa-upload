import React, { useState, useEffect } from 'react';
import youtubeApi from '../services/youtubeApi';
import PageHeader from './Layout/PageHeader';
import './TikTokUploader.css';

function YouTubeUploader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState('channels');
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [tags, setTags] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [defaultAudioLanguage, setDefaultAudioLanguage] = useState('en');
  const [privacyStatus, setPrivacyStatus] = useState('public');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadChannelsFromDB();
    setIsAuthenticated(youtubeApi.isAuthenticated());
    setActiveChannelId(localStorage.getItem('youtube_channel_id'));
    setView('channels');

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state && state.startsWith('youtube_')) {
      handleOAuthCallback(code, state);
    }
  }, []);

  const loadChannelsFromDB = async () => {
    const chans = await youtubeApi.loadChannels();
    setChannels(chans);
  };

  const handleOAuthCallback = async (code, state) => {
    setUploadStatus('Authenticating...');
    
    const isAddingChannel = sessionStorage.getItem('youtube_oauth_adding_channel') === 'true';
    const result = await youtubeApi.getAccessToken(code, state);
    
    if (result.success) {
      const existingChannel = channels.find(ch => ch.channel_id === result.data.channel_id);
      
      if (isAddingChannel && existingChannel) {
        setError('⚠️ Same channel detected! To add a different channel, please:\n1. Log out of Google in your browser first\n2. Or use an incognito/private window\n3. Then click "Add Another Channel" again');
        setUploadStatus('');
        sessionStorage.removeItem('youtube_oauth_adding_channel');
        window.history.replaceState({}, document.title, '/');
        setTimeout(() => setError(''), 10000);
        return;
      }
      
      sessionStorage.removeItem('youtube_oauth_adding_channel');
      await loadChannelsFromDB();
      
      const newChannelId = result.data.channel_id;
      if (await youtubeApi.useChannel(newChannelId)) {
        setActiveChannelId(newChannelId);
        setIsAuthenticated(true);
      }
      
      if (isAddingChannel && !existingChannel) {
        setUploadStatus('✅ New channel added successfully!');
      } else {
        setUploadStatus(result.data.message || 'Authentication successful!');
      }
      
      window.history.replaceState({}, document.title, '/');
    } else {
      setError('Authentication failed: ' + JSON.stringify(result.error));
      sessionStorage.removeItem('youtube_oauth_adding_channel');
    }
    
    setTimeout(() => setUploadStatus(''), 3000);
  };

  const handleLogin = async (forceLogin = false) => {
    try {
      setError('');
      setUploadStatus('Initializing authentication...');
      const authUrl = await youtubeApi.getAuthUrl(forceLogin);
      setUploadStatus('');
      window.location.href = authUrl;
    } catch (error) {
      setError('Failed to initialize authentication: ' + error.message);
      setUploadStatus('');
    }
  };

  const handleAddAnotherChannel = async () => {
    sessionStorage.removeItem('youtube_oauth_state');
    sessionStorage.removeItem('youtube_oauth_code_verifier');
    await handleLogin(true);
  };

  const handleLogout = () => {
    youtubeApi.logout();
    setIsAuthenticated(false);
    setSelectedFile(null);
    setVideoTitle('');
    setVideoDescription('');
    setTags('');
    setDefaultLanguage('en');
    setDefaultAudioLanguage('en');
    setUploadStatus('Logged out successfully');
    setTimeout(() => setUploadStatus(''), 3000);
    setChannels([]);
    setActiveChannelId(null);
  };

  const handleChannelSwitch = async (e) => {
    const channelId = e.target.value;
    if (channelId && await youtubeApi.useChannel(channelId)) {
      setActiveChannelId(channelId);
      setIsAuthenticated(youtubeApi.isAuthenticated());
    }
  };

  const goToUploadView = () => setView('upload');
  const goToChannelsView = () => setView('channels');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file');
        return;
      }
      
      const maxSize = 256 * 1024 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(`File size must be less than 256GB (current: ${Math.round(file.size / 1024 / 1024)}MB)`);
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
    setUploadStatus('Uploading video to YouTube...');
    setError('');

    try {
      const uploadResult = await youtubeApi.uploadVideo(
        selectedFile, 
        videoTitle, 
        videoDescription,
        tags,
        defaultLanguage,
        defaultAudioLanguage,
        privacyStatus
      );
      
      if (!uploadResult.success) {
        throw new Error(JSON.stringify(uploadResult.error));
      }

      setUploadStatus('✅ Video uploaded successfully to YouTube!');
      setSelectedFile(null);
      setVideoTitle('');
      setVideoDescription('');
      setTags('');
      setDefaultLanguage('en');
      setDefaultAudioLanguage('en');
      setUploading(false);
      
      setTimeout(() => setUploadStatus(''), 5000);

    } catch (err) {
      setError('Upload failed: ' + err.message);
      setUploading(false);
      setUploadStatus('');
    }
  };

  if (view === 'channels') {
    return (
      <div className="uploader-container">
        <PageHeader 
          icon="▶️" 
          title="YouTube Uploader" 
          description="Manage your YouTube channels and upload videos"
        />
        <div className="upload-card">
          <div className="header">
            <h2>Channel Management</h2>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={goToUploadView} className="btn-secondary">Go to Upload</button>
              <button onClick={handleLogout} className="btn-logout">Logout</button>
            </div>
          </div>

          <div className="upload-form">
            {channels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ color: '#666', marginBottom: 20 }}>No channels connected yet.</p>
                <button onClick={() => handleLogin(false)} className="btn-primary">
                  Add Your First Channel
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', marginBottom: 15, fontWeight: 600 }}>Your Connected Channels</label>
                <div className="accounts-grid">
                  {channels.map(ch => (
                    <div 
                      key={ch.channel_id} 
                      className={`account-card ${activeChannelId === ch.channel_id ? 'active' : ''}`}
                      onClick={() => {
                        const select = { target: { value: ch.channel_id } };
                        handleChannelSwitch(select);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {ch.thumbnail_url ? (
                          <img 
                            src={ch.thumbnail_url} 
                            alt={ch.channel_title}
                            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FF0000', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600 }}>
                            {(ch.channel_title || 'Y')[0].toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#333' }}>{ch.channel_title || 'YouTube Channel'}</div>
                          <div style={{ fontSize: '0.85em', color: '#999' }}>{ch.channel_id.substring(0, 20)}...</div>
                          {(() => {
                            const expiry = formatExpiry(ch.expires_at);
                            return expiry ? (
                              <div style={{ fontSize: '0.75em', color: expiry.color, marginTop: 3 }}>
                                {expiry.text}
                              </div>
                            ) : null;
                          })()}
                        </div>
                        {activeChannelId === ch.channel_id && (
                          <div style={{ background: '#FF0000', color: 'white', padding: '4px 10px', borderRadius: 12, fontSize: '0.8em', fontWeight: 600 }}>
                            Active
                          </div>
                        )}
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm(`Remove ${ch.channel_title || 'this channel'}?`)) {
                            await youtubeApi.removeChannel(ch.channel_id);
                            await loadChannelsFromDB();
                            if (activeChannelId === ch.channel_id) {
                              const remaining = youtubeApi.getChannels();
                              if (remaining.length > 0) {
                                youtubeApi.useChannel(remaining[0].channel_id);
                                setActiveChannelId(remaining[0].channel_id);
                              } else {
                                setActiveChannelId(null);
                                setIsAuthenticated(false);
                              }
                            }
                          }
                        }}
                        className="btn-remove"
                        disabled={uploading}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <button onClick={handleAddAnotherChannel} className="btn-primary" style={{ flex: 1 }} disabled={uploading}>
                    + Add Another Channel
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="status-message error">{error}</div>
          )}
          {uploadStatus && (
            <div className="status-message success">{uploadStatus}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="uploader-container">
      <PageHeader 
        icon="▶️" 
        title="YouTube Uploader" 
        description="Upload and manage your YouTube videos"
      />
      <div className="upload-card">
        <div className="header">
          <h2>Upload Video</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={goToChannelsView} className="btn-secondary">Manage Channels</button>
            <button onClick={handleLogout} className="btn-logout">Logout</button>
          </div>
        </div>

        <div className="upload-form">
          {channels.length > 0 && (
            <div className="form-group">
              <label htmlFor="channel-select">Channel</label>
              <select
                id="channel-select"
                value={activeChannelId || ''}
                onChange={handleChannelSwitch}
                disabled={uploading}
              >
                {channels.map(ch => (
                  <option key={ch.channel_id} value={ch.channel_id}>
                    {ch.channel_title}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              maxLength={100}
              disabled={uploading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="video-description">Video Description (Optional)</label>
            <textarea
              id="video-description"
              value={videoDescription}
              onChange={(e) => setVideoDescription(e.target.value)}
              placeholder="Enter video description"
              maxLength={5000}
              rows={4}
              disabled={uploading}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontFamily: 'inherit' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="video-tags">Tags (comma separated)</label>
            <input
              id="video-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., travel, vlog, music"
              disabled={uploading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="default-language">Default Language</label>
            <select
              id="default-language"
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              disabled={uploading}
            >
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="ja">Japanese</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="default-audio-language">Default Audio Language</label>
            <select
              id="default-audio-language"
              value={defaultAudioLanguage}
              onChange={(e) => setDefaultAudioLanguage(e.target.value)}
              disabled={uploading}
            >
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="ja">Japanese</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="privacy-status">Privacy Status</label>
            <select
              id="privacy-status"
              value={privacyStatus}
              onChange={(e) => setPrivacyStatus(e.target.value)}
              disabled={uploading}
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || !videoTitle.trim() || uploading}
            className="btn-upload"
          >
            {uploading ? 'Uploading...' : 'Upload to YouTube'}
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
          <h3>📱 YouTube Upload Information:</h3>
          <ul style={{ textAlign: 'left', lineHeight: '1.8' }}>
            <li>Videos can be uploaded as Private, Unlisted, or Public</li>
            <li>Maximum file size: 256GB</li>
            <li>Maximum duration: 12 hours</li>
            <li>Supported formats: MOV, MPEG4, MP4, AVI, WMV, MPEGPS, FLV, 3GPP, WebM</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default YouTubeUploader;
