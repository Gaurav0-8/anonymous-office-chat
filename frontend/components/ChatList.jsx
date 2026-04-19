'use client';

import { useState, useEffect } from 'react';
import { chatsAPI } from '@/lib/api';

export default function ChatList({ currentUser, activeChatId, onChatSelect, ws }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadChats = async () => {
    try {
      const { data } = await chatsAPI.getMyChats();
      setChats(data || []);
    } catch (err) {
      console.error('Failed to load chats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  // Refresh chat list on new WebSocket messages or manual triggers
  useEffect(() => {
    const handleRefresh = () => loadChats();
    window.addEventListener('refresh-chat-list', handleRefresh);
    
    if (!ws) return () => window.removeEventListener('refresh-chat-list', handleRefresh);
    
    const wsHandler = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'new_message') loadChats();
      } catch {}
    };
    ws.addEventListener('message', wsHandler);
    return () => {
      ws.removeEventListener('message', wsHandler);
      window.removeEventListener('refresh-chat-list', handleRefresh);
    };
  }, [ws]);

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Chats
        </span>
      </div>

      {/* Main Group Chat — always first */}
      <button
        className={`chat-list-item ${activeChatId === 1 ? 'active' : ''}`}
        onClick={() => onChatSelect(1, 'group')}
      >
        <div className="chat-item-icon group-icon">🌐</div>
        <div className="chat-item-info">
          <span className="chat-item-name">Main Group Chat</span>
          <span className="chat-item-preview text-muted">Everyone is here</span>
        </div>
      </button>

      <div className="chat-list-divider">
        <span className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Private Chats
        </span>
      </div>

      {loading ? (
        <div className="chat-list-loading">
          <div className="spinner" style={{ width: 18, height: 18 }} />
        </div>
      ) : (
        chats
          .filter((c) => c.chat_id !== 1)
          .map((chat) => (
            <button
              key={chat.chat_id}
              className={`chat-list-item ${activeChatId === chat.chat_id ? 'active' : ''}`}
              onClick={() => onChatSelect(chat.chat_id, 'private')}
            >
              <div className="chat-item-icon private-icon">
                {chat.last_sender_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="chat-item-info">
                <span className="chat-item-name">
                  {chat.last_sender_name || `Chat #${chat.chat_id}`}
                </span>
                <span className="chat-item-preview text-muted">
                  {chat.last_message
                    ? chat.last_message.substring(0, 35) + (chat.last_message.length > 35 ? '…' : '')
                    : 'No messages yet'}
                </span>
              </div>
              {chat.unread_count > 0 && (
                <span className="chat-unread-badge">{chat.unread_count}</span>
              )}
            </button>
          ))
      )}

      <style jsx>{`
        .chat-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 2px; }
        .chat-list-header { padding: 8px 8px 4px; }
        .chat-list-divider { padding: 12px 8px 4px; }
        .chat-list-loading { display: flex; justify-content: center; padding: 16px; }
        .chat-list-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          background: none; border: none; cursor: pointer;
          color: var(--text-primary); width: 100%; text-align: left;
          transition: background 0.15s;
        }
        .chat-list-item:hover { background: var(--bg-input); }
        .chat-list-item.active { background: var(--accent-glow); color: var(--accent); }
        .chat-item-icon {
          width: 38px; height: 38px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem; flex-shrink: 0; font-weight: 700;
        }
        .group-icon { background: rgba(124,106,247,0.15); font-size: 1.1rem; }
        .private-icon { background: linear-gradient(135deg, var(--accent), #a855f7); color: white; font-size: 0.9rem; }
        .chat-item-info { flex: 1; overflow: hidden; }
        .chat-item-name { display: block; font-size: 0.875rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-item-preview { font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
        .chat-unread-badge {
          background: var(--accent); color: white;
          border-radius: 12px; padding: 2px 7px;
          font-size: 0.7rem; font-weight: 700; flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
