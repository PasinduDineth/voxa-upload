import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

function DashboardLayout() {
  const location = useLocation();
  const headerMap = {
    '/': {
      title: 'Multi-Platform Video Uploader',
      subtitle: 'Upload and manage your videos across TikTok, YouTube, and Facebook from one place.'
    },
    '/uploads': {
      title: 'Multi-Platform Upload',
      subtitle: 'Upload one video to multiple platforms simultaneously.'
    },
    '/tiktok': {
      title: 'TikTok Account Management',
      subtitle: 'Manage TikTok accounts and open the uploader.'
    },
    '/youtube': {
      title: 'YouTube Channel Management',
      subtitle: 'Manage channels and publish videos to YouTube.'
    },
    '/facebook': {
      title: 'Facebook Page Management',
      subtitle: 'Manage Facebook pages and publish videos.'
    }
  };
  const header = headerMap[location.pathname] || headerMap['/'];

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#e5e7eb',
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#111827'
    }}>
      <Sidebar />
      <div style={{
        flex: 1,
        minHeight: '100vh',
        background: '#e5e7eb',
        color: '#111827',
        marginLeft: '240px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          background: '#ffffff',
          borderBottom: '1px solid #111827'
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '24px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '24px'
          }}>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>
                {header.title}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                {header.subtitle}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Welcome back</span>
              <span style={{
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
                VC
              </span>
            </div>
          </div>
        </div>
        <div style={{
          flex: 1,
          padding: '32px',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%'
        }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
