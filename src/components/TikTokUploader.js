import React, { useState, useEffect } from 'react';
import tiktokApi from '../services/tiktokApi';
import PageHeader from './Layout/PageHeader';
import './TikTokUploader.css';

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
    
    if (diffMs < 0) return { text: '⚠️ Expired', color: '#ef4444' };
    if (diffDays > 30) return { text: `✅ ${diffDays} days`, color: '#10b981' };
    if (diffDays > 0) return { text: `⏳ ${diffDays}d ${diffHours % 24}h`, color: '#f59e0b' };
    if (diffHours > 0) return { text: `⏳ ${diffHours}h ${diffMins % 60}m`, color: '#f59e0b' };
    if (diffMins > 0) return { text: `⚠️ ${diffMins}m`, color: '#ef4444' };
    return { text: '⚠️ Soon', color: '#ef4444' };
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
      <div style={{ 
        minHeight: '100vh',
        background: '#020617',
        fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px' }}>
          {/* Page Header */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: 600, 
              color: '#E5E7EB', 
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ color: '#6366F1' }}>🎵</span>
              TikTok Account Management
            </h1>
            <p style={{ fontSize: '15px', color: '#9CA3AF', margin: 0 }}>
              Manage your connected TikTok accounts and switch between them
            </p>
          </div>

          {/* Main Card */}
          <div style={{ 
            background: '#0F172A',
            border: '1px solid #1F2937',
            borderRadius: '20px',
            padding: '32px'
          }}>
            {/* Card Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '32px',
              paddingBottom: '24px',
              borderBottom: '1px solid #1F2937'
            }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: 600, 
                color: '#E5E7EB',
                margin: 0
              }}>
                Connected Accounts
              </h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={goToUploadView}
                  style={{
                    background: '#6366F1',
                    color: '#F9FAFB',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#4F46E5';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#6366F1';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  Go to Upload →
                </button>
                <button 
                  onClick={handleLogout}
                  style={{
                    background: 'transparent',
                    color: '#EF4444',
                    border: '1px solid #EF4444',
                    borderRadius: '9999px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#EF4444';
                    e.target.style.color = '#F9FAFB';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#EF4444';
                  }}
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Account Content */}
            {accounts.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px',
                background: '#020617',
                borderRadius: '16px',
                border: '2px dashed #1F2937'
              }}>
                <div style={{ 
                  fontSize: '48px', 
                  marginBottom: '16px',
                  opacity: 0.5
                }}>🎵</div>
                <p style={{ 
                  color: '#9CA3AF', 
                  marginBottom: '24px',
                  fontSize: '15px'
                }}>
                  No accounts connected yet. Add your first TikTok account to get started.
                </p>
                <button 
                  onClick={() => handleLogin(false)}
                  style={{
                    background: '#6366F1',
                    color: '#F9FAFB',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '12px 32px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#4F46E5';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#6366F1';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  Add Your First Account
                </button>
              </div>
            ) : (
              <div>
                <div style={{ 
                  display: 'grid',
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  {accounts.map(acc => (
                    <div 
                      key={acc.open_id}
                      onClick={() => {
                        const select = { target: { value: acc.open_id } };
                        handleAccountSwitch(select);
                      }}
                      style={{
                        background: activeOpenId === acc.open_id ? '#111827' : '#020617',
                        border: activeOpenId === acc.open_id ? '1px solid #6366F1' : '1px solid #1F2937',
                        borderLeft: activeOpenId === acc.open_id ? '4px solid #6366F1' : '4px solid transparent',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseEnter={(e) => {
                        if (activeOpenId !== acc.open_id) {
                          e.currentTarget.style.background = '#0B1120';
                          e.currentTarget.style.borderColor = '#374151';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeOpenId !== acc.open_id) {
                          e.currentTarget.style.background = '#020617';
                          e.currentTarget.style.borderColor = '#1F2937';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        {acc.avatar_url ? (
                          <img 
                            src={acc.avatar_url} 
                            alt={acc.display_name}
                            style={{ 
                              width: '48px', 
                              height: '48px', 
                              borderRadius: '50%', 
                              objectFit: 'cover',
                              border: '2px solid #1F2937'
                            }}
                          />
                        ) : (
                          <div style={{ 
                            width: '48px', 
                            height: '48px', 
                            borderRadius: '50%', 
                            background: '#6366F1', 
                            color: 'white', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '20px', 
                            fontWeight: 600 
                          }}>
                            {(acc.display_name || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontWeight: 600, 
                            color: '#E5E7EB',
                            fontSize: '15px',
                            marginBottom: '4px'
                          }}>
                            {acc.display_name || 'TikTok User'}
                          </div>
                          <div style={{ 
                            fontSize: '13px', 
                            color: '#6B7280',
                            marginBottom: '4px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {acc.open_id.substring(0, 25)}...
                          </div>
                          {(() => {
                            const expiry = formatExpiry(acc.expires_at);
                            return expiry ? (
                              <div style={{ 
                                fontSize: '12px', 
                                color: expiry.color,
                                fontWeight: 500
                              }}>
                                {expiry.text}
                              </div>
                            ) : null;
                          })()}
                        </div>
                        {activeOpenId === acc.open_id && (
                          <div style={{ 
                            background: '#022C22', 
                            color: '#22C55E', 
                            padding: '4px 12px', 
                            borderRadius: '9999px', 
                            fontSize: '12px', 
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
                          color: '#EF4444',
                          border: '1px solid #EF4444',
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          marginLeft: '16px',
                          transition: 'all 0.2s',
                          opacity: uploading ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!uploading) {
                            e.target.style.background = '#EF4444';
                            e.target.style.color = '#F9FAFB';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                          e.target.style.color = '#EF4444';
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={handleAddAnotherAccount}
                  disabled={uploading}
                  style={{
                    background: '#6366F1',
                    color: '#F9FAFB',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.2s',
                    opacity: uploading ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!uploading) {
                      e.target.style.background = '#4F46E5';
                      e.target.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#6366F1';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  + Add Another Account
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              marginTop: '24px',
              padding: '16px 20px',
              background: '#7F1D1D',
              border: '1px solid #991B1B',
              borderRadius: '12px',
              color: '#FEE2E2',
              fontSize: '14px',
              lineHeight: '1.5',
              whiteSpace: 'pre-line'
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#020617',
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 600, 
            color: '#E5E7EB', 
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ color: '#6366F1' }}>🎵</span>
            TikTok Video Upload
          </h1>
          <p style={{ fontSize: '15px', color: '#9CA3AF', margin: 0 }}>
            Upload your video to TikTok
          </p>
        </div>

        {/* Main Upload Card */}
        <div style={{ 
          background: '#0F172A',
          border: '1px solid #1F2937',
          borderRadius: '20px',
          padding: '32px'
        }}>
          {/* Card Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '32px',
            paddingBottom: '24px',
            borderBottom: '1px solid #1F2937'
          }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: 600, 
              color: '#E5E7EB',
              margin: 0
            }}>
              Upload Video
            </h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={goToAccountsView}
                style={{
                  background: 'transparent',
                  color: '#9CA3AF',
                  border: '1px solid #1F2937',
                  borderRadius: '9999px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#6366F1';
                  e.target.style.color = '#E5E7EB';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#1F2937';
                  e.target.style.color = '#9CA3AF';
                }}
              >
                ← Manage Accounts
              </button>
              <button 
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  color: '#EF4444',
                  border: '1px solid #EF4444',
                  borderRadius: '9999px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#EF4444';
                  e.target.style.color = '#F9FAFB';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#EF4444';
                }}
              >
                Logout
              </button>
            </div>
          </div>

          {/* Upload Form */}
          <div style={{ display: 'grid', gap: '24px' }}>
            {/* Account Select */}
            {accounts.length > 0 && (
              <div>
                <label 
                  htmlFor="account-select"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#9CA3AF',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Account
                </label>
                <select
                  id="account-select"
                  value={activeOpenId || ''}
                  onChange={handleAccountSwitch}
                  disabled={uploading}
                  style={{
                    width: '100%',
                    background: '#020617',
                    border: '1px solid #1F2937',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    color: '#E5E7EB',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#6366F1';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#1F2937';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  {accounts.map(acc => (
                    <option key={acc.open_id} value={acc.open_id}>
                      {acc.display_name || acc.open_id}
                    </option>
                  ))}
                </select>
                <p style={{ 
                  fontSize: '13px', 
                  color: '#6B7280',
                  marginTop: '8px',
                  margin: '8px 0 0 0'
                }}>
                  Select which TikTok account to use for this upload
                </p>
              </div>
            )}

            {/* Video File Input */}
            <div>
              <label 
                htmlFor="video-file"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#9CA3AF',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
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
                  background: '#020617',
                  border: '1px solid #1F2937',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: '#E5E7EB',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              />
              {selectedFile && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px 16px',
                  background: '#111827',
                  border: '1px solid #1F2937',
                  borderRadius: '10px',
                }}>
                  <p style={{ 
                    color: '#E5E7EB', 
                    fontSize: '14px',
                    margin: '0 0 4px 0',
                    fontWeight: 500
                  }}>
                    📹 {selectedFile.name}
                  </p>
                  <p style={{ 
                    color: '#6B7280',
                    fontSize: '13px',
                    margin: 0
                  }}>
                    Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

            {/* Caption */}
            <div>
              <label 
                htmlFor="video-title"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#9CA3AF',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
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
                  background: '#020617',
                  border: '1px solid #1F2937',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: '#E5E7EB',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'all 0.2s',
                  lineHeight: '1.5'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366F1';
                  e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#1F2937';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <p style={{ 
                fontSize: '13px', 
                color: '#6B7280',
                marginTop: '8px',
                margin: '8px 0 0 0',
                textAlign: 'right'
              }}>
                {videoTitle.length}/150
              </p>
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !videoTitle.trim() || uploading}
              style={{
                background: (!selectedFile || !videoTitle.trim() || uploading) ? '#374151' : '#6366F1',
                color: (!selectedFile || !videoTitle.trim() || uploading) ? '#6B7280' : '#F9FAFB',
                border: 'none',
                borderRadius: '12px',
                padding: '16px 24px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: (!selectedFile || !videoTitle.trim() || uploading) ? 'not-allowed' : 'pointer',
                width: '100%',
                transition: 'all 0.2s',
                marginTop: '8px'
              }}
              onMouseEnter={(e) => {
                if (selectedFile && videoTitle.trim() && !uploading) {
                  e.target.style.background = '#4F46E5';
                  e.target.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedFile && videoTitle.trim() && !uploading) {
                  e.target.style.background = '#6366F1';
                  e.target.style.transform = 'translateY(0)';
                }
              }}
            >
              {uploading ? '⏳ Uploading...' : '🚀 Upload to TikTok'}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {uploadStatus && (
          <div style={{
            marginTop: '24px',
            padding: '16px 20px',
            background: '#064E3B',
            border: '1px solid #065F46',
            borderRadius: '12px',
            color: '#D1FAE5',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            {uploadStatus}
          </div>
        )}

        {error && (
          <div style={{
            marginTop: '24px',
            padding: '16px 20px',
            background: '#7F1D1D',
            border: '1px solid #991B1B',
            borderRadius: '12px',
            color: '#FEE2E2',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            {error}
          </div>
        )}

        {/* Info Section */}
        <div style={{
          marginTop: '32px',
          padding: '24px',
          background: '#0F172A',
          border: '1px solid #1F2937',
          borderRadius: '16px'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#E5E7EB',
            marginBottom: '16px',
            margin: '0 0 16px 0'
          }}>
            📱 Where to Find Your Uploaded Videos
          </h3>
          <ol style={{
            color: '#9CA3AF',
            fontSize: '14px',
            lineHeight: '1.8',
            paddingLeft: '20px',
            margin: '0 0 20px 0'
          }}>
            <li style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#E5E7EB' }}>Open the TikTok mobile app</strong> on your phone
            </li>
            <li style={{ marginBottom: '8px' }}>
              Tap on <strong style={{ color: '#E5E7EB' }}>Profile</strong> (bottom right icon)
            </li>
            <li style={{ marginBottom: '8px' }}>
              Look at your profile videos (they'll show a 🔒 lock icon)
            </li>
            <li style={{ marginBottom: '8px' }}>
              Your videos are automatically set to <strong style={{ color: '#E5E7EB' }}>PRIVATE</strong> (only you can see them)
            </li>
            <li>
              Tap on a video → Three dots (...) → Privacy settings to change visibility
            </li>
          </ol>
          
          <div style={{
            padding: '16px',
            background: '#422006',
            border: '1px solid #78350F',
            borderRadius: '10px',
            marginBottom: '20px'
          }}>
            <p style={{
              color: '#FED7AA',
              fontSize: '13px',
              lineHeight: '1.6',
              margin: 0
            }}>
              <strong style={{ color: '#FDBA74' }}>⚠️ Sandbox Mode:</strong> All videos uploaded via this sandbox app are automatically set to PRIVATE (only visible to you). 
              This is a TikTok restriction for unapproved apps. To make videos public, your app needs to complete TikTok's audit process.
            </p>
          </div>

          <h4 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#E5E7EB',
            marginBottom: '12px',
            margin: '0 0 12px 0'
          }}>
            Upload Requirements
          </h4>
          <ul style={{
            color: '#9CA3AF',
            fontSize: '14px',
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
    </div>
  );
}

export default TikTokUploader;
