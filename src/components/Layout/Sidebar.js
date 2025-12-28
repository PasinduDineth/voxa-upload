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
      background: '#0b1c2d',
      borderRight: '1px solid #111827',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      color: '#e5e7eb'
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid #111827'
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#4fd1c5',
          letterSpacing: '0.5px'
        }}>
          Voxa
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
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              color: isActive ? '#4fd1c5' : '#e5e7eb',
              background: isActive ? '#111827' : 'transparent',
              borderLeft: isActive ? '4px solid #4fd1c5' : '4px solid transparent',
              transition: 'background 0.2s, color 0.2s',
              position: 'relative'
            })}
            onMouseEnter={(e) => {
              const isActive = e.currentTarget.classList.contains('active');
              if (!isActive) {
                e.currentTarget.style.background = '#111827';
                e.currentTarget.style.color = '#e5e7eb';
              }
            }}
            onMouseLeave={(e) => {
              const isActive = e.currentTarget.classList.contains('active');
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#e5e7eb';
              }
            }}
          >
            {({ isActive }) => (
              <>
                <span style={{ fontSize: '18px', color: isActive ? '#4fd1c5' : '#6b7280' }}>{item.icon}</span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '20px',
        borderTop: '1px solid #111827'
      }}>
        <p style={{
          fontSize: '12px',
          color: '#6b7280',
          margin: '0 0 4px 0'
        }}>
          Version 2.0
        </p>
        <p style={{
          fontSize: '12px',
          color: '#6b7280',
          margin: 0
        }}>
          © 2025 Voxa
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
