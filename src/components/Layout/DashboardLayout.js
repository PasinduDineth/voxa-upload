import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

function DashboardLayout() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#0b1c2d',
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#e5e7eb'
    }}>
      <Sidebar />
      <div style={{
        flex: 1,
        minHeight: '100vh',
        background: '#111827',
        color: '#e5e7eb'
      }}>
        <Outlet />
      </div>
    </div>
  );
}

export default DashboardLayout;
