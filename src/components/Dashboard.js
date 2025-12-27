import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();

  const platforms = [
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: '🎵',
      color: '#000000',
      gradient: 'linear-gradient(135deg, #000000 0%, #fe2c55 100%)',
      description: 'Upload and manage your TikTok videos',
      stats: { label: 'Videos', value: '0' }
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: '▶️',
      color: '#FF0000',
      gradient: 'linear-gradient(135deg, #c4302b 0%, #FF0000 100%)',
      description: 'Manage your YouTube channel and uploads',
      stats: { label: 'Videos', value: '0' }
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: '📘',
      color: '#1877f2',
      gradient: 'linear-gradient(135deg, #0062E0 0%, #1877f2 100%)',
      description: 'Share videos to Facebook pages',
      stats: { label: 'Videos', value: '0' }
    }
  ];

  return (
    <div className="dashboard-home">
      <div className="dashboard-hero">
        <h2 className="hero-title">Multi-Platform Video Uploader</h2>
        <p className="hero-subtitle">
          Upload and manage your videos across TikTok, YouTube, and Facebook from one place
        </p>
      </div>

      <div className="platform-grid">
        {platforms.map((platform) => (
          <div
            key={platform.id}
            className="platform-card"
            onClick={() => navigate(`/${platform.id}`)}
            style={{ '--platform-gradient': platform.gradient }}
          >
            <div className="platform-icon">{platform.icon}</div>
            <h3 className="platform-name">{platform.name}</h3>
            <p className="platform-description">{platform.description}</p>
            <div className="platform-stats">
              <span className="stats-label">{platform.stats.label}</span>
              <span className="stats-value">{platform.stats.value}</span>
            </div>
            <button className="platform-btn">
              Open Uploader →
            </button>
          </div>
        ))}
      </div>

      <div className="features-section">
        <h3 className="section-title">Features</h3>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🚀</div>
            <h4>Fast Uploads</h4>
            <p>Quick and efficient video uploads to multiple platforms</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h4>Secure</h4>
            <p>OAuth 2.0 authentication for all platforms</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h4>Multi-Account</h4>
            <p>Manage multiple accounts per platform</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h4>Easy to Use</h4>
            <p>Intuitive interface for seamless uploads</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
