'use client';

import { useState } from 'react';
import { adminAPI } from '@/lib/api';

export default function AdminControls({ participants, onClose, onRefresh }) {
  const [loading, setLoading] = useState(null); // ID of user being acted on
  const [muteUntil, setMuteUntil] = useState({});

  const act = async (action, userId) => {
    try {
      setLoading(userId);
      if (action === 'ban') await adminAPI.ban(userId);
      else if (action === 'unban') await adminAPI.unban(userId);
      else if (action === 'mute') {
        const until = muteUntil[userId];
        if (!until) { alert('Select a mute expiry time first'); return; }
        await adminAPI.mute(userId, new Date(until).toISOString());
      }
      else if (action === 'unmute') await adminAPI.unmute(userId);
      await onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="admin-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header">
          <h3>🛡️ Admin Controls</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="admin-body">
          {participants.map((p) => (
            <div key={p.user_id} className="admin-user-row">
              <div className="admin-user-avatar">
                {p.display_name?.[0]?.toUpperCase()}
              </div>
              <div className="admin-user-info">
                <span className="admin-user-name">{p.display_name}</span>
                <div className="admin-status-badges">
                  {p.is_banned && <span className="badge badge-danger">Banned</span>}
                  {p.is_muted && <span className="badge badge-warning">Muted</span>}
                </div>
              </div>
              <div className="admin-actions">
                {!p.is_banned ? (
                  <button className="btn btn-danger btn-sm" onClick={() => act('ban', p.user_id)} disabled={loading === p.user_id}>
                    Ban
                  </button>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={() => act('unban', p.user_id)} disabled={loading === p.user_id}>
                    Unban
                  </button>
                )}
                {!p.is_muted ? (
                  <>
                    <input
                      type="datetime-local"
                      className="input mute-input"
                      onChange={(e) => setMuteUntil({ ...muteUntil, [p.user_id]: e.target.value })}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={() => act('mute', p.user_id)} disabled={loading === p.user_id}>
                      Mute
                    </button>
                  </>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={() => act('unmute', p.user_id)} disabled={loading === p.user_id}>
                    Unmute
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; animation: fadeIn 0.2s ease;
        }
        .admin-modal { width: 100%; max-width: 600px; padding: 0; overflow: hidden; max-height: 80vh; display: flex; flex-direction: column; }
        .admin-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        .admin-header h3 { font-size: 1rem; font-weight: 700; margin: 0; }
        .modal-close-btn { background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--text-secondary); }
        .modal-close-btn:hover { color: var(--danger); }
        .admin-body { overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
        .admin-user-row {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px; background: var(--bg-input);
        }
        .admin-user-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), #a855f7);
          color: white; font-weight: 700; font-size: 0.85rem;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .admin-user-info { flex: 1; }
        .admin-user-name { font-size: 0.875rem; font-weight: 600; display: block; }
        .admin-status-badges { display: flex; gap: 4px; margin-top: 2px; }
        .badge { font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
        .badge-danger { background: rgba(240,84,84,0.15); color: var(--danger); }
        .badge-warning { background: rgba(245,166,35,0.15); color: var(--warning); }
        .admin-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .btn-sm { padding: 5px 10px; font-size: 0.78rem; }
        .mute-input { width: 170px; padding: 5px 8px; font-size: 0.78rem; }
      `}</style>
    </div>
  );
}
