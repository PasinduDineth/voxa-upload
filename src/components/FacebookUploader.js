import React, { useState, useEffect } from 'react';
import facebookApi from '../services/facebookApi';

function FacebookUploader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState('accounts'); // 'accounts' | 'upload' | 'add-token'
  const [accounts, setAccounts] = useState([]);
  const [activePageId, setActivePageId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAccountsFromDB();
    setIsAuthenticated(facebookApi.isAuthenticated());
    setActivePageId(localStorage.getItem('facebook_page_id'));
    setView('accounts');
  }, []);

  const loadAccountsFromDB = async () => {
    const accs = await facebookApi.loadAccounts();
    setAccounts(accs);
  };

  const handleAddPages = async () => {
    if (!accessToken.trim()) {
      setError('Please enter your Facebook Page Access Token');
      return;
    }

    setUploadStatus('Adding your Facebook Pages...');
    setError('');

    const result = await facebookApi.addPagesWithToken(accessToken);

    if (result.success) {
      setUploadStatus(`✅ ${result.message}`);
      setAccessToken('');
      await loadAccountsFromDB();
      
      // Auto-select first page if this is the first one
      const accs = await facebookApi.loadAccounts();
      if (accs.length > 0 && !activePageId) {
        const firstPage = accs[0];
        await facebookApi.useAccount(firstPage.open_id);
        setActivePageId(firstPage.open_id);
        setIsAuthenticated(true);
      }
      
      setTimeout(() => {
        setUploadStatus('');
        setView('accounts');
      }, 3000);
    } else {
      setError('Failed to add pages: ' + result.error);
      setUploadStatus('');
    }
  };

  const handleAccountSwitch = async (e) => {
    const pageId = e.target.value;
    if (pageId && await facebookApi.useAccount(pageId)) {
      setActivePageId(pageId);
      setIsAuthenticated(facebookApi.isAuthenticated());
    }
  };

  const goToUploadView = () => setView('upload');
  const goToAccountsView = () => setView('accounts');
  const goToAddTokenView = () => {
    setView('add-token');
    setError('');
    setUploadStatus('');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file');
        return;
      }
      
      const maxSize = 1024 * 1024 * 1024; // 1GB
      if (file.size > maxSize) {
        setError(`File size must be less than 1GB (current: ${Math.round(file.size / 1024 / 1024)}MB)`);
        return;
      }
      
      setSelectedFile(file);
      setError('');
    }
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
    setUploadStatus('Uploading to Facebook Page...');
    setError('');

    try {
      const result = await facebookApi.uploadVideo(selectedFile, videoTitle, description);

      if (result.success) {
        setUploadStatus('✅ Video uploaded successfully to Facebook!');
        setSelectedFile(null);
        setVideoTitle('');
        setDescription('');
        setTimeout(() => setUploadStatus(''), 5000);
      } else {
        setError('Upload failed: ' + JSON.stringify(result.error));
      }
    } catch (err) {
      setError('Unexpected error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAccount = async (pageId) => {
    if (window.confirm('Are you sure you want to remove this Facebook Page?')) {
      await facebookApi.removeAccount(pageId);
      await loadAccountsFromDB();
      
      if (activePageId === pageId) {
        setActivePageId(null);
        setIsAuthenticated(false);
      }
    }
  };

  const activeAccount = accounts.find(acc => acc.open_id === activePageId);

  return (
    <div style={{
      maxWidth: '960px',
      margin: '0 auto',
      color: '#111827'
    }}>
      {/* Main Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #111827',
        padding: '24px 32px',
        maxWidth: '840px',
        margin: '0 auto'
      }}>
        {/* Card Header */}
        <div style={{
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: '0 0 6px 0' }}>
              {view === 'accounts' && 'Page Management'}
              {view === 'add-token' && 'Add Facebook Pages'}
              {view === 'upload' && 'Upload to Facebook'}
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              {view === 'accounts' && 'Manage connected Facebook pages and select an active page.'}
              {view === 'add-token' && 'Add Facebook Pages with a Page Access Token.'}
              {view === 'upload' && 'Upload a video to your selected Facebook page.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {view !== 'accounts' && (
              <button
                onClick={goToAccountsView}
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
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#111827';
                  e.currentTarget.style.color = '#e5e7eb';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#111827';
                }}
              >
                ← Back to Pages
              </button>
            )}
            {view === 'accounts' && (
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
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#0b1c2d';
                  e.currentTarget.style.color = '#e5e7eb';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#4fd1c5';
                  e.currentTarget.style.color = '#0b1c2d';
                }}
              >
                Go to Upload
              </button>
            )}
          </div>
        </div>

        {/* Card Content */}
        <div>
          {/* Status Messages */}
          {uploadStatus && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              background: '#e5e7eb',
              color: '#111827',
              border: '1px solid #111827',
              fontSize: '13px',
              fontWeight: 600
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
              fontWeight: 600,
              whiteSpace: 'pre-line'
            }}>
              {error}
            </div>
          )}

          {/* Accounts View */}
          {view === 'accounts' && (
            <>
              {accounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', border: '1px solid #111827', background: '#e5e7eb' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>📘</div>
                  <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
                    No Facebook Pages connected yet
                  </p>
                  <button
                    onClick={goToAddTokenView}
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
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#0b1c2d';
                      e.currentTarget.style.color = '#e5e7eb';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#4fd1c5';
                      e.currentTarget.style.color = '#0b1c2d';
                    }}
                  >
                    Add Facebook Pages
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                    {accounts.map(account => {
                      const isActive = activePageId === account.open_id;
                      const expiry = formatExpiry(account.expires_at);
                      return (
                        <div
                          key={account.open_id}
                          style={{
                            background: '#e5e7eb',
                            border: '1px solid #111827',
                            borderLeft: isActive ? '4px solid #4fd1c5' : '4px solid #111827',
                            padding: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            gap: '12px'
                          }}
                          onClick={async () => {
                            if (await facebookApi.useAccount(account.open_id)) {
                              setActivePageId(account.open_id);
                              setIsAuthenticated(true);
                            }
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              e.currentTarget.style.background = '#d1d5db';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              e.currentTarget.style.background = '#e5e7eb';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                            {account.avatar_url ? (
                              <img
                                src={account.avatar_url}
                                alt={account.display_name}
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
                                {(account.display_name || 'F')[0].toUpperCase()}
                              </div>
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                                {account.display_name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                Page ID: {account.open_id}
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
                            onClick={e => {
                              e.stopPropagation();
                              handleRemoveAccount(account.open_id);
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
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#111827';
                              e.currentTarget.style.color = '#e5e7eb';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#111827';
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={goToAddTokenView}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: '#4fd1c5',
                        color: '#0b1c2d',
                        border: '1px solid #111827',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background 0.2s, color 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#0b1c2d';
                        e.currentTarget.style.color = '#e5e7eb';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = '#4fd1c5';
                        e.currentTarget.style.color = '#0b1c2d';
                      }}
                    >
                      Add More Pages
                    </button>
                    {isAuthenticated && (
                      <button
                        onClick={goToUploadView}
                        style={{
                          flex: 1,
                          padding: '10px',
                          background: '#4fd1c5',
                          color: '#0b1c2d',
                          border: '1px solid #111827',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background 0.2s, color 0.2s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#0b1c2d';
                          e.currentTarget.style.color = '#e5e7eb';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = '#4fd1c5';
                          e.currentTarget.style.color = '#0b1c2d';
                        }}
                      >
                        Go to Upload
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Add Token View */}
          {view === 'add-token' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{
                padding: '16px',
                background: '#ffffff',
                borderLeft: '3px solid #4fd1c5',
                marginBottom: '20px',
                border: '1px solid #111827'
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#111827', fontSize: '16px' }}>
                  How to get your Page Access Token
                </h3>
                <ol style={{ margin: 0, paddingLeft: '20px', color: '#6b7280', fontSize: '13px', lineHeight: '1.7' }}>
                  <li style={{ marginBottom: '10px' }}>
                    Go to <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color: '#4fd1c5', fontWeight: 600 }}>Facebook Graph API Explorer</a>
                  </li>
                  <li style={{ marginBottom: '10px' }}>
                    Select your Facebook App from the dropdown
                  </li>
                  <li style={{ marginBottom: '10px' }}>
                    Click "Generate Access Token" and select all your pages
                  </li>
                  <li style={{ marginBottom: '10px' }}>
                    Grant the required permissions (pages_manage_posts, pages_read_engagement)
                  </li>
                  <li>Copy the generated token and paste it below</li>
                </ol>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
                  Facebook Page Access Token *
                </label>
                <textarea
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  placeholder="Paste your Facebook Page Access Token here..."
                  rows={4}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    padding: '12px',
                    border: '1px solid #111827',
                    background: '#e5e7eb',
                    color: '#111827'
                  }}
                />
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                  This token will be used to fetch and connect all your Facebook Pages
                </p>
              </div>
              <button
                onClick={handleAddPages}
                disabled={!accessToken.trim()}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: !accessToken.trim() ? '#e5e7eb' : '#4fd1c5',
                  color: !accessToken.trim() ? '#6b7280' : '#0b1c2d',
                  border: '1px solid #111827',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: !accessToken.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  opacity: !accessToken.trim() ? 0.7 : 1
                }}
                onMouseEnter={e => {
                  if (accessToken.trim()) {
                    e.currentTarget.style.background = '#0b1c2d';
                    e.currentTarget.style.color = '#e5e7eb';
                  }
                }}
                onMouseLeave={e => {
                  if (accessToken.trim()) {
                    e.currentTarget.style.background = '#4fd1c5';
                    e.currentTarget.style.color = '#0b1c2d';
                  }
                }}
              >
                Add Facebook Pages
              </button>
            </div>
          )}

          {/* Upload View */}
          {view === 'upload' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              {activeAccount && (
                <div style={{
                  padding: '12px',
                  background: '#e5e7eb',
                  border: '1px solid #111827',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  {activeAccount.avatar_url && (
                    <img
                      src={activeAccount.avatar_url}
                      alt={activeAccount.display_name}
                      style={{
                        width: '44px',
                        height: '44px',
                        objectFit: 'cover'
                      }}
                    />
                  )}
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 600, color: '#111827', fontSize: '12px' }}>
                      Posting as:
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#111827', fontWeight: 600 }}>
                      {activeAccount.display_name}
                    </p>
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
                  Video File
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
                    marginTop: '12px',
                    padding: '10px',
                    background: '#e5e7eb',
                    border: '1px solid #111827',
                    fontSize: '13px',
                    color: '#6b7280'
                  }}>
                    <p style={{ margin: '0 0 4px 0' }}>📹 {selectedFile.name}</p>
                    <p style={{ margin: 0 }}>Size: {Math.round(selectedFile.size / 1024 / 1024)}MB</p>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
                  Video Title *
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={e => setVideoTitle(e.target.value)}
                  placeholder="Enter video title..."
                  disabled={uploading}
                  maxLength={100}
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
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  disabled={uploading}
                  rows={4}
                  maxLength={500}
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
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !videoTitle.trim()}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: (!selectedFile || !videoTitle.trim() || uploading) ? '#e5e7eb' : '#4fd1c5',
                  color: (!selectedFile || !videoTitle.trim() || uploading) ? '#6b7280' : '#0b1c2d',
                  border: '1px solid #111827',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: (!selectedFile || !videoTitle.trim() || uploading) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  opacity: (!selectedFile || !videoTitle.trim() || uploading) ? 0.7 : 1
                }}
                onMouseEnter={e => {
                  if (selectedFile && videoTitle.trim() && !uploading) {
                    e.currentTarget.style.background = '#0b1c2d';
                    e.currentTarget.style.color = '#e5e7eb';
                  }
                }}
                onMouseLeave={e => {
                  if (selectedFile && videoTitle.trim() && !uploading) {
                    e.currentTarget.style.background = '#4fd1c5';
                    e.currentTarget.style.color = '#0b1c2d';
                  }
                }}
              >
                {uploading ? 'Uploading...' : 'Upload to Facebook Page'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FacebookUploader;
