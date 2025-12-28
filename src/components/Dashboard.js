import React from 'react';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();

  const platforms = [
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: '🎵',
      description: 'Upload and manage your TikTok videos'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: '▶️',
      description: 'Manage your YouTube channel and uploads'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: '📘',
      description: 'Share videos to Facebook pages'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b1c2d',
      padding: '40px',
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#e5e7eb'
    }}>
      {/* Hero Section */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#e5e7eb', margin: '0 0 12px 0' }}>
          Multi-Platform Video Uploader
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
          Upload and manage your videos across TikTok, YouTube, and Facebook from one place
        </p>
      </div>

      {/* Platform Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        maxWidth: '1200px'
      }}>
        {platforms.map((platform) => (
          <div
            key={platform.id}
            onClick={() => navigate(`/${platform.id}`)}
            style={{
              background: '#111827',
              border: '1px solid #4fd1c5',
              borderRadius: '12px',
              padding: '24px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
              color: '#e5e7eb'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4fd1c5';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,209,197,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#4fd1c5';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Icon */}
            <div style={{
              fontSize: '48px',
              marginBottom: '16px'
            }}>
              {platform.icon}
            </div>

            {/* Title */}
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#e5e7eb',
              margin: '0 0 8px 0'
            }}>
              {platform.name}
            </h2>

            {/* Description */}
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: '0 0 20px 0',
              lineHeight: '1.5'
            }}>
              {platform.description}
            </p>

            {/* Action Button */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#4fd1c5'
            }}>
              <span>Open Uploader</span>
              <span>→</span>
            </div>
          </div>
        ))}
      </div>

      {/* Multi Upload Card */}
      <div
        onClick={() => navigate('/uploads')}
        style={{
          background: '#111827',
          border: '1px solid #4fd1c5',
          borderRadius: '12px',
          padding: '24px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          marginTop: '20px',
          maxWidth: '1200px',
          color: '#e5e7eb'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#4fd1c5';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,209,197,0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#4fd1c5';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '36px' }}>🚀</div>
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#e5e7eb',
              margin: '0 0 4px 0'
            }}>
              Multi-Platform Upload
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: 0
            }}>
              Upload one video to multiple platforms simultaneously
            </p>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#4fd1c5'
          }}>
            <span>Start Upload</span>
            <span>→</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
