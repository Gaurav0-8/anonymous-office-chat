'use client';

import { chatsAPI } from '@/lib/api';
import { useState } from 'react';

export default function UserSidebar({ participants, currentUser, highlightUserId, onClose, onSelectChat }) {
  const [starting, setStarting] = useState(null);

  const handlePrivateChat = async (targetUserId) => {
    try {
      setStarting(targetUserId);
      const { data } = await chatsAPI.createPrivateChat(targetUserId);
      if (onSelectChat) onSelectChat(data.chat_id, 'private');
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start private chat');
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="sidebar-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="sidebar-header">
          <h3>👥 Participants ({participants.filter(p => p.user_id !== currentUser.user_id).length})</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="sidebar-body">
          {participants
            .filter((p) => p.user_id !== currentUser.user_id) // hide own name for privacy
            .map((p) => (
            <div key={p.user_id} className={`participant-row ${p.user_id === highlightUserId ? 'highlighted' : ''}`}>
              <div className="participant-avatar">
                {p.display_name?.[0]?.toUpperCase()}
                {p.is_online && <span className="online-dot" />}
              </div>
              <div className="participant-info">
                <span className="participant-name">{p.display_name}</span>
                <div className="participant-badges">
                  {p.is_banned && <span className="badge badge-danger">Banned</span>}
                  {p.is_muted && <span className="badge badge-warning">Muted</span>}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handlePrivateChat(p.user_id)}
                disabled={starting === p.user_id}
              >
                {starting === p.user_id ? '...' : '💬'}
              </button>
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
        .sidebar-modal { width: 100%; max-width: 360px; padding: 0; overflow: hidden; max-height: 80vh; display: flex; flex-direction: column; }
        .sidebar-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        .sidebar-header h3 { font-size: 0.95rem; font-weight: 700; margin: 0; }
        .modal-close-btn { background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--text-secondary); }
        .modal-close-btn:hover { color: var(--danger); }
        .sidebar-body { overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
        .participant-row {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px; transition: background 0.15s;
        }
        .participant-row:hover { background: var(--bg-input); }
        .participant-row.highlighted { background: var(--accent-glow); }
        .participant-avatar {
          width: 36px; height: 36px; border-radius: 50%; position: relative;
          background: linear-gradient(135deg, var(--accent), #a855f7);
          color: white; font-weight: 700; font-size: 0.85rem;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .online-dot {
          position: absolute; bottom: 1px; right: 1px;
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--online); border: 2px solid var(--bg-card);
        }
        .participant-info { flex: 1; overflow: hidden; }
        .participant-name { font-size: 0.875rem; font-weight: 600; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .you-badge { font-size: 0.75rem; color: var(--text-muted); font-weight: 400; }
        .participant-badges { display: flex; gap: 4px; margin-top: 2px; }
        .badge { font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
        .badge-danger { background: rgba(240,84,84,0.15); color: var(--danger); }
        .badge-warning { background: rgba(245,166,35,0.15); color: var(--warning); }
        .btn-sm { padding: 5px 10px; font-size: 0.8rem; flex-shrink: 0; }
      `}</style>
    </div>
  );
}
