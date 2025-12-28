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
    
    if (diffMs < 0) return { text: '⚠️ Expired', color: '#ef4444' };
    if (diffDays > 30) return { text: `✅ ${diffDays} days`, color: '#10b981' };
    if (diffDays > 0) return { text: `⏳ ${diffDays}d ${diffHours % 24}h`, color: '#f59e0b' };
    if (diffHours > 0) return { text: `⏳ ${diffHours}h ${diffMins % 60}m`, color: '#f59e0b' };
    if (diffMins > 0) return { text: `⚠️ ${diffMins}m`, color: '#ef4444' };
    return { text: '⚠️ Soon', color: '#ef4444' };
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
      minHeight: '100vh',
      background: '#0b1c2d',
      padding: '40px',
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#e5e7eb'
    }}>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '32px' }}>📘</span>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#e5e7eb', margin: 0 }}>
            Facebook Uploader
          </h1>
        </div>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
          Manage your Facebook pages and upload videos
        </p>
      </div>

      {/* Main Card */}
      <div style={{
        background: '#111827',
        border: '1px solid #4fd1c5',
        borderRadius: '12px',
        overflow: 'hidden',
        maxWidth: '900px'
      }}>
        {/* Card Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #4fd1c5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#e5e7eb', margin: 0 }}>
            {view === 'accounts' && 'Page Management'}
            {view === 'add-token' && 'Add Facebook Pages'}
            {view === 'upload' && 'Upload to Facebook'}
          </h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            {view !== 'accounts' && (
              <button
                onClick={goToAccountsView}
                style={{
                  padding: '10px 20px',
                  background: '#374151',
                  color: '#e5e7eb',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#4B5563'}
                onMouseLeave={e => e.currentTarget.style.background = '#374151'}
              >
                ← Back to Pages
              </button>
            )}
            {view === 'accounts' && (
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
                onMouseEnter={e => e.currentTarget.style.background = '#5558E3'}
                onMouseLeave={e => e.currentTarget.style.background = '#6366F1'}
              >
                Go to Upload
              </button>
            )}
          </div>
        </div>

        {/* Card Content */}
        <div style={{ padding: '24px' }}>
          {/* Status Messages */}
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

          {/* Accounts View */}
          {view === 'accounts' && (
            <>
              {accounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📘</div>
                  <p style={{ fontSize: '16px', color: '#9CA3AF', marginBottom: '24px' }}>
                    No Facebook Pages connected yet
                  </p>
                  <button
                    onClick={goToAddTokenView}
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
                    onMouseEnter={e => e.currentTarget.style.background = '#5558E3'}
                    onMouseLeave={e => e.currentTarget.style.background = '#6366F1'}
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
                            background: '#1E293B',
                            border: isActive ? '1px solid #6366F1' : '1px solid #374151',
                            borderLeft: isActive ? '4px solid #6366F1' : '4px solid transparent',
                            borderRadius: '10px',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onClick={async () => {
                            if (await facebookApi.useAccount(account.open_id)) {
                              setActivePageId(account.open_id);
                              setIsAuthenticated(true);
                            }
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              e.currentTarget.style.background = '#2D3B52';
                              e.currentTarget.style.borderColor = '#4B5563';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              e.currentTarget.style.background = '#1E293B';
                              e.currentTarget.style.borderColor = '#374151';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                            {account.avatar_url && (
                              <img
                                src={account.avatar_url}
                                alt={account.display_name}
                                style={{
                                  width: '48px',
                                  height: '48px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '3px solid #1877f2'
                                }}
                              />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', fontWeight: 500, color: '#e5e7eb', marginBottom: '4px' }}>
                                {account.display_name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                Page ID: {account.open_id}
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
                                background: '#1877f2',
                                color: '#FFFFFF',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 500
                              }}>
                                ✓ Active
                              </div>
                            )}
                          </div>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleRemoveAccount(account.open_id);
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
                            onMouseEnter={e => e.currentTarget.style.background = '#DC2626'}
                            onMouseLeave={e => e.currentTarget.style.background = '#EF4444'}
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
                        padding: '12px',
                        background: '#374151',
                        color: '#e5e7eb',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#4B5563'}
                      onMouseLeave={e => e.currentTarget.style.background = '#374151'}
                    >
                      Add More Pages
                    </button>
                    {isAuthenticated && (
                      <button
                        onClick={goToUploadView}
                        style={{
                          flex: 1,
                          padding: '12px',
                          background: '#6366F1',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#5558E3'}
                        onMouseLeave={e => e.currentTarget.style.background = '#6366F1'}
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
                padding: '20px',
                background: '#e7f3ff',
                borderRadius: '12px',
                marginBottom: '20px',
                border: '2px solid #1877f2'
              }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#1877f2' }}>
                  📝 How to get your Page Access Token:
                </h3>
                <ol style={{ margin: 0, paddingLeft: '20px', color: '#333' }}>
                  <li style={{ marginBottom: '10px' }}>
                    Go to <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color: '#1877f2', fontWeight: 600 }}>Facebook Graph API Explorer</a>
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
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#1E293B' }}>
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
                    borderRadius: '8px',
                    border: '1px solid #1877f2',
                    background: '#f9fafb',
                    color: '#1E293B',
                    outline: 'none'
                  }}
                />
                <p style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
                  This token will be used to fetch and connect all your Facebook Pages
                </p>
              </div>
              <button
                onClick={handleAddPages}
                disabled={!accessToken.trim()}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: !accessToken.trim() ? '#374151' : '#6366F1',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: !accessToken.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: !accessToken.trim() ? 0.5 : 1
                }}
                onMouseEnter={e => {
                  if (accessToken.trim()) e.currentTarget.style.background = '#5558E3';
                }}
                onMouseLeave={e => {
                  if (accessToken.trim()) e.currentTarget.style.background = '#6366F1';
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
                  padding: '15px',
                  background: '#e7f3ff',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}>
                  {activeAccount.avatar_url && (
                    <img
                      src={activeAccount.avatar_url}
                      alt={activeAccount.display_name}
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid #1877f2'
                      }}
                    />
                  )}
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 600, color: '#1877f2' }}>
                      Posting as:
                    </p>
                    <p style={{ margin: 0, fontSize: '16px', color: '#333' }}>
                      {activeAccount.display_name}
                    </p>
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#e5e7eb' }}>
                  Video File
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
                    color: '#e5e7eb',
                    fontSize: '14px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    outline: 'none'
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
                    <p style={{ margin: 0 }}>Size: {Math.round(selectedFile.size / 1024 / 1024)}MB</p>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#e5e7eb' }}>
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
                    padding: '12px 16px',
                    background: '#1E293B',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#e5e7eb',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#e5e7eb' }}>
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
                    padding: '12px 16px',
                    background: '#1E293B',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#e5e7eb',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !videoTitle.trim()}
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
                onMouseEnter={e => {
                  if (selectedFile && videoTitle.trim() && !uploading) {
                    e.currentTarget.style.background = '#5558E3';
                  }
                }}
                onMouseLeave={e => {
                  if (selectedFile && videoTitle.trim() && !uploading) {
                    e.currentTarget.style.background = '#6366F1';
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
