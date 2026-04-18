'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { startAuthentication } from '@/lib/webauthn';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return setError('Username is required');

    try {
      setLoading(true);
      setError(null);
      
      const { data: beginData } = await authAPI.webAuthnLoginBegin({ username: username.trim() });
      
      const asseResp = await startAuthentication(beginData.options);
      
      const { data: finishData } = await authAPI.webAuthnLoginFinish({
        session_id: beginData.session_id,
        credential: asseResp,
      });

      localStorage.setItem('token', finishData.access_token);
      localStorage.setItem('user', JSON.stringify(finishData.user));
      router.replace('/chat');
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
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle text-muted">Sign in to continue chatting</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className="input"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <><div className="spinner" style={{width:16,height:16}} /> Verifying Face ID...</> : 'Sign In with Passkey'}
          </button>
        </form>

        <p className="auth-switch text-muted">
          Don't have an account?{' '}
          <button onClick={() => router.push('/register')} className="text-accent auth-link">
            Register
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
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .auth-switch { text-align: center; font-size: 0.875rem; margin-top: 24px; display: block; }
        .auth-link { background: none; border: none; cursor: pointer; font-weight: 600; font-size: 0.875rem; }
      `}</style>
    </div>
  );
}
