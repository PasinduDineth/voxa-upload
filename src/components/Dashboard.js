import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaFacebookF, FaTiktok, FaYoutube } from 'react-icons/fa6';

function Dashboard() {
  const navigate = useNavigate();

  const platforms = [
    {
      id: 'tiktok',
      name: 'TikTok',
      Icon: FaTiktok,
      color: '#25F4EE',
      description: 'Upload and manage your TikTok videos'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      Icon: FaYoutube,
      color: '#FF0000',
      description: 'Manage your YouTube channel and uploads'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      Icon: FaFacebookF,
      color: '#1877F2',
      description: 'Share videos to Facebook pages'
    }
  ];

  return (
    <div style={{
      maxWidth: '1280px',
      margin: '0 auto',
      color: '#111827'
    }}>
      {/* Platform Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '20px'
      }}>
        {platforms.map((platform) => (
          <div
            key={platform.id}
            style={{
              background: '#ffffff',
              border: '1px solid #111827',
              padding: '24px',
              transition: 'box-shadow 0.2s, border-color 0.2s',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#0b1c2d';
              e.currentTarget.style.boxShadow = '0 4px 10px rgba(17, 24, 39, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#111827';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Icon */}
            <div style={{
              fontSize: '24px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontWeight: 600,
              color: '#111827'
            }}>
              <span style={{ color: platform.color }}>
                <platform.Icon />
              </span>
              <span>{platform.name}</span>
            </div>

            {/* Description */}
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: '0 0 20px 0',
              lineHeight: '1.5'
            }}>
              {platform.description}
            </p>

            <div style={{
              fontSize: '13px',
              color: '#6b7280',
              marginBottom: '20px'
            }}>
              Videos: 0
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={() => navigate(`/${platform.id}`)}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: '#4fd1c5',
                color: '#0b1c2d',
                border: '1px solid #111827',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#0b1c2d';
                e.currentTarget.style.color = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#4fd1c5';
                e.currentTarget.style.color = '#0b1c2d';
              }}
            >
              Open Uploader →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
