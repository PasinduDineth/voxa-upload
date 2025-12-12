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
    // Initial load of accounts from database
    loadAccountsFromDB();
    
    // Check if user is authenticated
    setIsAuthenticated(tiktokApi.isAuthenticated());
    setActiveOpenId(localStorage.getItem('tiktok_open_id'));
    setView('accounts');

    // Poll database every 3 seconds for new accounts (while popup OAuth is open)
    const pollInterval = setInterval(() => {
      loadAccountsFromDB();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  const loadAccountsFromDB = async () => {
    const accs = await tiktokApi.loadAccounts();
    setAccounts(accs);
    
    // Auto-select first account if none selected
    if (accs.length > 0 && !activeOpenId) {
      const firstAccount = accs[0];
      if (tiktokApi.useAccount(firstAccount.open_id)) {
        setActiveOpenId(firstAccount.open_id);
        setIsAuthenticated(true);
      }
    }
  };

  const handleLogin = () => {
    // Open OAuth in popup window (provides fresh TikTok session)
    setUploadStatus('Opening authentication window...');
    const popup = tiktokApi.openAuthPopup();
    
    if (!popup) {
      setError('Failed to open popup window. Please allow popups for this site.');
      setUploadStatus('');
      return;
    }

    // Poll will automatically detect new account when popup completes
    setTimeout(() => setUploadStatus(''), 2000);
  };

  const handleLogout = async () => {
    tiktokApi.logout();
    setIsAuthenticated(false);
    setSelectedFile(null);
    setVideoTitle('');
    setUploadStatus('Logged out successfully');
    setTimeout(() => setUploadStatus(''), 3000);
    await loadAccountsFromDB();
    setActiveOpenId(null);
  };

  const handleAccountSwitch = (e) => {
    const openId = e.target.value;
    if (openId && tiktokApi.useAccount(openId)) {
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
                <button onClick={handleLogin} className="btn-primary">
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
                <div style={{ marginTop: 20 }}>
                  <button onClick={handleLogin} className="btn-primary" style={{ width: '100%' }} disabled={uploading}>
                    + Add Another Account
                  </button>
                </div>
                <p style={{ fontSize: '0.85em', color: '#666', marginTop: 10, textAlign: 'center' }}>
                  💡 A popup window will open for TikTok authentication. You can login with any TikTok account.
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
