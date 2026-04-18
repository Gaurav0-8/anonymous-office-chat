'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';

export default function ChooseNamePage() {
  const router = useRouter();
  const [names, setNames] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNames = async () => {
      try {
        const { data } = await authAPI.getDisplayNames();
        setNames(data.display_names);
        // Pre-select a random one
        if (data.display_names.length > 0) {
          setSelected(data.display_names[Math.floor(Math.random() * data.display_names.length)]);
        }
      } catch (err) {
        setError('Failed to load names');
      } finally {
        setFetching(false);
      }
    };
    fetchNames();
  }, []);

  const handleConfirm = async () => {
    if (!selected) return;
    try {
      setLoading(true);
      await authAPI.setName({ display_name: selected });
      
      // Update local storage user info
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.display_name = selected;
      localStorage.setItem('user', JSON.stringify(user));
      
      router.replace('/chat');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to set name');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="setup-page"><div className="spinner" /></div>;

  return (
    <div className="setup-page">
      <div className="setup-card card fade-in">
        <h1 className="setup-title">Choose Your Identity</h1>
        <p className="setup-subtitle text-muted">
          Pick an anonymous persona. This is how others will see you in the chat.
        </p>

        {error && <div className="setup-error">{error}</div>}

        <div className="name-grid">
          {names.map(name => (
            <button
              key={name}
              className={`name-chip ${selected === name ? 'active' : ''}`}
              onClick={() => setSelected(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <button 
          className="btn btn-primary w-full" 
          onClick={handleConfirm}
          disabled={loading || !selected}
          style={{ marginTop: 24 }}
        >
          {loading ? 'Joining Chat...' : `Join as ${selected}`}
        </button>
      </div>

      <style jsx>{`
        .setup-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          padding: 24px;
        }
        .setup-card {
          width: 100%;
          max-width: 600px;
          padding: 40px;
        }
        .setup-title { font-size: 1.8rem; font-weight: 800; text-align: center; margin-bottom: 8px; }
        .setup-subtitle { text-align: center; margin-bottom: 32px; font-size: 0.95rem; }
        .name-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
          max-height: 350px;
          overflow-y: auto;
          padding: 10px;
          border-radius: 12px;
          background: rgba(0,0,0,0.2);
        }
        .name-chip {
          padding: 10px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03);
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s;
          text-align: center;
        }
        .name-chip:hover { background: rgba(255,255,255,0.08); border-color: var(--accent); }
        .name-chip.active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
          box-shadow: 0 4px 12px rgba(124,106,247,0.3);
        }
        .setup-error {
          color: var(--danger); background: rgba(240,84,84,0.1);
          padding: 10px; border-radius: 8px; margin-bottom: 16px;
          font-size: 0.9rem; text-align: center;
        }
      `}</style>
    </div>
  );
}
