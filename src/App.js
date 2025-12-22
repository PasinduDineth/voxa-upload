import React, { useState } from 'react';
import TikTokUploader from './components/TikTokUploader';
import YouTubeUploader from './components/YouTubeUploader';

function App() {
  const [platform, setPlatform] = useState('tiktok');

  return (
    <div className="App">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: 20, 
        padding: '20px 0',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <button
          onClick={() => setPlatform('tiktok')}
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            fontWeight: 600,
            border: 'none',
            borderRadius: '25px',
            cursor: 'pointer',
            background: platform === 'tiktok' ? 'white' : 'rgba(255,255,255,0.2)',
            color: platform === 'tiktok' ? '#667eea' : 'white',
            transition: 'all 0.3s ease',
            boxShadow: platform === 'tiktok' ? '0 4px 15px rgba(0,0,0,0.2)' : 'none'
          }}
        >
          🎵 TikTok
        </button>
        <button
          onClick={() => setPlatform('youtube')}
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            fontWeight: 600,
            border: 'none',
            borderRadius: '25px',
            cursor: 'pointer',
            background: platform === 'youtube' ? 'white' : 'rgba(255,255,255,0.2)',
            color: platform === 'youtube' ? '#FF0000' : 'white',
            transition: 'all 0.3s ease',
            boxShadow: platform === 'youtube' ? '0 4px 15px rgba(0,0,0,0.2)' : 'none'
          }}
        >
          ▶️ YouTube
        </button>
      </div>
      
      {platform === 'tiktok' ? <TikTokUploader /> : <YouTubeUploader />}
    </div>
  );
}

export default App;
