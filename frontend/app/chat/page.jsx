'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { chatsAPI } from '@/lib/api';
import MainChat from '@/components/MainChat';
import PrivateChat from '@/components/PrivateChat';
import ChatList from '@/components/ChatList';

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeChatId, setActiveChatId] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('last-active-chat-id')) || 1;
    }
    return 1;
  });
  const [activeChatType, setActiveChatType] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('last-active-chat-type') || 'group';
    }
    return 'group';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const wsRef = useRef(null);
  const [wsReady, setWsReady] = useState(false);
  const [toast, setToast] = useState(null);

  // Re-sync refs
  const activeChatIdRef = useRef(activeChatId);
  const userRef = useRef(user);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Auto-open sidebar on Desktop only
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      setSidebarOpen(true);
    }
  }, []);

  // Auth guard + Restore Persistence
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      router.replace('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
  }, [router]);

  // Persist session state
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('last-active-chat-id', activeChatId.toString());
      localStorage.setItem('last-active-chat-type', activeChatType);
    }
  }, [activeChatId, activeChatType]);

  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  // WebSocket connection with Smart Reconnect (Exponential Backoff)
  const connectWS = useCallback(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const fallbackUrl = `${protocol}//${window.location.host}/ws`;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || fallbackUrl;
    
    const ws = new WebSocket(`${wsUrl}?token=${token}`);

    ws.onopen = () => {
      setWsReady(true);
      reconnectAttemptsRef.current = 0; // Reset attempts on success
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (data.type === 'new_message') {
                const currentChatId = activeChatIdRef.current;
                const currentUser = userRef.current;
                
                if (data.message?.chat_id !== currentChatId && data.message?.sender_id !== currentUser?.user_id) {
                    setToast({
                        name: data.message.sender_name,
                        text: data.message.message_text,
                        chatId: data.message.chat_id
                    });
                }
            }
        } catch {}
    };

    ws.onclose = () => {
      setWsReady(false);
      // Smart Reconnect: Wait longer each time (3s, 6s, 12s... up to 60s)
      const delay = Math.min(3000 * Math.pow(2, reconnectAttemptsRef.current), 60000);
      
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptsRef.current++;
        connectWS();
      }, delay);
    };

    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, [user]);

  useEffect(() => {
    connectWS();

    // Recover connection when user returns to the tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connectWS();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [connectWS]);

  const handleStartPrivateChat = async (targetUserId) => {
    try {
      const res = await chatsAPI.createPrivateChat(targetUserId);
      handleChatSelect(res.data.chat_id, 'private');
      // Force refresh sidebar list
      window.dispatchEvent(new Event('refresh-chat-list'));
    } catch (err) {
      console.error('Failed to start private chat:', err);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('last-active-chat-id');
    localStorage.removeItem('last-active-chat-type');
    if (wsRef.current) wsRef.current.close();
    router.replace('/login');
  };

  const handleChatSelect = (chatId, chatType) => {
    setActiveChatId(chatId);
    setActiveChatType(chatType);
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <aside className={`chat-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="sidebar-logo">💬</span>
            <span className="sidebar-title">ChatApp</span>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">{user.display_name?.[0]?.toUpperCase() || '👤'}</div>
          <div className="user-info">
            <span className="user-name">{user.display_name || 'Anonymous'}</span>
            <span className="user-role text-muted">{user.role}</span>
          </div>
          <div className="sidebar-user-actions" style={{ display: 'flex', gap: '4px' }}>
            <button 
              className="install-shortcut-btn" 
              onClick={() => {
                localStorage.removeItem('pwa-install-dismissed');
                window.dispatchEvent(new Event('trigger-pwa-install'));
              }}
              title="Install App"
            >
              📥
            </button>
            <button className="sidebar-logout-btn" onClick={logout} title="Logout">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        <ChatList
          currentUser={user}
          activeChatId={activeChatId}
          onChatSelect={(id, type) => { handleChatSelect(id, type); setSidebarOpen(false); }}
          ws={wsRef.current}
        />
      </aside>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="chat-main">
        {/* Mobile header bar with hamburger */}
        <div className="mobile-topbar">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <span className="mobile-title">💬 ChatApp</span>
        </div>
        {activeChatType === 'group' ? (
          <MainChat
            currentUser={user}
            chatId={activeChatId}
            ws={wsRef.current}
            wsReady={wsReady}
            onStartPrivateChat={handleStartPrivateChat}
          />
        ) : (
          <PrivateChat
            currentUser={user}
            chatId={activeChatId}
            ws={wsRef.current}
            wsReady={wsReady}
            onBack={() => handleChatSelect(1, 'group')}
          />
        )}
      </main>

      {/* Real-time Toast Notification */}
      {toast && (
        <div className="toast-notification-container" onClick={() => handleChatSelect(toast.chatId, 'private')}>
            <div className="toast-icon">💬</div>
            <div className="toast-info">
                <div className="toast-name">New message from {toast.name}</div>
                <div className="toast-text">{toast.text?.substring(0, 40)}{toast.text?.length > 40 ? '...' : ''}</div>
            </div>
        </div>
      )}

      <style jsx>{`
        .toast-notification-container {
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: #1c1c28; border: 1px solid rgba(124, 106, 247, 0.3);
            border-radius: 16px; padding: 12px 20px; min-width: 300px;
            display: flex; align-items: center; gap: 14px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            cursor: pointer; z-index: 100000;
            animation: toastSlideIn 0.3s ease-out;
        }
        @keyframes toastSlideIn { from { transform: translate(-50%, -100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .toast-icon { 
            width: 40px; height: 40px; border-radius: 50%; 
            background: linear-gradient(135deg, var(--accent), #a855f7);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.2rem; flex-shrink: 0;
        }
        .toast-name { font-size: 0.85rem; font-weight: 700; color: white; }
        .toast-text { font-size: 0.8rem; color: #888; margin-top: 2px; }
        .chat-layout {
          display: flex;
          height: 100dvh;
          overflow: hidden;
          background: var(--bg-primary);
        }
        .chat-sidebar {
          width: 300px;
          min-width: 300px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .chat-main {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .sidebar-brand { display: flex; align-items: center; gap: 10px; }
        .sidebar-logo { font-size: 1.4rem; }
        .sidebar-title { font-size: 1rem; font-weight: 700; }
        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }
        .user-avatar {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, var(--accent), #a855f7);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 700; font-size: 0.9rem;
          flex-shrink: 0;
        }
        .user-info { flex: 1; overflow: hidden; }
        .user-name { display: block; font-weight: 600; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-role { font-size: 0.75rem; }
        .logout-btn { padding: 6px 10px; flex-shrink: 0; }
        @media (max-width: 768px) {
          .chat-sidebar {
            position: fixed; z-index: 200; height: 100%; width: 280px;
            transform: translateX(-100%); transition: transform 0.3s ease;
            box-shadow: 4px 0 20px rgba(0,0,0,0.3);
          }
          .chat-sidebar.open { transform: translateX(0); }
          .sidebar-backdrop {
            position: fixed; inset: 0; z-index: 199;
            background: rgba(0,0,0,0.5);
          }
          .mobile-topbar {
            display: flex; align-items: center; gap: 12px;
            padding: max(10px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 10px max(16px, env(safe-area-inset-left)); 
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border); flex-shrink: 0;
            z-index: 100;
          }
          .mobile-title { flex: 1; font-weight: 700; font-size: 1.1rem; }
          .hamburger-btn {
            background: none; border: none; font-size: 1.5rem;
            cursor: pointer; color: var(--text-primary); padding: 4px;
            display: flex; align-items: center; justify-content: center;
          }
        }
        @media (min-width: 769px) {
          .mobile-topbar { display: none; }
          .sidebar-backdrop { display: none; }
        }
        .sidebar-user-actions {
          display: flex;
          gap: 6px;
          margin-left: auto;
        }
        .install-shortcut-btn, .sidebar-logout-btn {
          background: #252535;
          border: 1px solid #2e2e45;
          color: #8888aa;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 0.9rem;
        }
        .install-shortcut-btn:hover {
          background: #7c6af7;
          color: white;
          border-color: #8b5cf6;
          box-shadow: 0 0 15px rgba(124, 106, 247, 0.3);
          transform: translateY(-1px);
        }
        .sidebar-logout-btn:hover {
          background: #ef4444;
          color: white;
          border-color: #f87171;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
