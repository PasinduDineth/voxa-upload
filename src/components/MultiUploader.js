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
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px'
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '14px', color: '#111827', fontWeight: 600 }}>
            <span>{icon}</span>
            <span>{label}</span>
          </h3>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>{accounts.length} available</span>
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          {accounts.map((account) => {
            const accountId = account.open_id || account.channel_id;
            const accountKey = `${platform}_${accountId}`;
            const isSelected = selectedAccounts.some(acc => acc.key === accountKey);
            const expiryDisplay = formatExpiry(account.expires_at);

            return (
              <div
                key={accountId}
                onClick={() => !uploading && handleAccountToggle(platform, accountId)}
                style={{
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                  padding: '10px 12px',
                  border: '1px solid #111827',
                  background: isSelected ? '#ffffff' : '#e5e7eb',
                  transition: 'background 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
                onMouseEnter={(e) => {
                  if (!uploading) {
                    e.currentTarget.style.background = '#d1d5db';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!uploading) {
                    e.currentTarget.style.background = isSelected ? '#ffffff' : '#e5e7eb';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => !uploading && handleAccountToggle(platform, accountId)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={uploading}
                    style={{ width: '16px', height: '16px' }}
                  />
                  {account.avatar_url ? (
                    <img
                      src={account.avatar_url}
                      alt={account.display_name || account.channel_title}
                      style={{
                        width: '32px',
                        height: '32px',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '32px',
                      height: '32px',
                      background: '#0b1c2d',
                      color: '#4fd1c5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      {(account.display_name || account.channel_title || 'A')[0].toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {account.display_name || account.channel_title || 'Account'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ID: {accountId.substring(0, 18)}...
                    </div>
                    {expiryDisplay && (
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {expiryDisplay}
                      </div>
                    )}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px',
                  color: isSelected ? '#111827' : '#6b7280',
                  border: '1px solid #111827',
                  padding: '2px 6px',
                  fontWeight: 600
                }}>
                  {platform.toUpperCase()}
                </span>
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
      <div>
        <h3 style={{ marginBottom: '16px', color: '#111827', fontSize: '18px', fontWeight: 600 }}>Upload Details</h3>
        {selectedAccounts.map((acc) => {
          const data = formData[acc.key] || {};
          const accountName = acc.account.display_name || acc.account.channel_title || acc.accountId;

          return (
            <div
              key={acc.key}
              style={{
                marginBottom: '20px',
                padding: '20px',
                border: '1px solid #111827',
                background: '#ffffff'
              }}
            >
              <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {acc.platform === 'tiktok' && '🎵'}
                {acc.platform === 'youtube' && '▶️'}
                {acc.platform === 'facebook' && '📘'}
                <span>{accountName}</span>
                <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'normal' }}>
                  ({acc.platform})
                </span>
              </h4>

              {acc.platform === 'tiktok' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Caption *</label>
                  <textarea
                    value={data.caption || ''}
                    onChange={(e) => updateFormData(acc.key, 'caption', e.target.value)}
                    placeholder="Enter video caption"
                    maxLength={150}
                    rows={3}
                    disabled={uploading}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#e5e7eb',
                      border: '1px solid #111827',
                      color: '#111827',
                      fontSize: '14px',
                      resize: 'none'
                    }}
                  />
                </div>
              )}

              {acc.platform === 'youtube' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Title *</label>
                    <input
                      type="text"
                      value={data.title || ''}
                      onChange={(e) => updateFormData(acc.key, 'title', e.target.value)}
                      placeholder="Enter video title"
                      maxLength={100}
                      disabled={uploading}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#e5e7eb',
                        border: '1px solid #111827',
                        color: '#111827',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Description</label>
                    <textarea
                      value={data.description || ''}
                      onChange={(e) => updateFormData(acc.key, 'description', e.target.value)}
                      placeholder="Enter video description"
                      rows={3}
                      disabled={uploading}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#e5e7eb',
                        border: '1px solid #111827',
                        color: '#111827',
                        fontSize: '14px',
                        resize: 'none'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Tags (comma separated)</label>
                    <input
                      type="text"
                      value={data.tags || ''}
                      onChange={(e) => updateFormData(acc.key, 'tags', e.target.value)}
                      placeholder="tag1, tag2, tag3"
                      disabled={uploading}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#e5e7eb',
                        border: '1px solid #111827',
                        color: '#111827',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Privacy</label>
                    <select
                      value={data.privacyStatus || 'public'}
                      onChange={(e) => updateFormData(acc.key, 'privacyStatus', e.target.value)}
                      disabled={uploading}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#e5e7eb',
                        border: '1px solid #111827',
                        color: '#111827',
                        fontSize: '14px'
                      }}
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
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Title *</label>
                    <input
                      type="text"
                      value={data.title || ''}
                      onChange={(e) => updateFormData(acc.key, 'title', e.target.value)}
                      placeholder="Enter video title"
                      maxLength={100}
                      disabled={uploading}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#e5e7eb',
                        border: '1px solid #111827',
                        color: '#111827',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Description</label>
                    <textarea
                      value={data.description || ''}
                      onChange={(e) => updateFormData(acc.key, 'description', e.target.value)}
                      placeholder="Enter video description"
                      rows={3}
                      disabled={uploading}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: '#e5e7eb',
                        border: '1px solid #111827',
                        color: '#111827',
                        fontSize: '14px',
                        resize: 'none'
                      }}
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
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ marginBottom: '12px', color: '#111827', fontSize: '18px', fontWeight: 600 }}>Upload Progress</h3>
        {uploadProgress.map((progress) => {
          const accountName = progress.account.display_name || progress.account.channel_title || progress.account.open_id || progress.account.channel_id;
          
          return (
            <div
              key={progress.key}
              style={{
                marginBottom: '10px',
                padding: '12px',
                background: '#ffffff',
                border: '1px solid #111827'
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
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
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
      maxWidth: '1280px',
      margin: '0 auto',
      color: '#111827'
    }}>
      {/* Main Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #111827',
        padding: '24px',
        maxWidth: '1280px',
        margin: '0 auto'
      }}>
        <div style={{ display: 'flex', gap: '32px' }}>
          <div style={{ flex: '0 0 42%' }}>
          {/* Video File Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
              Select Video File *
            </label>
            <label style={{
              display: 'block',
              border: '1px dotted #6b7280',
              background: '#ffffff',
              padding: '18px 24px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              position: 'relative'
            }}>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                disabled={uploading}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  cursor: uploading ? 'not-allowed' : 'pointer'
                }}
              />
              <div style={{ fontSize: '14px', color: '#111827', marginBottom: '6px' }}>
                Drop your video here or click to browse
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Supported formats: MP4, MOV, AVI · Max size varies by platform
              </div>
            </label>
            {selectedFile && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: '#e5e7eb',
                border: '1px solid #111827',
                fontSize: '13px',
                color: '#6b7280'
              }}>
                <p style={{ margin: '0 0 4px 0' }}>📹 {selectedFile.name}</p>
                <p style={{ margin: 0 }}>Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          {/* Account Selection */}
          {totalAccounts === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', border: '1px solid #111827' }}>
              <p style={{ fontSize: '14px', marginBottom: '16px' }}>
                No accounts found. Please add accounts from individual platform pages first.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href="/tiktok" style={{ color: '#4fd1c5', fontWeight: 600 }}>
                  Add TikTok Account →
                </a>
                <a href="/youtube" style={{ color: '#4fd1c5', fontWeight: 600 }}>
                  Add YouTube Channel →
                </a>
                <a href="/facebook" style={{ color: '#4fd1c5', fontWeight: 600 }}>
                  Add Facebook Page →
                </a>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ marginBottom: '12px', color: '#111827', fontSize: '18px', fontWeight: 600 }}>
                  Select Accounts to Upload To
                  {selectedAccounts.length > 0 && (
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '10px' }}>
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

            </>
          )}
        </div>
        <div style={{ flex: '1 1 58%' }}>
          {selectedAccounts.length > 0 ? (
            <>
              {renderFormFields()}
              <button
                onClick={handleUploadAll}
                disabled={!selectedFile || uploading || selectedAccounts.length === 0}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '12px',
                  background: (!selectedFile || uploading || selectedAccounts.length === 0) ? '#e5e7eb' : '#4fd1c5',
                  color: (!selectedFile || uploading || selectedAccounts.length === 0) ? '#6b7280' : '#0b1c2d',
                  border: '1px solid #111827',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: (!selectedFile || uploading || selectedAccounts.length === 0) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  opacity: (!selectedFile || uploading || selectedAccounts.length === 0) ? 0.8 : 1
                }}
                onMouseEnter={e => {
                  if (selectedFile && !uploading && selectedAccounts.length > 0) {
                    e.currentTarget.style.background = '#0b1c2d';
                    e.currentTarget.style.color = '#e5e7eb';
                  }
                }}
                onMouseLeave={e => {
                  if (selectedFile && !uploading && selectedAccounts.length > 0) {
                    e.currentTarget.style.background = '#4fd1c5';
                    e.currentTarget.style.color = '#0b1c2d';
                  }
                }}
              >
                {uploading
                  ? `Uploading... (${uploadProgress.filter(p => p.status === 'success' || p.status === 'error').length}/${selectedAccounts.length})`
                  : `Upload to ${selectedAccounts.length} Account${selectedAccounts.length > 1 ? 's' : ''}`}
              </button>
            </>
          ) : (
            <div style={{
              border: '1px solid #111827',
              padding: '24px',
              background: '#ffffff',
              color: '#6b7280',
              fontSize: '13px'
            }}>
              Select at least one account on the left to configure upload details.
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: '#ffffff',
          color: '#111827',
          border: '1px solid #111827',
          borderLeft: '3px solid #111827',
          fontSize: '14px',
          fontWeight: 500
        }}>
          {error}
        </div>
      )}

      {/* Upload Progress */}
      {renderUploadProgress()}
    </div>
  );
}

export default MultiUploader;
