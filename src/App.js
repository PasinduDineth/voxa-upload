import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardLayout from './components/Layout/DashboardLayout';
import Dashboard from './components/Dashboard';
import TikTokUploader from './components/TikTokUploader';
import YouTubeUploader from './components/YouTubeUploader';
import FacebookUploader from './components/FacebookUploader';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="tiktok" element={<TikTokUploader />} />
          <Route path="youtube" element={<YouTubeUploader />} />
          <Route path="facebook" element={<FacebookUploader />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
