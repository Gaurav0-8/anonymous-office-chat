'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { chatsAPI, messagesAPI, imagesAPI } from '@/lib/api';
import MessageInput from './MessageInput';
import MediaMessage from './MediaMessage';
import ImageModal from './ImageModal';
import MessageReadersModal from './MessageReadersModal';
import AdminControls from './AdminControls';
import UserSidebar from './UserSidebar';

export default function MainChat({ currentUser, chatId, ws, wsReady }) {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showAdminControls, setShowAdminControls] = useState(false);
  const [showUserSidebar, setShowUserSidebar] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load initial messages and participants
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [msgsRes, chatRes] = await Promise.all([
        chatsAPI.getChatMessages(chatId),
        chatsAPI.getMainChat(),
      ]);
      setMessages(msgsRes.data || []);
      setParticipants(chatRes.data?.participants || []);
    } catch (err) {
      console.error('Failed to load chat data:', err);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // WebSocket message handler
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message' && data.message?.chat_id === chatId) {
          setMessages((prev) => {
            const exists = prev.find((m) => m.message_id === data.message.message_id);
            if (exists) return prev;
            return [...prev, { ...data.message, is_read: false, is_edited: false }];
          });
        }
      } catch { /* ignore parse errors */ }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, chatId]);

  const handleSend = async (text) => {
    await messagesAPI.send(chatId, text);
  };

  const handleImageSend = async (fileId, text) => {
    await imagesAPI.sendImageMessage(chatId, fileId, text);
  };

  const handleMessageRead = async (messageId) => {
    try {
      await messagesAPI.markRead(messageId);
      setMessages((prev) =>
        prev.map((m) => m.message_id === messageId ? { ...m, is_read: true } : m)
      );
    } catch { /* ignore */ }
  };

  const isOwnMessage = (msg) => msg.sender_id === currentUser.user_id;

  return (
    <div className="main-chat">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="chat-header-icon">🌐</span>
          <div>
            <h2 className="chat-header-title">Main Group Chat</h2>
            <span className="chat-header-sub text-muted">{participants.length} members</span>
          </div>
        </div>
        <div className="chat-header-actions">
          {currentUser.role === 'admin' && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowAdminControls(true)}
              title="Admin Controls"
            >
              🛡️
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => setShowUserSidebar(true)}
            title="Participants"
          >
            👥
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {loading ? (
          <div className="chat-loading">
            <div className="spinner" />
            <span className="text-muted">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <span>💬</span>
            <p>No messages yet. Be the first to say something!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.message_id}
              className={`message-wrapper ${isOwnMessage(msg) ? 'own' : 'other'} fade-in`}
              onMouseEnter={() => !msg.is_read && !isOwnMessage(msg) && handleMessageRead(msg.message_id)}
            >
              {!isOwnMessage(msg) && (
                <button
                  className="message-avatar"
                  onClick={() => { setSelectedUser(msg); setShowUserSidebar(true); }}
                  title={msg.sender_name}
                >
                  {msg.sender_name?.[0]?.toUpperCase()}
                </button>
              )}
              <div className={`message-bubble ${isOwnMessage(msg) ? 'message-own' : 'message-other'}`}>
                {!isOwnMessage(msg) && (
                  <span className="message-sender">{msg.sender_name}</span>
                )}
                {msg.image_file_id ? (
                  <MediaMessage
                    fileId={msg.image_file_id}
                    width={msg.image_width}
                    height={msg.image_height}
                    onOpen={(url) => setSelectedImage(url)}
                  />
                ) : null}
                {msg.message_text && (
                  <p className="message-text">{msg.message_text}</p>
                )}
                <div className="message-meta">
                  <span className="message-time">
                    {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.is_edited && <span className="message-edited">edited</span>}
                  {isOwnMessage(msg) && (
                    <button
                      className="message-readers-btn"
                      onClick={() => setSelectedMessage(msg)}
                      title="See who read this"
                    >
                      {msg.is_read ? '✓✓' : '✓'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onImageSend={handleImageSend}
        disabled={!wsReady}
        chatId={chatId}
      />

      {/* Modals */}
      {selectedImage && (
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
      {selectedMessage && (
        <MessageReadersModal
          messageId={selectedMessage.message_id}
          onClose={() => setSelectedMessage(null)}
        />
      )}
      {showUserSidebar && (
        <UserSidebar
          participants={participants}
          currentUser={currentUser}
          highlightUserId={selectedUser?.sender_id}
          onClose={() => { setShowUserSidebar(false); setSelectedUser(null); }}
          onStartPrivateChat={null}
        />
      )}
      {showAdminControls && (
        <AdminControls
          participants={participants}
          onClose={() => setShowAdminControls(false)}
          onRefresh={loadData}
        />
      )}

      <style jsx>{`
        .main-chat { display: flex; flex-direction: column; height: 100%; background: var(--bg-primary); }
        .chat-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }
        .chat-header-info { display: flex; align-items: center; gap: 12px; }
        .chat-header-icon { font-size: 1.5rem; }
        .chat-header-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .chat-header-sub { font-size: 0.8rem; }
        .chat-header-actions { display: flex; gap: 8px; }
        .chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .chat-loading, .chat-empty {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 12px; color: var(--text-muted); font-size: 0.9rem;
        }
        .chat-empty span { font-size: 2.5rem; }
        .message-wrapper { display: flex; align-items: flex-end; gap: 8px; }
        .message-wrapper.own { flex-direction: row-reverse; }
        .message-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), #a855f7);
          color: white; font-weight: 700; font-size: 0.8rem;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; border: none; cursor: pointer;
        }
        .message-bubble {
          max-width: 65%; padding: 10px 14px; border-radius: 16px;
          position: relative;
        }
        .message-own { background: var(--message-own); border-bottom-right-radius: 4px; }
        .message-other { background: var(--message-other); border-bottom-left-radius: 4px; }
        .message-sender { font-size: 0.75rem; font-weight: 600; color: var(--accent); display: block; margin-bottom: 4px; }
        .message-text { font-size: 0.9rem; line-height: 1.5; word-break: break-word; margin: 0; }
        .message-meta { display: flex; align-items: center; gap: 6px; margin-top: 4px; justify-content: flex-end; }
        .message-time { font-size: 0.7rem; color: var(--text-muted); }
        .message-edited { font-size: 0.65rem; color: var(--text-muted); font-style: italic; }
        .message-readers-btn { background: none; border: none; cursor: pointer; font-size: 0.7rem; color: var(--accent); }
      `}</style>
    </div>
  );
}
