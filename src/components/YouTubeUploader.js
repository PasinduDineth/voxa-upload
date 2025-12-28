import React, { useState, useEffect } from 'react';
import youtubeApi from '../services/youtubeApi';

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

  const formatExpiry = (expiresAt) => {
    if (!expiresAt) return null;
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMs < 0) return { text: '⚠️ Expired', color: '#111827' };
    if (diffDays > 30) return { text: `✅ ${diffDays} days`, color: '#4fd1c5' };
    if (diffDays > 0) return { text: `⏳ ${diffDays}d ${diffHours % 24}h`, color: '#6b7280' };
    if (diffHours > 0) return { text: `⏳ ${diffHours}h ${diffMins % 60}m`, color: '#6b7280' };
    if (diffMins > 0) return { text: `⚠️ ${diffMins}m`, color: '#111827' };
    return { text: '⚠️ Soon', color: '#111827' };
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
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{
          maxWidth: '840px',
          margin: '0 auto',
          background: '#ffffff',
          border: '1px solid #111827',
          padding: '24px 32px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: '0 0 6px 0' }}>
                Channel Management
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                Manage connected YouTube channels and open the uploader.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={goToUploadView}
                style={{
                  padding: '10px 18px',
                  background: '#4fd1c5',
                  color: '#0b1c2d',
                  border: '1px solid #111827',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#0b1c2d';
                  e.currentTarget.style.color = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#4fd1c5';
                  e.currentTarget.style.color = '#0b1c2d';
                }}
              >
                Go to Upload
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '10px 18px',
                  background: 'transparent',
                  color: '#111827',
                  border: '1px solid #111827',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#111827';
                  e.currentTarget.style.color = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#111827';
                }}
              >
                Logout
              </button>
            </div>
          </div>

          {uploadStatus && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              background: '#e5e7eb',
              color: '#111827',
              border: '1px solid #111827',
              fontSize: '13px'
            }}>
              {uploadStatus}
            </div>
          )}

          {error && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              background: '#ffffff',
              color: '#111827',
              border: '1px solid #111827',
              fontSize: '13px',
              whiteSpace: 'pre-line'
            }}>
              {error}
            </div>
          )}

          {channels.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', border: '1px solid #111827', background: '#e5e7eb' }}>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
                No channels connected yet.
              </p>
              <button
                onClick={() => handleLogin(false)}
                style={{
                  padding: '10px 18px',
                  background: '#4fd1c5',
                  color: '#0b1c2d',
                  border: '1px solid #111827',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#0b1c2d';
                  e.currentTarget.style.color = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#4fd1c5';
                  e.currentTarget.style.color = '#0b1c2d';
                }}
              >
                Add Your First Channel
              </button>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                Your Connected Channels
              </label>
              <div style={{ display: 'grid', gap: '10px' }}>
                {channels.map(ch => {
                  const isActive = activeChannelId === ch.channel_id;
                  const expiry = formatExpiry(ch.expires_at);
                  
                  return (
                    <div
                      key={ch.channel_id}
                      onClick={() => {
                        const select = { target: { value: ch.channel_id } };
                        handleChannelSwitch(select);
                      }}
                      style={{
                        background: '#e5e7eb',
                        border: '1px solid #111827',
                        borderLeft: isActive ? '4px solid #4fd1c5' : '4px solid #111827',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = '#d1d5db';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = '#e5e7eb';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        {ch.thumbnail_url ? (
                          <img
                            src={ch.thumbnail_url}
                            alt={ch.channel_title}
                            style={{
                              width: '40px',
                              height: '40px',
                              objectFit: 'cover'
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '40px',
                            height: '40px',
                            background: '#0b1c2d',
                            color: '#4fd1c5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 600
                          }}>
                            {(ch.channel_title || 'Y')[0].toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                            {ch.channel_title || 'YouTube Channel'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {ch.channel_id.substring(0, 20)}...
                          </div>
                          {expiry && (
                            <div style={{ fontSize: '12px', color: expiry.color, marginTop: '4px', fontWeight: 600 }}>
                              {expiry.text}
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <div style={{
                            padding: '4px 10px',
                            background: '#0b1c2d',
                            color: '#4fd1c5',
                            fontSize: '11px',
                            fontWeight: 600
                          }}>
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
                        style={{
                          padding: '6px 12px',
                          background: 'transparent',
                          color: '#111827',
                          border: '1px solid #111827',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginLeft: '12px',
                          transition: 'background 0.2s, color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#111827';
                          e.currentTarget.style.color = '#e5e7eb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#111827';
                        }}
                        disabled={uploading}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '16px' }}>
                <button
                  onClick={handleAddAnotherChannel}
                  disabled={uploading}
                  style={{
                    width: '100%',
                    padding: '10px 18px',
                    background: '#4fd1c5',
                    color: '#0b1c2d',
                    border: '1px solid #111827',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                    opacity: uploading ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!uploading) {
                      e.currentTarget.style.background = '#0b1c2d';
                      e.currentTarget.style.color = '#e5e7eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#4fd1c5';
                    e.currentTarget.style.color = '#0b1c2d';
                  }}
                >
                  + Add Another Channel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div style={{
        maxWidth: '840px',
        margin: '0 auto',
        background: '#ffffff',
        border: '1px solid #111827',
        padding: '24px 32px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: '0 0 6px 0' }}>
              Upload Video
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              Upload and manage your YouTube videos.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={goToChannelsView}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                color: '#111827',
                border: '1px solid #111827',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#111827';
                e.currentTarget.style.color = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#111827';
              }}
            >
              Manage Channels
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                color: '#111827',
                border: '1px solid #111827',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#111827';
                e.currentTarget.style.color = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#111827';
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {uploadStatus && (
          <div style={{
            padding: '12px',
            marginBottom: '16px',
            background: '#e5e7eb',
            color: '#111827',
            border: '1px solid #111827',
            fontSize: '13px'
          }}>
            {uploadStatus}
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px',
            marginBottom: '16px',
            background: '#ffffff',
            color: '#111827',
            border: '1px solid #111827',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: '16px' }}>
          {channels.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#6b7280' }}>
                Channel
              </label>
              <select
                value={activeChannelId || ''}
                onChange={handleChannelSwitch}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#e5e7eb',
                  border: '1px solid #111827',
                  color: '#111827',
                  fontSize: '14px',
                  cursor: uploading ? 'not-allowed' : 'pointer'
                }}
              >
                {channels.map(ch => (
                  <option key={ch.channel_id} value={ch.channel_id}>
                    {ch.channel_title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#6b7280' }}>
              Select Video
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#e5e7eb',
                border: '1px solid #111827',
                color: '#111827',
                fontSize: '14px',
                cursor: uploading ? 'not-allowed' : 'pointer'
              }}
            />
            {selectedFile && (
              <div style={{
                marginTop: '10px',
                padding: '10px 12px',
                background: '#e5e7eb',
                border: '1px solid #111827',
                fontSize: '13px',
                color: '#6b7280'
              }}>
                <p style={{ margin: '0 0 4px 0', color: '#111827', fontWeight: 600 }}>📹 {selectedFile.name}</p>
                <p style={{ margin: 0 }}>Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#6b7280' }}>
              Video Title
            </label>
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Enter video title"
              maxLength={100}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#e5e7eb',
                border: '1px solid #111827',
                color: '#111827',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#6b7280' }}>
              Video Description (Optional)
            </label>
            <textarea
              value={videoDescription}
              onChange={(e) => setVideoDescription(e.target.value)}
              placeholder="Enter video description"
              maxLength={5000}
              rows={4}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#e5e7eb',
                border: '1px solid #111827',
                color: '#111827',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#6b7280' }}>
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., travel, vlog, music"
              disabled={uploading}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#e5e7eb',
                border: '1px solid #111827',
                color: '#111827',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#6b7280' }}>
                Default Language
              </label>
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#e5e7eb',
                  border: '1px solid #111827',
                  color: '#111827',
                  fontSize: '14px',
                  cursor: uploading ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="ja">Japanese</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#6b7280' }}>
                Default Audio Language
              </label>
              <select
                value={defaultAudioLanguage}
                onChange={(e) => setDefaultAudioLanguage(e.target.value)}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#e5e7eb',
                  border: '1px solid #111827',
                  color: '#111827',
                  fontSize: '14px',
                  cursor: uploading ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="ja">Japanese</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#6b7280' }}>
              Privacy Status
            </label>
            <select
              value={privacyStatus}
              onChange={(e) => setPrivacyStatus(e.target.value)}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#e5e7eb',
                border: '1px solid #111827',
                color: '#111827',
                fontSize: '14px',
                cursor: uploading ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || !videoTitle.trim() || uploading}
            style={{
              width: '100%',
              padding: '12px',
              background: (!selectedFile || !videoTitle.trim() || uploading) ? '#e5e7eb' : '#4fd1c5',
              color: (!selectedFile || !videoTitle.trim() || uploading) ? '#6b7280' : '#0b1c2d',
              border: '1px solid #111827',
              fontSize: '14px',
              fontWeight: 600,
              cursor: (!selectedFile || !videoTitle.trim() || uploading) ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (selectedFile && videoTitle.trim() && !uploading) {
                e.currentTarget.style.background = '#0b1c2d';
                e.currentTarget.style.color = '#e5e7eb';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedFile && videoTitle.trim() && !uploading) {
                e.currentTarget.style.background = '#4fd1c5';
                e.currentTarget.style.color = '#0b1c2d';
              }
            }}
          >
            {uploading ? 'Uploading...' : 'Upload to YouTube'}
          </button>
        </div>
      </div>

      <div style={{
        marginTop: '24px',
        padding: '20px 24px',
        background: '#ffffff',
        border: '1px solid #111827'
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: '0 0 12px 0' }}>
          YouTube Upload Information
        </h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#6b7280', fontSize: '13px', lineHeight: '1.8' }}>
          <li>Videos can be uploaded as Private, Unlisted, or Public</li>
          <li>Maximum file size: 256GB</li>
          <li>Maximum duration: 12 hours</li>
          <li>Supported formats: MOV, MPEG4, MP4, AVI, WMV, MPEGPS, FLV, 3GPP, WebM</li>
        </ul>
      </div>
    </div>
  );
}

export default YouTubeUploader;
