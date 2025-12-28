import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

function DashboardLayout() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#050816',
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <Sidebar />
      <div style={{
        flex: 1,
        minHeight: '100vh',
        background: '#020617'
      }}>
        <Outlet />
      </div>
    </div>
  );
}

export default DashboardLayout;
