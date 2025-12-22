import React, { useState, useEffect } from 'react';
import tiktokApi from '../services/tiktokApi';
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
    // Load accounts from database
    loadAccountsFromDB();
    
    // Check if user is authenticated
    setIsAuthenticated(tiktokApi.isAuthenticated());
    setActiveOpenId(localStorage.getItem('tiktok_open_id'));
    setView('accounts');

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      console.log('[Component] OAuth callback detected', { has_code: !!code, has_state: !!state });
      handleOAuthCallback(code, state);
    }
  }, []);

  const loadAccountsFromDB = async () => {
    const accs = await tiktokApi.loadAccounts();
    setAccounts(accs);
  };

  const handleOAuthCallback = async (code, state) => {
    console.log('[Component] Handling OAuth callback', { has_code: !!code, has_state: !!state });
    setUploadStatus('Authenticating...');
    
    const isAddingAccount = sessionStorage.getItem('oauth_adding_account') === 'true';
    
    const result = await tiktokApi.getAccessToken(code, state);
    
    if (result.success) {
      console.log('[Component] OAuth callback successful', result.data);
      
      // Check if this is the same account trying to be added again
      const existingAccount = accounts.find(acc => acc.open_id === result.data.open_id);
      
      if (isAddingAccount && existingAccount) {
        // Same account was re-authenticated instead of adding a new one
        setError('⚠️ Same account detected! To add a different account, please:\n1. Log out of TikTok in your browser first\n2. Or use an incognito/private window\n3. Then click "Add Another Account" again');
        setUploadStatus('');
        
        // Clean up
        sessionStorage.removeItem('oauth_adding_account');
        window.history.replaceState({}, document.title, '/');
        
        setTimeout(() => setError(''), 10000);
        return;
      }
      
      // Clean up the flag
      sessionStorage.removeItem('oauth_adding_account');
      
      // Reload accounts from database
      await loadAccountsFromDB();
      
      // Auto-select the newly added account
      const newOpenId = result.data.open_id;
      if (await tiktokApi.useAccount(newOpenId)) {
        setActiveOpenId(newOpenId);
        setIsAuthenticated(true);
        console.log('[Component] Switched to new account', { open_id: newOpenId });
      }
      
      if (isAddingAccount && !existingAccount) {
        setUploadStatus('✅ New account added successfully!');
      } else {
        setUploadStatus(result.data.message || 'Authentication successful!');
      }
      
      // Clean up URL
      window.history.replaceState({}, document.title, '/');
    } else {
      console.error('[Component] OAuth callback failed', result.error);
      setError('Authentication failed: ' + JSON.stringify(result.error));
      sessionStorage.removeItem('oauth_adding_account');
    }
    
    setTimeout(() => setUploadStatus(''), 3000);
  };

  const handleLogin = async (forceLogin = false) => {
    try {
      console.log('[Component] Starting login', { 
        forceLogin,
        timestamp: new Date().toISOString(),
        current_accounts: accounts.length
      });
      setError('');
      setUploadStatus('Initializing authentication...');
      
      // Get authorization URL from API (this will be async now)
      console.log('[Component] Calling tiktokApi.getAuthUrl...');
      const authUrl = await tiktokApi.getAuthUrl(forceLogin);
      
      console.log('[Component] Received authUrl', {
        url_length: authUrl.length,
        url_preview: authUrl.substring(0, 100) + '...',
        has_disable_auto_auth: authUrl.includes('disable_auto_auth')
      });
      
      console.log('[Component] Redirecting to TikTok authorization...');
      setUploadStatus('');
      
      // Redirect to auth URL (same window for better UX)
      window.location.href = authUrl;
    } catch (error) {
      console.error('[Component] Failed to start login:', {
        error_message: error.message,
        error_stack: error.stack
      });
      setError('Failed to initialize authentication: ' + error.message);
      setUploadStatus('');
    }
  };

  const handleAddAnotherAccount = async () => {
    console.log('[Component] Add another account - clearing any cached OAuth state');
    
    // Clear any existing OAuth state to ensure fresh login
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_code_verifier');
    
    // Call handleLogin with forceLogin=true to show account selection
    // This will set disable_auto_auth=1 parameter
    await handleLogin(true);
  };

  const handleLogout = () => {
    console.log('[Component] Logging out');
    tiktokApi.logout();
    setIsAuthenticated(false);
    setSelectedFile(null);
    setVideoTitle('');
    setUploadStatus('Logged out successfully');
    setTimeout(() => setUploadStatus(''), 3000);
    setAccounts([]);
    setActiveOpenId(null);
  };

  const handleAccountSwitch = async (e) => {
    const openId = e.target.value;
    console.log('[Component] Switching account', { open_id: openId });
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
      // Step 1: Initialize upload
      const initResult = await tiktokApi.initializeUpload(selectedFile, videoTitle, "SELF_ONLY");
      
      if (!initResult.success) {
        throw new Error(JSON.stringify(initResult.error));
      }

      const { publish_id, upload_url } = initResult.data;
      
      // Step 2: Upload entire video file
      setUploadStatus('Uploading video...');
      const uploadResult = await tiktokApi.uploadVideo(upload_url, selectedFile);
      
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
      setError('Upload failed: ' + err.message);
      setUploading(false);
      setUploadStatus('');
    }
  };

  // Always show Accounts Management first
  if (view === 'accounts') {
    return (
      <div className="uploader-container">
        <div className="upload-card">
          <div className="header">
            <h1>Account Management</h1>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={goToUploadView} className="btn-secondary">Go to Upload</button>
              <button onClick={handleLogout} className="btn-logout">Logout</button>
            </div>
          </div>

          <div className="upload-form">
            {accounts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ color: '#666', marginBottom: 20 }}>No accounts connected yet.</p>
                <button onClick={() => handleLogin(false)} className="btn-primary">
                  Add Your First Account
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', marginBottom: 15, fontWeight: 600 }}>Your Connected Accounts</label>
                <div className="accounts-grid">
                  {accounts.map(acc => (
                    <div 
                      key={acc.open_id} 
                      className={`account-card ${activeOpenId === acc.open_id ? 'active' : ''}`}
                      onClick={() => {
                        const select = { target: { value: acc.open_id } };
                        handleAccountSwitch(select);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {acc.avatar_url ? (
                          <img 
                            src={acc.avatar_url} 
                            alt={acc.display_name}
                            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#667eea', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600 }}>
                            {(acc.display_name || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#333' }}>{acc.display_name || 'TikTok User'}</div>
                          <div style={{ fontSize: '0.85em', color: '#999' }}>{acc.open_id.substring(0, 20)}...</div>
                        </div>
                        {activeOpenId === acc.open_id && (
                          <div style={{ background: '#48dbfb', color: 'white', padding: '4px 10px', borderRadius: 12, fontSize: '0.8em', fontWeight: 600 }}>
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
                        className="btn-remove"
                        disabled={uploading}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <button onClick={handleAddAnotherAccount} className="btn-primary" style={{ flex: 1 }} disabled={uploading}>
                    + Add Another Account
                  </button>
                </div>
                <p style={{ fontSize: '0.85em', color: '#666', marginTop: 10, textAlign: 'center' }}>
                  💡 <strong>To add a different TikTok account:</strong><br/>
                  1. Click "Add Another Account" below<br/>
                  2. If TikTok auto-logs you in with the same account, <strong>log out of TikTok in your browser first</strong> or use an incognito/private window<br/>
                  3. Then login with your other TikTok account
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="status-message error">{error}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="uploader-container">
      <div className="upload-card">
        <div className="header">
          <h1>TikTok Video Uploader</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={goToAccountsView} className="btn-secondary">Manage Accounts</button>
            <button onClick={handleLogout} className="btn-logout">Logout</button>
          </div>
        </div>

        <div className="upload-form">
          {accounts.length > 0 && (
            <div className="form-group">
              <label htmlFor="account-select">Account</label>
              <select
                id="account-select"
                value={activeOpenId || ''}
                onChange={handleAccountSwitch}
                disabled={uploading}
              >
                {accounts.map(acc => (
                  <option key={acc.open_id} value={acc.open_id}>
                    {acc.open_id}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.85em', color: '#666' }}>
                Select which TikTok account to use for this upload.
              </p>
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
              maxLength={150}
              disabled={uploading}
            />
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
          <h3>📱 Where to Find Your Uploaded Videos:</h3>
          <ol style={{ textAlign: 'left', lineHeight: '1.8' }}>
            <li><strong>Open the TikTok mobile app</strong> on your phone</li>
            <li>Tap on <strong>"Profile"</strong> (bottom right icon)</li>
            <li>Look at your profile videos (they'll show a 🔒 lock icon)</li>
            <li>Your videos are automatically set to <strong>PRIVATE</strong> (only you can see them)</li>
            <li>Tap on a video → Three dots (...) → Privacy settings to change visibility</li>
          </ol>
          <p style={{ marginTop: '15px', padding: '10px', background: '#fff3cd', borderRadius: '5px', fontSize: '0.9em' }}>
            <strong>⚠️ Sandbox Mode:</strong> All videos uploaded via this sandbox app are <strong>automatically set to PRIVATE</strong> (only visible to you). 
            This is a TikTok restriction for unapproved apps. To make videos public, your app needs to complete TikTok's audit process.
          </p>
          <h3 style={{ marginTop: '25px' }}>Upload Requirements:</h3>
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
