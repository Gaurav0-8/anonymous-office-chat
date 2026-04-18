'use client';

import { useState, useEffect } from 'react';
import { messagesAPI } from '@/lib/api';

export default function MessageReadersModal({ messageId, onClose }) {
  const [readers, setReaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    messagesAPI.getReaders(messageId)
      .then(({ data }) => setReaders(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [messageId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="readers-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="readers-header">
          <h3>Read by</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="readers-body">
          {loading ? (
            <div className="readers-loading"><div className="spinner" /></div>
          ) : readers.length === 0 ? (
            <p className="text-muted readers-empty">No one has read this message yet</p>
          ) : (
            readers.map((r, i) => (
              <div key={i} className="reader-item">
                <div className="reader-avatar">{r.display_name?.[0]?.toUpperCase()}</div>
                <div>
                  <p className="reader-name">{r.display_name}</p>
                  <p className="reader-time text-muted">
                    {new Date(r.read_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; animation: fadeIn 0.2s ease;
        }
        .readers-modal { width: 100%; max-width: 360px; padding: 0; overflow: hidden; }
        .readers-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid var(--border);
        }
        .readers-header h3 { font-size: 0.95rem; font-weight: 700; margin: 0; }
        .modal-close-btn {
          background: none; border: none; cursor: pointer; font-size: 1rem;
          color: var(--text-secondary); padding: 4px; border-radius: 4px;
        }
        .modal-close-btn:hover { color: var(--danger); }
        .readers-body { padding: 12px; max-height: 300px; overflow-y: auto; }
        .readers-loading { display: flex; justify-content: center; padding: 20px; }
        .readers-empty { text-align: center; padding: 20px; font-size: 0.875rem; }
        .reader-item { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; }
        .reader-item:hover { background: var(--bg-input); }
        .reader-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), #a855f7);
          color: white; font-weight: 700; font-size: 0.8rem;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .reader-name { font-size: 0.875rem; font-weight: 600; margin: 0; }
        .reader-time { font-size: 0.75rem; margin: 0; }
      `}</style>
    </div>
  );
}
