import React, { useState, useEffect } from 'react';
import { FaVideo } from 'react-icons/fa6';
import tiktokApi from '../services/tiktokApi';

function TikTokUploader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState('accounts'); // 'accounts' | 'upload'
  const [accounts, setAccounts] = useState([]);
  const [activeOpenId, setActiveOpenId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAccountsFromDB();
    setIsAuthenticated(tiktokApi.isAuthenticated());
    setActiveOpenId(localStorage.getItem('tiktok_open_id'));
    setView('accounts');

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state && !state.startsWith('youtube_')) {
      handleOAuthCallback(code, state);
    }
  }, []);

  const loadAccountsFromDB = async () => {
    const accs = await tiktokApi.loadAccounts();
    setAccounts(accs);
  };

  const handleOAuthCallback = async (code, state) => {
    setUploadStatus('Authenticating...');
    
    const isAddingAccount = sessionStorage.getItem('oauth_adding_account') === 'true';
    const result = await tiktokApi.getAccessToken(code, state);
    
    if (result.success) {
      const existingAccount = accounts.find(acc => acc.open_id === result.data.open_id);
      
      if (isAddingAccount && existingAccount) {
        setError('⚠️ Same account detected! To add a different account, please:\n1. Log out of TikTok in your browser first\n2. Or use an incognito/private window\n3. Then click "Add Another Account" again');
        setUploadStatus('');
        sessionStorage.removeItem('oauth_adding_account');
        window.history.replaceState({}, document.title, '/');
        setTimeout(() => setError(''), 10000);
        return;
      }
      
      sessionStorage.removeItem('oauth_adding_account');
      await loadAccountsFromDB();
      
      const newOpenId = result.data.open_id;
      if (await tiktokApi.useAccount(newOpenId)) {
        setActiveOpenId(newOpenId);
        setIsAuthenticated(true);
      }
      
      if (isAddingAccount && !existingAccount) {
        setUploadStatus('✅ New account added successfully!');
      } else {
        setUploadStatus(result.data.message || 'Authentication successful!');
      }
      
      window.history.replaceState({}, document.title, '/');
    } else {
      setError('Authentication failed: ' + JSON.stringify(result.error));
      sessionStorage.removeItem('oauth_adding_account');
    }
    
    setTimeout(() => setUploadStatus(''), 3000);
  };

  const handleLogin = async (forceLogin = false) => {
    try {
      setError('');
      setUploadStatus('Initializing authentication...');
      const authUrl = await tiktokApi.getAuthUrl(forceLogin);
      setUploadStatus('');
      window.location.href = authUrl;
    } catch (error) {
      setError('Failed to initialize authentication: ' + error.message);
      setUploadStatus('');
    }
  };

  const handleAddAnotherAccount = async () => {
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_code_verifier');
    await handleLogin(true);
  };

  const handleLogout = () => {
    tiktokApi.logout();
    setIsAuthenticated(false);
    setSelectedFile(null);
    setVideoTitle('');
    setUploadStatus('Logged out successfully');
    setTimeout(() => setUploadStatus(''), 3000);
    setAccounts([]);
    setActiveOpenId(null);
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

  const handleAccountSwitch = async (e) => {
    const openId = e.target.value;
    if (openId && await tiktokApi.useAccount(openId)) {
      setActiveOpenId(openId);
      setIsAuthenticated(tiktokApi.isAuthenticated());
    }
  };

  const goToUploadView = () => setView('upload');
  const goToAccountsView = () => setView('accounts');



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
      const initResult = await tiktokApi.initializeUpload(selectedFile, videoTitle, '', "SELF_ONLY");
      
      if (!initResult.success) {
        throw new Error(JSON.stringify(initResult.error));
      }

      const { publish_id, upload_url } = initResult.data;
      
      setUploadStatus('Uploading video...');
      const uploadResult = await tiktokApi.uploadVideo(upload_url, selectedFile);
      
      if (!uploadResult.success) {
        throw new Error(JSON.stringify(uploadResult.error));
      }

      setUploadStatus('Processing upload...');
      
      let attempts = 0;
      const maxAttempts = 120;
      const checkStatus = async () => {
        const statusResult = await tiktokApi.publishVideo(publish_id);
        
        if (statusResult.success) {
          const status = statusResult.data.status;
          const uploadedBytes = statusResult.data.uploaded_bytes || 0;
          const failReason = statusResult.data.fail_reason;
          
          if (status === 'PUBLISH_COMPLETE') {
            setUploadStatus('✅ Video posted successfully! It\'s set to Private (only you can see it). Go to your TikTok profile to view it.');
            setSelectedFile(null);
            setVideoTitle('');
            setUploading(false);
            return;
          } else if (status === 'SEND_TO_USER_INBOX') {
            setSelectedFile(null);
            setVideoTitle('');
            setUploading(false);
            return;
          } else if (status === 'FAILED') {
            throw new Error(`Upload failed: ${failReason || 'Unknown reason'}`);
          } else if (status === 'PROCESSING_UPLOAD') {
            if (attempts < maxAttempts) {
              attempts++;
              const progress = uploadedBytes > 0 ? ` (${Math.round(uploadedBytes / selectedFile.size * 100)}%)` : '';
              setUploadStatus(`Processing upload${progress}... (${attempts}/${maxAttempts})`);
              setTimeout(checkStatus, 5000);
            } else {
              setUploadStatus('✅ Upload complete! Video is being processed by TikTok. Check your TikTok app inbox/notifications in the next few minutes.');
              setSelectedFile(null);
              setVideoTitle('');
              setUploading(false);
            }
          } else {
            if (attempts < maxAttempts) {
              attempts++;
              setUploadStatus(`Status: ${status}... (${attempts}/${maxAttempts})`);
              setTimeout(checkStatus, 5000);
            } else {
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
      setError('Upload failed: ' + err.message);
      setUploading(false);
      setUploadStatus('');
    }
  };

  // Always show Accounts Management first
  if (view === 'accounts') {
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
                Account Management
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                Manage connected TikTok accounts and open the uploader.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={goToUploadView}
                style={{
                  background: '#4fd1c5',
                  color: '#0b1c2d',
                  border: '1px solid #111827',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#0b1c2d';
                  e.target.style.color = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#4fd1c5';
                  e.target.style.color = '#0b1c2d';
                }}
              >
                Go to Upload
              </button>
              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  color: '#111827',
                  border: '1px solid #111827',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#111827';
                  e.target.style.color = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#111827';
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
              border: '1px solid #111827',
              background: '#e5e7eb',
              color: '#111827',
              fontSize: '13px'
            }}>
              {uploadStatus}
            </div>
          )}

          {error && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              border: '1px solid #111827',
              background: '#ffffff',
              color: '#111827',
              fontSize: '13px',
              whiteSpace: 'pre-line'
            }}>
              {error}
            </div>
          )}

          {accounts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', border: '1px solid #111827', background: '#e5e7eb' }}>
              <p style={{ color: '#6b7280', marginBottom: '16px', fontSize: '13px' }}>
                No accounts connected yet. Add your first TikTok account to get started.
              </p>
              <button
                onClick={() => handleLogin(false)}
                style={{
                  background: '#4fd1c5',
                  color: '#0b1c2d',
                  border: '1px solid #111827',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#0b1c2d';
                  e.target.style.color = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#4fd1c5';
                  e.target.style.color = '#0b1c2d';
                }}
              >
                Add Your First Account
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                {accounts.map(acc => {
                  const expiry = formatExpiry(acc.expires_at);
                  const isActive = activeOpenId === acc.open_id;

                  return (
                    <div
                      key={acc.open_id}
                      onClick={() => {
                        const select = { target: { value: acc.open_id } };
                        handleAccountSwitch(select);
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
                        {acc.avatar_url ? (
                          <img
                            src={acc.avatar_url}
                            alt={acc.display_name}
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
                            {(acc.display_name || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#111827', fontSize: '14px', marginBottom: '4px' }}>
                            {acc.display_name || 'TikTok User'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            ID: {acc.open_id.substring(0, 22)}...
                          </div>
                          {expiry && (
                            <div style={{ fontSize: '12px', color: expiry.color, marginTop: '4px', fontWeight: 500 }}>
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
                          if (window.confirm(`Remove ${acc.display_name || 'this account'}?`)) {
                            await tiktokApi.removeAccount(acc.open_id);
                            await loadAccountsFromDB();
                            if (activeOpenId === acc.open_id) {
                              const remaining = tiktokApi.getAccounts();
                              if (remaining.length > 0) {
                                tiktokApi.useAccount(remaining[0].open_id);
                                setActiveOpenId(remaining[0].open_id);
                              } else {
                                setActiveOpenId(null);
                                setIsAuthenticated(false);
                              }
                            }
                          }
                        }}
                        disabled={uploading}
                        style={{
                          background: 'transparent',
                          color: '#111827',
                          border: '1px solid #111827',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background 0.2s, color 0.2s',
                          opacity: uploading ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!uploading) {
                            e.target.style.background = '#111827';
                            e.target.style.color = '#e5e7eb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                          e.target.style.color = '#111827';
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleAddAnotherAccount}
                disabled={uploading}
                style={{
                  background: '#4fd1c5',
                  color: '#0b1c2d',
                  border: '1px solid #111827',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'background 0.2s, color 0.2s',
                  opacity: uploading ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!uploading) {
                    e.target.style.background = '#0b1c2d';
                    e.target.style.color = '#e5e7eb';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#4fd1c5';
                  e.target.style.color = '#0b1c2d';
                }}
              >
                + Add Another Account
              </button>
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
              Post a video to your selected TikTok account.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={goToAccountsView}
              style={{
                background: 'transparent',
                color: '#111827',
                border: '1px solid #111827',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#111827';
                e.target.style.color = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = '#111827';
              }}
            >
              Manage Accounts
            </button>
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                color: '#111827',
                border: '1px solid #111827',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#111827';
                e.target.style.color = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = '#111827';
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
            border: '1px solid #111827',
            background: '#e5e7eb',
            color: '#111827',
            fontSize: '13px'
          }}>
            {uploadStatus}
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px',
            marginBottom: '16px',
            border: '1px solid #111827',
            background: '#ffffff',
            color: '#111827',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: '16px' }}>
          {accounts.length > 0 && (
            <div>
              <label htmlFor="account-select" style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                Account
              </label>
              <select
                id="account-select"
                value={activeOpenId || ''}
                onChange={handleAccountSwitch}
                disabled={uploading}
                style={{
                  width: '100%',
                  background: '#e5e7eb',
                  border: '1px solid #111827',
                  padding: '10px 12px',
                  fontSize: '14px',
                  color: '#111827',
                  cursor: uploading ? 'not-allowed' : 'pointer'
                }}
              >
                {accounts.map(acc => (
                  <option key={acc.open_id} value={acc.open_id}>
                    {acc.display_name || acc.open_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="video-file" style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
              Video File
            </label>
            <input
              id="video-file"
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{
                width: '100%',
                background: '#e5e7eb',
                border: '1px solid #111827',
                padding: '10px 12px',
                fontSize: '14px',
                color: '#111827',
                cursor: uploading ? 'not-allowed' : 'pointer'
              }}
            />
            {selectedFile && (
              <div style={{
                marginTop: '10px',
                padding: '10px 12px',
                background: '#e5e7eb',
                border: '1px solid #111827'
              }}>
                <p style={{ color: '#111827', fontSize: '13px', margin: '0 0 4px 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', color: '#0b1c2d' }}>
                    <FaVideo />
                  </span>
                  {selectedFile.name}
                </p>
                <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>
                  Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="video-title" style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
              Caption
            </label>
            <textarea
              id="video-title"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Enter video caption (max 150 characters)"
              maxLength={150}
              rows={4}
              disabled={uploading}
              style={{
                width: '100%',
                background: '#e5e7eb',
                border: '1px solid #111827',
                padding: '10px 12px',
                fontSize: '14px',
                color: '#111827',
                fontFamily: 'inherit',
                resize: 'vertical',
                lineHeight: '1.5'
              }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '6px 0 0 0', textAlign: 'right' }}>
              {videoTitle.length}/150
            </p>
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || !videoTitle.trim() || uploading}
            style={{
              background: (!selectedFile || !videoTitle.trim() || uploading) ? '#e5e7eb' : '#4fd1c5',
              color: (!selectedFile || !videoTitle.trim() || uploading) ? '#6b7280' : '#0b1c2d',
              border: '1px solid #111827',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: (!selectedFile || !videoTitle.trim() || uploading) ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (selectedFile && videoTitle.trim() && !uploading) {
                e.target.style.background = '#0b1c2d';
                e.target.style.color = '#e5e7eb';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedFile && videoTitle.trim() && !uploading) {
                e.target.style.background = '#4fd1c5';
                e.target.style.color = '#0b1c2d';
              }
            }}
          >
            {uploading ? 'Uploading...' : 'Upload to TikTok'}
          </button>
        </div>
      </div>

      <div style={{
        marginTop: '24px',
        padding: '20px 24px',
        background: '#ffffff',
        border: '1px solid #111827'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#111827',
          margin: '0 0 12px 0'
        }}>
          Where to Find Your Uploaded Videos
        </h3>
        <ol style={{
          color: '#6b7280',
          fontSize: '13px',
          lineHeight: '1.7',
          paddingLeft: '20px',
          margin: '0 0 16px 0'
        }}>
          <li>Open the TikTok mobile app on your phone.</li>
          <li>Tap on Profile (bottom right icon).</li>
          <li>Look at your profile videos (they will show a lock icon).</li>
          <li>Videos are set to PRIVATE by default (only you can see them).</li>
          <li>Tap a video → Three dots → Privacy settings to change visibility.</li>
        </ol>

        <div style={{
          padding: '12px',
          background: '#e5e7eb',
          borderLeft: '3px solid #4fd1c5',
          marginBottom: '16px'
        }}>
          <p style={{
            color: '#6b7280',
            fontSize: '12px',
            lineHeight: '1.6',
            margin: 0
          }}>
            <strong style={{ color: '#111827' }}>Sandbox Mode:</strong> Videos uploaded via this sandbox app are set to PRIVATE (only visible to you). To make videos public, your app needs to complete TikTok’s audit process.
          </p>
        </div>

        <h4 style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#111827',
          margin: '0 0 8px 0'
        }}>
          Upload Requirements
        </h4>
        <ul style={{
          color: '#6b7280',
          fontSize: '13px',
          lineHeight: '1.6',
          paddingLeft: '20px',
          margin: 0
        }}>
          <li>Video format: MP4, MOV, or other common video formats</li>
          <li>Maximum file size: 4GB</li>
          <li>Recommended resolution: 720p or higher</li>
          <li>Duration: 3 seconds to 10 minutes</li>
        </ul>
      </div>
    </div>
  );
}

export default TikTokUploader;
