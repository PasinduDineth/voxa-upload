import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

function Sidebar({ collapsed, onToggle }) {
  const navItems = [
    { path: '/', icon: '🏠', label: 'Dashboard', exact: true },
    { path: '/uploads', icon: '🚀', label: 'Multi Upload' },
    { path: '/tiktok', icon: '🎵', label: 'TikTok' },
    { path: '/youtube', icon: '▶️', label: 'YouTube' },
    { path: '/facebook', icon: '📘', label: 'Facebook' },
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          {!collapsed && <span className="logo-text">Voxa</span>}
          {collapsed && <span className="logo-icon">V</span>}
        </div>
        <button 
          className="toggle-btn" 
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={({ isActive }) => 
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="footer-info">
          {!collapsed && (
            <>
              <p className="version">Version 2.0</p>
              <p className="copyright">© 2025 Voxa</p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
