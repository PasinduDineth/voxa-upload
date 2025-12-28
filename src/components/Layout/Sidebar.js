import React from 'react';
import { NavLink } from 'react-router-dom';

function Sidebar() {
  const navItems = [
    { path: '/', icon: '🏠', label: 'Dashboard', exact: true },
    { path: '/uploads', icon: '🚀', label: 'Multi Upload' },
    { path: '/tiktok', icon: '🎵', label: 'TikTok' },
    { path: '/youtube', icon: '▶️', label: 'YouTube' },
    { path: '/facebook', icon: '📘', label: 'Facebook' },
  ];

  return (
    <aside style={{
      width: '240px',
      minHeight: '100vh',
      background: '#020617',
      borderRight: '1px solid #1F2937',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh'
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid #1F2937'
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#6366F1',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🎬</span>
          <span>Voxa</span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1,
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              color: isActive ? '#E5E7EB' : '#9CA3AF',
              background: isActive ? '#111827' : 'transparent',
              borderLeft: isActive ? '4px solid #6366F1' : '4px solid transparent',
              transition: 'all 0.2s',
              position: 'relative'
            })}
            onMouseEnter={(e) => {
              const isActive = e.currentTarget.classList.contains('active');
              if (!isActive) {
                e.currentTarget.style.background = '#0B1120';
                e.currentTarget.style.color = '#E5E7EB';
              }
            }}
            onMouseLeave={(e) => {
              const isActive = e.currentTarget.classList.contains('active');
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#9CA3AF';
              }
            }}
          >
            <span style={{ fontSize: '18px' }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '20px',
        borderTop: '1px solid #1F2937'
      }}>
        <p style={{
          fontSize: '12px',
          color: '#6B7280',
          margin: '0 0 4px 0'
        }}>
          Version 2.0
        </p>
        <p style={{
          fontSize: '12px',
          color: '#4B5563',
          margin: 0
        }}>
          © 2025 Voxa
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
