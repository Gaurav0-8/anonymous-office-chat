'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { startRegistration } from '@simplewebauthn/browser';

export default function AdminSetupPage() {
  const router = useRouter();
  const [setupToken, setSetupToken] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!setupToken) return setError('Setup token is required');
    if (username.trim().length < 3) return setError('Username must be at least 3 characters');
    if (!displayName) return setError('Display name is required');

    try {
      setLoading(true);
      setError(null);

      // Begin Admin Setup
      const { data: beginData } = await authAPI.adminSetupBegin({
        username: username.trim(),
        display_name: displayName.trim(),
      }, setupToken);

      // WebAuthn prompt
      const attResp = await startRegistration(beginData.options);

      // Finish setup
      const { data: finishData } = await authAPI.adminSetupFinish({
        session_id: beginData.session_id,
        credential: attResp,
      });

      setSuccess(true);
      
      // Auto login
      localStorage.setItem('token', finishData.access_token);
      localStorage.setItem('user', JSON.stringify(finishData.user));
      
      setTimeout(() => {
        router.push('/chat');
      }, 1500);
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card card fade-in" style={{ textAlign: 'center' }}>
          <div className="auth-logo">✅</div>
          <h1 className="auth-title">Admin Created</h1>
          <p className="auth-subtitle text-muted">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card card fade-in">
        <div className="auth-logo">🛡️</div>
        <h1 className="auth-title">Admin Setup</h1>
        <p className="auth-subtitle text-muted">Initialize the administrative account</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="setup-token">Setup Token</label>
            <input
              id="setup-token"
              className="input"
              type="password"
              placeholder="Enter secret environment token"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-username">Admin Username</label>
            <input
              id="admin-username"
              className="input"
              type="text"
              placeholder="Admin login name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-display">Display Name</label>
            <input
              id="admin-display"
              className="input"
              type="text"
              placeholder="E.g. System Administrator"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating Identity...</> : 'Set up Admin Passkey'}
          </button>
        </form>
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
        .auth-card { padding: 40px; width: 100%; max-width: 440px; }
        .auth-logo { font-size: 2.5rem; text-align: center; margin-bottom: 12px; }
        .auth-title { font-size: 1.6rem; font-weight: 800; text-align: center; margin-bottom: 6px; }
        .auth-subtitle { text-align: center; font-size: 0.9rem; margin-bottom: 28px; display: block; }
        .auth-error {
          background: rgba(240,84,84,0.1); border: 1px solid rgba(240,84,84,0.3);
          color: var(--danger); border-radius: 8px; padding: 10px 14px;
          font-size: 0.875rem; margin-bottom: 16px;
        }
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
      `}</style>
    </div>
  );
}
