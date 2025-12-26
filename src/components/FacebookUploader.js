import React, { useState, useEffect } from 'react';
import facebookApi from '../services/facebookApi';
import './TikTokUploader.css'; // Reusing the same CSS

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
    <div className="tiktok-uploader">
      {view === 'accounts' && (
        <div className="accounts-view">
          <h2 style={{ color: '#1877f2', marginBottom: '20px' }}>📘 Facebook Pages</h2>
          
          {uploadStatus && (
            <div style={{
              padding: '15px',
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #1877f2 0%, #0c63d4 100%)',
              color: 'white',
              borderRadius: '12px',
              fontWeight: 600,
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(24, 119, 242, 0.2)'
            }}>
              {uploadStatus}
            </div>
          )}

          {error && (
            <div style={{
              padding: '15px',
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
              color: 'white',
              borderRadius: '12px',
              fontWeight: 600,
              whiteSpace: 'pre-line',
              textAlign: 'left',
              boxShadow: '0 4px 15px rgba(255, 68, 68, 0.2)'
            }}>
              {error}
            </div>
          )}

          {accounts.length === 0 ? (
            <div className="no-accounts">
              <p style={{ fontSize: '16px', color: '#666', marginBottom: '20px' }}>
                No Facebook Pages connected yet
              </p>
              <button onClick={goToAddTokenView} className="primary-button">
                Add Facebook Pages
              </button>
            </div>
          ) : (
            <>
              <div className="accounts-list">
                {accounts.map((account) => (
                  <div 
                    key={account.open_id} 
                    className={`account-card ${activePageId === account.open_id ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
                      {account.avatar_url && (
                        <img 
                          src={account.avatar_url} 
                          alt={account.display_name}
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
                        <h3 style={{ margin: '0 0 5px 0', color: '#1877f2' }}>
                          {account.display_name}
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                          Page ID: {account.open_id}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {activePageId !== account.open_id ? (
                        <button 
                          onClick={async () => {
                            if (await facebookApi.useAccount(account.open_id)) {
                              setActivePageId(account.open_id);
                              setIsAuthenticated(true);
                            }
                          }}
                          style={{
                            padding: '8px 16px',
                            background: '#1877f2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          Use This Page
                        </button>
                      ) : (
                        <span style={{
                          padding: '8px 16px',
                          background: '#e7f3ff',
                          color: '#1877f2',
                          borderRadius: '8px',
                          fontWeight: 600
                        }}>
                          ✓ Active
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveAccount(account.open_id)}
                        style={{
                          padding: '8px 16px',
                          background: '#ff4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={goToAddTokenView} className="secondary-button">
                  Add More Pages
                </button>
                {isAuthenticated && (
                  <button onClick={goToUploadView} className="primary-button">
                    Go to Upload
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {view === 'add-token' && (
        <div className="upload-view">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#1877f2', margin: 0 }}>📘 Add Facebook Pages</h2>
            <button onClick={goToAccountsView} className="secondary-button">
              ← Back to Pages
            </button>
          </div>

          {uploadStatus && (
            <div style={{
              padding: '15px',
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #1877f2 0%, #0c63d4 100%)',
              color: 'white',
              borderRadius: '12px',
              fontWeight: 600,
              textAlign: 'center'
            }}>
              {uploadStatus}
            </div>
          )}

          {error && (
            <div style={{
              padding: '15px',
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
              color: 'white',
              borderRadius: '12px',
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <div className="upload-form">
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

            <div className="form-group">
              <label>Facebook Page Access Token *</label>
              <textarea
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Paste your Facebook Page Access Token here..."
                rows={4}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
              <p style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
                This token will be used to fetch and connect all your Facebook Pages
              </p>
            </div>

            <button
              onClick={handleAddPages}
              disabled={!accessToken.trim()}
              className="primary-button"
              style={{ width: '100%' }}
            >
              Add Facebook Pages
            </button>
          </div>
        </div>
      )}

      {view === 'upload' && (
        <div className="upload-view">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#1877f2', margin: 0 }}>📘 Upload to Facebook</h2>
            <button onClick={goToAccountsView} className="secondary-button">
              ← Back to Pages
            </button>
          </div>

          {activeAccount && (
            <div style={{
              padding: '15px',
              background: 'linear-gradient(135deg, #e7f3ff 0%, #cce5ff 100%)',
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

          {uploadStatus && (
            <div style={{
              padding: '15px',
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #1877f2 0%, #0c63d4 100%)',
              color: 'white',
              borderRadius: '12px',
              fontWeight: 600,
              textAlign: 'center'
            }}>
              {uploadStatus}
            </div>
          )}

          {error && (
            <div style={{
              padding: '15px',
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
              color: 'white',
              borderRadius: '12px',
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <div className="upload-form">
            <div className="form-group">
              <label>Video File</label>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              {selectedFile && (
                <p style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                  Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024 / 1024)}MB)
                </p>
              )}
            </div>

            <div className="form-group">
              <label>Video Title *</label>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Enter video title..."
                disabled={uploading}
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label>Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                disabled={uploading}
                rows={4}
                maxLength={500}
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !videoTitle.trim()}
              className="primary-button"
              style={{ width: '100%' }}
            >
              {uploading ? 'Uploading...' : 'Upload to Facebook Page'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FacebookUploader;
