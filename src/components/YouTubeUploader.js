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
    
    if (diffMs < 0) return { text: '⚠️ Expired', color: '#ef4444' };
    if (diffDays > 30) return { text: `✅ ${diffDays} days`, color: '#10b981' };
    if (diffDays > 0) return { text: `⏳ ${diffDays}d ${diffHours % 24}h`, color: '#f59e0b' };
    if (diffHours > 0) return { text: `⏳ ${diffHours}h ${diffMins % 60}m`, color: '#f59e0b' };
    if (diffMins > 0) return { text: `⚠️ ${diffMins}m`, color: '#ef4444' };
    return { text: '⚠️ Soon', color: '#ef4444' };
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
      <div style={{
        minHeight: '100vh',
        background: '#020617',
        padding: '40px',
        fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}>
        {/* Page Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px' }}>▶️</span>
            <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#E5E7EB', margin: 0 }}>
              YouTube Uploader
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
            Manage your YouTube channels and upload videos
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          background: '#0F172A',
          border: '1px solid #1F2937',
          borderRadius: '12px',
          overflow: 'hidden',
          maxWidth: '1200px'
        }}>
          {/* Card Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1F2937',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#E5E7EB', margin: 0 }}>
              Channel Management
            </h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={goToUploadView}
                style={{
                  padding: '10px 20px',
                  background: '#6366F1',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#5558E3'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#6366F1'}
              >
                Go to Upload
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '10px 20px',
                  background: '#374151',
                  color: '#E5E7EB',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#4B5563'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#374151'}
              >
                Logout
              </button>
            </div>
          </div>

          {/* Card Content */}
          <div style={{ padding: '24px' }}>
            {uploadStatus && (
              <div style={{
                padding: '16px',
                marginBottom: '20px',
                background: '#10B981',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500
              }}>
                {uploadStatus}
              </div>
            )}

            {error && (
              <div style={{
                padding: '16px',
                marginBottom: '20px',
                background: '#EF4444',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                whiteSpace: 'pre-line'
              }}>
                {error}
              </div>
            )}

            {channels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>▶️</div>
                <p style={{ fontSize: '16px', color: '#9CA3AF', marginBottom: '24px' }}>
                  No channels connected yet
                </p>
                <button
                  onClick={() => handleLogin(false)}
                  style={{
                    padding: '12px 24px',
                    background: '#6366F1',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#5558E3'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#6366F1'}
                >
                  Add Your First Channel
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', marginBottom: '16px', fontSize: '14px', fontWeight: 500, color: '#E5E7EB' }}>
                  Your Connected Channels
                </label>
                <div style={{
                  display: 'grid',
                  gap: '12px'
                }}>
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
                          background: '#1E293B',
                          border: isActive ? '1px solid #6366F1' : '1px solid #374151',
                          borderLeft: isActive ? '4px solid #6366F1' : '4px solid transparent',
                          borderRadius: '10px',
                          padding: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = '#2D3B52';
                            e.currentTarget.style.borderColor = '#4B5563';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = '#1E293B';
                            e.currentTarget.style.borderColor = '#374151';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                          {ch.thumbnail_url ? (
                            <img
                              src={ch.thumbnail_url}
                              alt={ch.channel_title}
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                objectFit: 'cover'
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '50%',
                              background: '#6366F1',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '20px',
                              fontWeight: 600
                            }}>
                              {(ch.channel_title || 'Y')[0].toUpperCase()}
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: '#E5E7EB', marginBottom: '4px' }}>
                              {ch.channel_title || 'YouTube Channel'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>
                              {ch.channel_id.substring(0, 20)}...
                            </div>
                            {expiry && (
                              <div style={{ fontSize: '12px', color: expiry.color, marginTop: '4px', fontWeight: 500 }}>
                                {expiry.text}
                              </div>
                            )}
                          </div>
                          {isActive && (
                            <div style={{
                              padding: '4px 12px',
                              background: '#6366F1',
                              color: '#FFFFFF',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 500
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
                            padding: '8px 16px',
                            background: '#EF4444',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            marginLeft: '12px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#DC2626'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#EF4444'}
                          disabled={uploading}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '20px' }}>
                  <button
                    onClick={handleAddAnotherChannel}
                    disabled={uploading}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#374151',
                      color: '#E5E7EB',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: uploading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: uploading ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => !uploading && (e.currentTarget.style.background = '#4B5563')}
                    onMouseLeave={(e) => !uploading && (e.currentTarget.style.background = '#374151')}
                  >
                    + Add Another Channel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020617',
      padding: '40px',
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '32px' }}>▶️</span>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#E5E7EB', margin: 0 }}>
            YouTube Uploader
          </h1>
        </div>
        <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
          Upload and manage your YouTube videos
        </p>
      </div>

      {/* Main Card */}
      <div style={{
        background: '#0F172A',
        border: '1px solid #1F2937',
        borderRadius: '12px',
        overflow: 'hidden',
        maxWidth: '800px'
      }}>
        {/* Card Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #1F2937',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#E5E7EB', margin: 0 }}>
            Upload Video
          </h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={goToChannelsView}
              style={{
                padding: '10px 20px',
                background: '#374151',
                color: '#E5E7EB',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#4B5563'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#374151'}
            >
              Manage Channels
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 20px',
                background: '#374151',
                color: '#E5E7EB',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#4B5563'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#374151'}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Card Content */}
        <div style={{ padding: '24px' }}>
          {uploadStatus && (
            <div style={{
              padding: '16px',
              marginBottom: '20px',
              background: '#10B981',
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              {uploadStatus}
            </div>
          )}

          {error && (
            <div style={{
              padding: '16px',
              marginBottom: '20px',
              background: '#EF4444',
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          {/* Channel Select */}
          {channels.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#E5E7EB' }}>
                Channel
              </label>
              <select
                value={activeChannelId || ''}
                onChange={handleChannelSwitch}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#1E293B',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#E5E7EB',
                  fontSize: '14px',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  outline: 'none'
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

          {/* Video File */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#E5E7EB' }}>
              Select Video
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#1E293B',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#E5E7EB',
                fontSize: '14px',
                cursor: uploading ? 'not-allowed' : 'pointer'
              }}
            />
            {selectedFile && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: '#1E293B',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#9CA3AF'
              }}>
                <p style={{ margin: '0 0 4px 0' }}>📹 {selectedFile.name}</p>
                <p style={{ margin: 0 }}>Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          {/* Video Title */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#E5E7EB' }}>
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
                padding: '12px 16px',
                background: '#1E293B',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#E5E7EB',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          {/* Video Description */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#E5E7EB' }}>
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
                padding: '12px 16px',
                background: '#1E293B',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#E5E7EB',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Tags */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#E5E7EB' }}>
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
                padding: '12px 16px',
                background: '#1E293B',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#E5E7EB',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          {/* Language Selects */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#E5E7EB' }}>
                Default Language
              </label>
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#1E293B',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#E5E7EB',
                  fontSize: '14px',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  outline: 'none'
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
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#E5E7EB' }}>
                Default Audio Language
              </label>
              <select
                value={defaultAudioLanguage}
                onChange={(e) => setDefaultAudioLanguage(e.target.value)}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#1E293B',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#E5E7EB',
                  fontSize: '14px',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  outline: 'none'
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

          {/* Privacy Status */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#E5E7EB' }}>
              Privacy Status
            </label>
            <select
              value={privacyStatus}
              onChange={(e) => setPrivacyStatus(e.target.value)}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#1E293B',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#E5E7EB',
                fontSize: '14px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                outline: 'none'
              }}
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !videoTitle.trim() || uploading}
            style={{
              width: '100%',
              padding: '14px',
              background: (!selectedFile || !videoTitle.trim() || uploading) ? '#374151' : '#6366F1',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: (!selectedFile || !videoTitle.trim() || uploading) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: (!selectedFile || !videoTitle.trim() || uploading) ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (selectedFile && videoTitle.trim() && !uploading) {
                e.currentTarget.style.background = '#5558E3';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedFile && videoTitle.trim() && !uploading) {
                e.currentTarget.style.background = '#6366F1';
              }
            }}
          >
            {uploading ? 'Uploading...' : 'Upload to YouTube'}
          </button>

          {/* Info Section */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: '#1E293B',
            borderRadius: '8px',
            border: '1px solid #374151'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#E5E7EB', margin: '0 0 12px 0' }}>
              📱 YouTube Upload Information:
            </h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#9CA3AF', fontSize: '13px', lineHeight: '1.8' }}>
              <li>Videos can be uploaded as Private, Unlisted, or Public</li>
              <li>Maximum file size: 256GB</li>
              <li>Maximum duration: 12 hours</li>
              <li>Supported formats: MOV, MPEG4, MP4, AVI, WMV, MPEGPS, FLV, 3GPP, WebM</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default YouTubeUploader;
