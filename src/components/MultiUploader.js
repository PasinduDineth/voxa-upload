import React, { useState, useEffect } from 'react';
import tiktokApi from '../services/tiktokApi';
import youtubeApi from '../services/youtubeApi';
import facebookApi from '../services/facebookApi';

function MultiUploader() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [allAccounts, setAllAccounts] = useState({
    tiktok: [],
    youtube: [],
    facebook: []
  });
  
  // Platform-specific fields
  const [formData, setFormData] = useState({});
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAllAccounts();
  }, []);

  const loadAllAccounts = async () => {
    const [tiktokAccs, youtubeAccs, facebookAccs] = await Promise.all([
      tiktokApi.loadAccounts(),
      youtubeApi.loadChannels(),
      facebookApi.loadAccounts()
    ]);

    setAllAccounts({
      tiktok: tiktokAccs.map(acc => ({ ...acc, platform: 'tiktok' })),
      youtube: youtubeAccs.map(acc => ({ ...acc, platform: 'youtube' })),
      facebook: facebookAccs.map(acc => ({ ...acc, platform: 'facebook' }))
    });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const handleAccountToggle = (platform, accountId) => {
    const accountKey = `${platform}_${accountId}`;
    const isSelected = selectedAccounts.some(acc => acc.key === accountKey);

    if (isSelected) {
      setSelectedAccounts(selectedAccounts.filter(acc => acc.key !== accountKey));
      const newFormData = { ...formData };
      delete newFormData[accountKey];
      setFormData(newFormData);
    } else {
      const account = allAccounts[platform].find(acc => acc.open_id === accountId || acc.channel_id === accountId);
      setSelectedAccounts([...selectedAccounts, {
        key: accountKey,
        platform,
        accountId,
        account
      }]);
      
      // Initialize form data for this account
      setFormData({
        ...formData,
        [accountKey]: getDefaultFormData(platform)
      });
    }
  };

  const getDefaultFormData = (platform) => {
    switch (platform) {
      case 'tiktok':
        return { caption: '' };
      case 'youtube':
        return {
          title: '',
          description: '',
          tags: '',
          privacyStatus: 'public',
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en'
        };
      case 'facebook':
        return { title: '', description: '' };
      default:
        return {};
    }
  };

  const updateFormData = (accountKey, field, value) => {
    setFormData({
      ...formData,
      [accountKey]: {
        ...formData[accountKey],
        [field]: value
      }
    });
  };

  const handleUploadAll = async () => {
    if (!selectedFile) {
      setError('Please select a video file');
      return;
    }

    if (selectedAccounts.length === 0) {
      setError('Please select at least one account');
      return;
    }

    // Validate that all selected accounts have required fields
    for (const acc of selectedAccounts) {
      const data = formData[acc.key];
      if (acc.platform === 'tiktok' && !data?.caption?.trim()) {
        setError(`Please enter a caption for TikTok account: ${acc.account.display_name || acc.account.open_id}`);
        return;
      }
      if (acc.platform === 'youtube' && !data?.title?.trim()) {
        setError(`Please enter a title for YouTube channel: ${acc.account.channel_title || acc.account.channel_id}`);
        return;
      }
      if (acc.platform === 'facebook' && !data?.title?.trim()) {
        setError(`Please enter a title for Facebook page: ${acc.account.display_name || acc.account.open_id}`);
        return;
      }
    }

    setUploading(true);
    setError('');
    setUploadProgress([]);

    for (let i = 0; i < selectedAccounts.length; i++) {
      const acc = selectedAccounts[i];
      const data = formData[acc.key];
      
      setUploadProgress(prev => [...prev, {
        key: acc.key,
        platform: acc.platform,
        account: acc.account,
        status: 'uploading',
        message: 'Starting upload...'
      }]);

      try {
        let result;
        
        if (acc.platform === 'tiktok') {
          await tiktokApi.useAccount(acc.accountId);
          result = await uploadToTikTok(selectedFile, data.caption);
        } else if (acc.platform === 'youtube') {
          // Ensure channels are loaded before using
          await youtubeApi.loadChannels();
          await youtubeApi.useChannel(acc.accountId);
          result = await uploadToYouTube(selectedFile, data);
        } else if (acc.platform === 'facebook') {
          await facebookApi.useAccount(acc.accountId);
          result = await uploadToFacebook(selectedFile, data);
        }

        setUploadProgress(prev => prev.map(p => 
          p.key === acc.key 
            ? { ...p, status: result.success ? 'success' : 'error', message: result.message }
            : p
        ));
      } catch (err) {
        setUploadProgress(prev => prev.map(p => 
          p.key === acc.key 
            ? { ...p, status: 'error', message: err.message }
            : p
        ));
      }
    }

    setUploading(false);
  };

  const uploadToTikTok = async (file, caption) => {
    try {
      const initResult = await tiktokApi.initializeUpload(file, caption, '', "SELF_ONLY");
      
      if (!initResult.success) {
        return { success: false, message: 'Failed to initialize: ' + JSON.stringify(initResult.error) };
      }

      const { publish_id, upload_url } = initResult.data;
      
      const uploadResult = await tiktokApi.uploadVideo(upload_url, file);
      
      if (!uploadResult.success) {
        return { success: false, message: 'Upload failed: ' + JSON.stringify(uploadResult.error) };
      }

      // Check status
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        const statusResult = await tiktokApi.publishVideo(publish_id);
        
        if (statusResult.success) {
          const status = statusResult.data.status;
          
          if (status === 'PUBLISH_COMPLETE' || status === 'SEND_TO_USER_INBOX') {
            return { success: true, message: '✅ Uploaded to TikTok successfully!' };
          } else if (status === 'FAILED') {
            return { success: false, message: 'TikTok upload failed: ' + (statusResult.data.fail_reason || 'Unknown') };
          }
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      return { success: true, message: '✅ TikTok upload processing (check your inbox)' };
    } catch (err) {
      return { success: false, message: 'Error: ' + err.message };
    }
  };

  const uploadToYouTube = async (file, data) => {
    try {
      const result = await youtubeApi.uploadVideo(
        file,
        data.title,
        data.description,
        data.tags,
        data.defaultLanguage,
        data.defaultAudioLanguage,
        data.privacyStatus
      );

      if (result.success) {
        return { success: true, message: '✅ Uploaded to YouTube successfully!' };
      } else {
        return { success: false, message: 'YouTube upload failed: ' + JSON.stringify(result.error) };
      }
    } catch (err) {
      return { success: false, message: 'Error: ' + err.message };
    }
  };

  const uploadToFacebook = async (file, data) => {
    try {
      const result = await facebookApi.uploadVideo(file, data.title, data.description);

      if (result.success) {
        return { success: true, message: '✅ Uploaded to Facebook successfully!' };
      } else {
        return { success: false, message: 'Facebook upload failed: ' + JSON.stringify(result.error) };
      }
    } catch (err) {
      return { success: false, message: 'Error: ' + err.message };
    }
  };

  const renderAccountSelector = (platform, accounts, label, icon) => {
    if (accounts.length === 0) return null;

    const formatExpiry = (expiresAt) => {
      if (!expiresAt) return null;
      const date = new Date(expiresAt);
      const now = new Date();
      const diffMs = date - now;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMs < 0) return '⚠️ Expired';
      if (diffDays > 30) return `✅ ${diffDays} days`;
      if (diffDays > 0) return `⏳ ${diffDays}d ${diffHours % 24}h`;
      if (diffHours > 0) return `⏳ ${diffHours}h ${diffMins % 60}m`;
      if (diffMins > 0) return `⚠️ ${diffMins}m`;
      return '⚠️ Soon';
    };

    return (
      <div className="platform-section" style={{ marginBottom: '20px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span>{icon}</span>
          <span>{label}</span>
          <span style={{ fontSize: '0.85em', color: '#666', fontWeight: 'normal' }}>
            ({accounts.length} available)
          </span>
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
          {accounts.map((account) => {
            const accountId = account.open_id || account.channel_id;
            const accountKey = `${platform}_${accountId}`;
            const isSelected = selectedAccounts.some(acc => acc.key === accountKey);
            const expiryDisplay = formatExpiry(account.expires_at);
            
            return (
              <div
                key={accountId}
                onClick={() => !uploading && handleAccountToggle(platform, accountId)}
                className={`account-card ${isSelected ? 'active' : ''}`}
                style={{
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                  padding: '12px',
                  border: isSelected ? '2px solid #667eea' : '2px solid #e5e7eb',
                  borderRadius: '12px',
                  background: isSelected ? '#f0f4ff' : 'white',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {account.avatar_url && (
                    <img
                      src={account.avatar_url}
                      alt={account.display_name || account.channel_title}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {account.display_name || account.channel_title || 'Account'}
                    </div>
                    <div style={{ fontSize: '0.75em', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {accountId.substring(0, 20)}...
                    </div>
                    {expiryDisplay && (
                      <div style={{ fontSize: '0.7em', color: expiryDisplay.includes('⚠️') ? '#ef4444' : '#10b981', marginTop: '2px' }}>
                        {expiryDisplay}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div style={{ color: '#667eea', fontSize: '1.2em' }}>✓</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFormFields = () => {
    if (selectedAccounts.length === 0) return null;

    return (
      <div style={{ marginTop: '30px' }}>
        <h3 style={{ marginBottom: '20px', color: '#1f2937' }}>Upload Details</h3>
        {selectedAccounts.map((acc) => {
          const data = formData[acc.key] || {};
          const accountName = acc.account.display_name || acc.account.channel_title || acc.accountId;

          return (
            <div
              key={acc.key}
              style={{
                marginBottom: '25px',
                padding: '20px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                background: '#f9fafb'
              }}
            >
              <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {acc.platform === 'tiktok' && '🎵'}
                {acc.platform === 'youtube' && '▶️'}
                {acc.platform === 'facebook' && '📘'}
                <span>{accountName}</span>
                <span style={{ fontSize: '0.8em', color: '#666', fontWeight: 'normal' }}>
                  ({acc.platform})
                </span>
              </h4>

              {acc.platform === 'tiktok' && (
                <div className="form-group">
                  <label>Caption *</label>
                  <textarea
                    value={data.caption || ''}
                    onChange={(e) => updateFormData(acc.key, 'caption', e.target.value)}
                    placeholder="Enter video caption"
                    maxLength={150}
                    rows={3}
                    disabled={uploading}
                  />
                </div>
              )}

              {acc.platform === 'youtube' && (
                <>
                  <div className="form-group">
                    <label>Title *</label>
                    <input
                      type="text"
                      value={data.title || ''}
                      onChange={(e) => updateFormData(acc.key, 'title', e.target.value)}
                      placeholder="Enter video title"
                      maxLength={100}
                      disabled={uploading}
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={data.description || ''}
                      onChange={(e) => updateFormData(acc.key, 'description', e.target.value)}
                      placeholder="Enter video description"
                      rows={3}
                      disabled={uploading}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tags (comma separated)</label>
                    <input
                      type="text"
                      value={data.tags || ''}
                      onChange={(e) => updateFormData(acc.key, 'tags', e.target.value)}
                      placeholder="tag1, tag2, tag3"
                      disabled={uploading}
                    />
                  </div>
                  <div className="form-group">
                    <label>Privacy</label>
                    <select
                      value={data.privacyStatus || 'public'}
                      onChange={(e) => updateFormData(acc.key, 'privacyStatus', e.target.value)}
                      disabled={uploading}
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                      <option value="unlisted">Unlisted</option>
                    </select>
                  </div>
                </>
              )}

              {acc.platform === 'facebook' && (
                <>
                  <div className="form-group">
                    <label>Title *</label>
                    <input
                      type="text"
                      value={data.title || ''}
                      onChange={(e) => updateFormData(acc.key, 'title', e.target.value)}
                      placeholder="Enter video title"
                      maxLength={100}
                      disabled={uploading}
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={data.description || ''}
                      onChange={(e) => updateFormData(acc.key, 'description', e.target.value)}
                      placeholder="Enter video description"
                      rows={3}
                      disabled={uploading}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderUploadProgress = () => {
    if (uploadProgress.length === 0) return null;

    return (
      <div style={{ marginTop: '30px' }}>
        <h3 style={{ marginBottom: '15px' }}>Upload Progress</h3>
        {uploadProgress.map((progress) => {
          const accountName = progress.account.display_name || progress.account.channel_title || progress.account.open_id || progress.account.channel_id;
          
          return (
            <div
              key={progress.key}
              style={{
                marginBottom: '12px',
                padding: '15px',
                borderRadius: '8px',
                background: progress.status === 'success' ? '#d4edda' : progress.status === 'error' ? '#f8d7da' : '#fff3cd',
                border: `1px solid ${progress.status === 'success' ? '#c3e6cb' : progress.status === 'error' ? '#f5c6cb' : '#ffeaa7'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <span style={{ fontSize: '1.2em' }}>
                  {progress.platform === 'tiktok' && '🎵'}
                  {progress.platform === 'youtube' && '▶️'}
                  {progress.platform === 'facebook' && '📘'}
                </span>
                <strong>{accountName}</strong>
                <span style={{ marginLeft: 'auto' }}>
                  {progress.status === 'uploading' && '⏳'}
                  {progress.status === 'success' && '✅'}
                  {progress.status === 'error' && '❌'}
                </span>
              </div>
              <div style={{ fontSize: '0.9em', color: '#555' }}>
                {progress.message}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const totalAccounts = allAccounts.tiktok.length + allAccounts.youtube.length + allAccounts.facebook.length;

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
          <span style={{ fontSize: '32px' }}>🚀</span>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#E5E7EB', margin: 0 }}>
            Multi-Platform Upload
          </h1>
        </div>
        <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
          Upload one video to multiple platforms simultaneously
        </p>
      </div>

      {/* Main Card */}
      <div style={{
        background: '#0F172A',
        border: '1px solid #1F2937',
        borderRadius: '12px',
        overflow: 'hidden',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ padding: '24px' }}>
          {/* Video File Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#E5E7EB' }}>
              Select Video File *
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
                <p style={{ margin: 0 }}>Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          {/* Account Selection */}
          {totalAccounts === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
              <p style={{ fontSize: '1.1em', marginBottom: '20px' }}>
                No accounts found. Please add accounts from individual platform pages first.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href="/tiktok" style={{ color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>
                  Add TikTok Account →
                </a>
                <a href="/youtube" style={{ color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>
                  Add YouTube Channel →
                </a>
                <a href="/facebook" style={{ color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>
                  Add Facebook Page →
                </a>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ marginBottom: '15px', color: '#E5E7EB', fontSize: '18px', fontWeight: 600 }}>
                  Select Accounts to Upload To
                  {selectedAccounts.length > 0 && (
                    <span style={{ fontSize: '0.85em', color: '#6366F1', marginLeft: '10px' }}>
                      ({selectedAccounts.length} selected)
                    </span>
                  )}
                </h3>
                {/* TikTok */}
                {renderAccountSelector('tiktok', allAccounts.tiktok, 'TikTok Accounts', '🎵')}
                {/* YouTube */}
                {renderAccountSelector('youtube', allAccounts.youtube, 'YouTube Channels', '▶️')}
                {/* Facebook */}
                {renderAccountSelector('facebook', allAccounts.facebook, 'Facebook Pages', '📘')}
              </div>

              {/* Form Fields for Selected Accounts */}
              {renderFormFields()}

              {/* Upload Button */}
              {selectedAccounts.length > 0 && (
                <button
                  onClick={handleUploadAll}
                  disabled={!selectedFile || uploading || selectedAccounts.length === 0}
                  style={{
                    marginTop: '20px',
                    width: '100%',
                    padding: '14px',
                    background: (!selectedFile || uploading || selectedAccounts.length === 0) ? '#374151' : '#6366F1',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: (!selectedFile || uploading || selectedAccounts.length === 0) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: (!selectedFile || uploading || selectedAccounts.length === 0) ? 0.5 : 1
                  }}
                  onMouseEnter={e => {
                    if (selectedFile && !uploading && selectedAccounts.length > 0) {
                      e.currentTarget.style.background = '#5558E3';
                    }
                  }}
                  onMouseLeave={e => {
                    if (selectedFile && !uploading && selectedAccounts.length > 0) {
                      e.currentTarget.style.background = '#6366F1';
                    }
                  }}
                >
                  {uploading
                    ? `Uploading... (${uploadProgress.filter(p => p.status === 'success' || p.status === 'error').length}/${selectedAccounts.length})`
                    : `Upload to ${selectedAccounts.length} Account${selectedAccounts.length > 1 ? 's' : ''}`}
                </button>
              )}
            </>
          )}

          {/* Error Message */}
          {error && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: '#EF4444',
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          {/* Upload Progress */}
          {renderUploadProgress()}
        </div>
      </div>
    </div>
  );
}

export default MultiUploader;
