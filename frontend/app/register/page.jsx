'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { startRegistration } from '@/lib/webauthn';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [displayNames, setDisplayNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingNames, setLoadingNames] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    authAPI.getDisplayNames()
      .then(({ data }) => setDisplayNames(data.display_names))
      .catch(() => setError('Failed to load display names. Please refresh.'))
      .finally(() => setLoadingNames(false));
  }, []);

  // Debounced username availability check
  useEffect(() => {
    if (username.trim().length < 3) { setUsernameAvailable(null); return; }
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const { data } = await authAPI.checkUsername(username.trim());
        setUsernameAvailable(data.available);
      } catch { setUsernameAvailable(null); }
      finally { setCheckingUsername(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (username.trim().length < 3) return setError('Username must be at least 3 characters');
    if (usernameAvailable === false) return setError('Username is taken');
    if (!displayName) return setError('Please select a display name');

    try {
      setLoading(true);
      setError(null);
      
      const { data: beginData } = await authAPI.webAuthnRegisterBegin({
        username: username.trim(),
        display_name: displayName,
      });

      const attResp = await startRegistration(beginData.options);

      const { data: finishData } = await authAPI.webAuthnRegisterFinish({
        session_id: beginData.session_id,
        credential: attResp,
      });

      localStorage.setItem('token', finishData.access_token);
      localStorage.setItem('user', JSON.stringify(finishData.user));
      router.push('/chat');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card fade-in">
        <div className="auth-logo">✨</div>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle text-muted">Join the anonymous chat</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Display Name */}
          <div className="form-group">
            <label htmlFor="reg-display-name">Display Name</label>
            <select
              id="reg-display-name"
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loadingNames}
              required
              style={{ cursor: loadingNames ? 'not-allowed' : 'pointer' }}
            >
              <option value="">{loadingNames ? 'Loading names...' : 'Select a display name'}</option>
              {displayNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <span className="form-hint">Choose your anonymous identity from 50 unique names</span>
          </div>

          {/* Username */}
          <div className="form-group">
            <label htmlFor="reg-username">Username</label>
            <div style={{ position: 'relative' }}>
              <input
                id="reg-username"
                className="input"
                type="text"
                placeholder="At least 3 characters"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                style={{
                  borderColor: username.trim().length >= 3
                    ? usernameAvailable === true ? 'var(--success)'
                    : usernameAvailable === false ? 'var(--danger)' : undefined
                    : undefined,
                  paddingRight: checkingUsername ? 40 : undefined,
                }}
              />
              {checkingUsername && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <div className="spinner" style={{ width: 16, height: 16 }} />
                </div>
              )}
            </div>
            {username.trim().length >= 3 && usernameAvailable !== null && (
              <span style={{ fontSize: '0.8rem', color: usernameAvailable ? 'var(--success)' : 'var(--danger)' }}>
                {usernameAvailable ? '✓ Username available' : '✗ Username already taken'}
              </span>
            )}
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading || loadingNames}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating Identity...</> : 'Set up Passkey & Join'}
          </button>
        </form>

        <p className="auth-switch text-muted">
          Already have an account?{' '}
          <button onClick={() => router.push('/login')} className="text-accent auth-link">Sign in</button>
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
        .auth-switch { text-align: center; font-size: 0.875rem; margin-top: 24px; display: block; }
        .auth-link { background: none; border: none; cursor: pointer; font-weight: 600; font-size: 0.875rem; }
        .form-hint { font-size: 0.78rem; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
