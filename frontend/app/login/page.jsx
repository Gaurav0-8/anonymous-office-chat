'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { authAPI } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await authAPI.googleLogin({ 
        id_token: credentialResponse.credential 
      });

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      if (data.is_new_user) {
        router.replace('/choose-name');
      } else {
        router.replace('/chat');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card fade-in">
        <div className="auth-logo">💬</div>
        <h1 className="auth-title">Welcome</h1>
        <p className="auth-subtitle text-muted">Sign in with your Google account to start chatting anonymously</p>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-google-container">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google Sign-In failed')}
            useOneTap
            width="340"
            theme="filled_black"
          />
        </div>

        {loading && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div className="spinner" style={{width:16,height:16}} />
            <span style={{ fontSize: '0.875rem' }}>Authenticating...</span>
          </div>
        )}

        <p className="auth-switch text-muted">
          Don't have an account?{' '}
          <button onClick={() => router.push('/welcome')} className="text-accent auth-link">
            Learn More
          </button>
        </p>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at top, rgba(124,106,247,0.12) 0%, transparent 60%), var(--bg-primary);
          padding: 24px;
        }
        .auth-card { padding: 40px; width: 100%; max-width: 420px; }
        .auth-logo { font-size: 2.5rem; text-align: center; margin-bottom: 12px; }
        .auth-title { font-size: 1.6rem; font-weight: 800; text-align: center; margin-bottom: 6px; }
        .auth-subtitle { text-align: center; font-size: 0.9rem; margin-bottom: 28px; display: block; }
        .auth-error {
          background: rgba(240,84,84,0.1); border: 1px solid rgba(240,84,84,0.3);
          color: var(--danger); border-radius: 8px; padding: 10px 14px;
          font-size: 0.875rem; margin-bottom: 16px;
        }
        .auth-google-container { display: flex; justify-content: center; margin-bottom: 16px; }
        .auth-switch { text-align: center; font-size: 0.875rem; margin-top: 24px; display: block; }
        .auth-link { background: none; border: none; cursor: pointer; font-weight: 600; font-size: 0.875rem; }
      `}</style>
    </div>
  );
}
