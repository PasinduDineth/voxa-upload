import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const scopes = searchParams.get('scopes');

      if (!code || !state) {
        setStatus('error');
        setMessage('Missing authorization code or state. Please try again.');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      // Determine which platform based on state prefix
      const isYouTube = state.startsWith('youtube_');
      const platform = isYouTube ? 'YouTube' : 'TikTok';
      const redirectPath = isYouTube ? '/youtube' : '/tiktok';
      
      // Get code_verifier from session storage
      const codeVerifier = isYouTube 
        ? sessionStorage.getItem('youtube_oauth_code_verifier')
        : sessionStorage.getItem('oauth_code_verifier');
      const storedState = isYouTube
        ? sessionStorage.getItem('youtube_oauth_state')
        : sessionStorage.getItem('oauth_state');
      
      if (!codeVerifier) {
        setStatus('error');
        setMessage('Code verifier not found. Please restart the authentication flow.');
        setTimeout(() => navigate(redirectPath), 3000);
        return;
      }

      if (!storedState || storedState !== state) {
        setStatus('error');
        setMessage('State mismatch. Please restart the authentication flow.');
        setTimeout(() => navigate(redirectPath), 3000);
        return;
      }

      try {
        // Call the appropriate backend API to exchange code for token
        const apiEndpoint = isYouTube ? '/api/youtube-oauth-callback' : '/api/tiktok-oauth-callback';
        
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            state,
            code_verifier: codeVerifier
          }),
        });

        const data = await response.json();

        if (data.success) {
          setStatus('success');
          setMessage(`Successfully authenticated with ${platform}! Redirecting...`);
          
          // Clean up session storage
          if (isYouTube) {
            sessionStorage.removeItem('youtube_oauth_code_verifier');
            sessionStorage.removeItem('youtube_oauth_state');
            sessionStorage.removeItem('youtube_oauth_adding_channel');
          } else {
            sessionStorage.removeItem('oauth_code_verifier');
            sessionStorage.removeItem('oauth_state');
            sessionStorage.removeItem('oauth_adding_account');
          }
          
          // Redirect to appropriate page
          setTimeout(() => navigate(redirectPath), 2000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Authentication failed. Please try again.');
          setTimeout(() => navigate(redirectPath), 3000);
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage('An error occurred during authentication. Please try again.');
        setTimeout(() => navigate(redirectPath), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        {status === 'processing' && (
          <>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #3498db',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <h2 style={{ color: '#333', marginBottom: '10px' }}>Processing...</h2>
            <p style={{ color: '#666' }}>{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div style={{
              width: '50px',
              height: '50px',
              backgroundColor: '#4CAF50',
              borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
              fontSize: '30px'
            }}>✓</div>
            <h2 style={{ color: '#4CAF50', marginBottom: '10px' }}>Success!</h2>
            <p style={{ color: '#666' }}>{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div style={{
              width: '50px',
              height: '50px',
              backgroundColor: '#f44336',
              borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
              fontSize: '30px'
            }}>✕</div>
            <h2 style={{ color: '#f44336', marginBottom: '10px' }}>Error</h2>
            <p style={{ color: '#666' }}>{message}</p>
          </>
        )}
        
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default OAuthCallback;
