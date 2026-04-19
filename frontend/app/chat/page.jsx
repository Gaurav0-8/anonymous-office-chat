'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { chatsAPI } from '@/lib/api';
import MainChat from '@/components/MainChat';
import PrivateChat from '@/components/PrivateChat';
import ChatList from '@/components/ChatList';
import ThemeToggle from '@/components/ThemeToggle';

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeChatId, setActiveChatId] = useState(1); // Default to main group chat
  const [activeChatType, setActiveChatType] = useState('group');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const wsRef = useRef(null);
  const [wsReady, setWsReady] = useState(false);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      router.replace('/login');
      return;
    }
    setUser(JSON.parse(userData));
  }, [router]);

  // WebSocket connection
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    // Dynamically use the current page's host — works on local, Cloudflare, any domain
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const fallbackUrl = `${protocol}//${window.location.host}/ws`;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || fallbackUrl;
    const ws = new WebSocket(`${wsUrl}?token=${token}`);

    ws.onopen = () => {
      setWsReady(true);
      console.log('[WS] Connected');
    };
    ws.onclose = () => {
      setWsReady(false);
      console.log('[WS] Disconnected');
    };
    ws.onerror = (e) => console.error('[WS] Error:', e);

    wsRef.current = ws;
    return () => ws.close();
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
          <div className="sidebar-actions">
            <ThemeToggle />
          </div>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">👤</div>
          <div className="user-info">
            <span className="user-name">Anonymous</span>
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
            <button className="sidebar-logout-btn" onClick={handleLogout} title="Logout">
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
          <ThemeToggle />
        </div>
        {activeChatType === 'group' ? (
          <MainChat
            currentUser={user}
            chatId={activeChatId}
            ws={wsRef.current}
            wsReady={wsReady}
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

      <style jsx>{`
        .chat-layout {
          display: flex;
          height: 100vh;
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
            padding: 10px 16px; background: var(--bg-secondary);
            border-bottom: 1px solid var(--border); flex-shrink: 0;
          }
          .mobile-title { flex: 1; font-weight: 700; font-size: 1rem; }
          .hamburger-btn {
            background: none; border: none; font-size: 1.3rem;
            cursor: pointer; color: var(--text-primary); padding: 4px;
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
