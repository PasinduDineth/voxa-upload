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
      backgroundColor: '#e5e7eb',
      fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#111827'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        padding: '32px',
        border: '1px solid #111827',
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        {status === 'processing' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              border: '2px solid #111827',
              background: '#e5e7eb',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              color: '#111827'
            }}>⏳</div>
            <h2 style={{ color: '#111827', marginBottom: '10px', fontSize: '18px' }}>Processing...</h2>
            <p style={{ color: '#6b7280', fontSize: '13px' }}>{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#0b1c2d',
              margin: '0 auto 16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#4fd1c5',
              fontSize: '24px',
              fontWeight: 600
            }}>✓</div>
            <h2 style={{ color: '#111827', marginBottom: '10px', fontSize: '18px' }}>Success!</h2>
            <p style={{ color: '#6b7280', fontSize: '13px' }}>{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#111827',
              margin: '0 auto 16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#e5e7eb',
              fontSize: '24px',
              fontWeight: 600
            }}>✕</div>
            <h2 style={{ color: '#111827', marginBottom: '10px', fontSize: '18px' }}>Error</h2>
            <p style={{ color: '#6b7280', fontSize: '13px' }}>{message}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default OAuthCallback;
