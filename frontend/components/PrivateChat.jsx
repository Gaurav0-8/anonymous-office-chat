'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { chatsAPI, messagesAPI, imagesAPI } from '@/lib/api';
import MessageInput from './MessageInput';
import MediaMessage from './MediaMessage';
import ImageModal from './ImageModal';
import MessageReadersModal from './MessageReadersModal';

export default function PrivateChat({ currentUser, chatId, ws, wsReady, onBack }) {
  const [messages, setMessages] = useState([]);
  const [chatDetails, setChatDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [msgsRes, detailsRes] = await Promise.all([
        chatsAPI.getChatMessages(chatId),
        chatsAPI.getChatDetails(chatId),
      ]);
      setMessages(msgsRes.data || []);
      setChatDetails(detailsRes.data);
    } catch (err) {
      console.error('Failed to load private chat:', err);
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

  // WebSocket handler
  useEffect(() => {
    if (!ws) return;
    const handler = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'new_message' && data.message?.chat_id === chatId) {
          setMessages((prev) => {
            if (prev.find((m) => m.message_id === data.message.message_id)) return prev;
            return [...prev, { ...data.message, is_read: false, is_edited: false }];
          });
        }
      } catch {}
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws, chatId]);

  const otherParticipant = chatDetails?.participants.find(
    (p) => p.user_id !== currentUser.user_id
  );

  const isOwnMessage = (msg) => msg.sender_id === currentUser.user_id;

  return (
    <div className="private-chat">
      {/* Header */}
      <div className="chat-header">
        <button className="back-btn" onClick={onBack} title="Back">
          ←
        </button>
        <div className="chat-header-avatar">
          {otherParticipant?.display_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <h2 className="chat-header-title">{otherParticipant?.display_name || 'Private Chat'}</h2>
          <span className="chat-header-sub text-muted">Private conversation</span>
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
            <span>🔒</span>
            <p>This is the beginning of your private conversation</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.message_id}
              className={`message-wrapper ${isOwnMessage(msg) ? 'own' : 'other'} fade-in`}
              onMouseEnter={() => !msg.is_read && !isOwnMessage(msg) && messagesAPI.markRead(msg.message_id)}
            >
              <div className={`message-bubble ${isOwnMessage(msg) ? 'message-own' : 'message-other'}`}>
                {msg.image_file_id && (
                  <MediaMessage
                    fileId={msg.image_file_id}
                    width={msg.image_width}
                    height={msg.image_height}
                    onOpen={setSelectedImage}
                  />
                )}
                {msg.message_text && <p className="message-text">{msg.message_text}</p>}
                <div className="message-meta">
                  <span className="message-time">
                    {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.is_edited && <span className="message-edited">edited</span>}
                  {isOwnMessage(msg) && (
                    <button className="message-readers-btn" onClick={() => setSelectedMessage(msg)}>
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

      <MessageInput
        onSend={(text) => messagesAPI.send(chatId, text)}
        onImageSend={(fileId, text) => imagesAPI.sendImageMessage(chatId, fileId, text)}
        disabled={!wsReady}
        chatId={chatId}
      />

      {selectedImage && <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />}
      {selectedMessage && (
        <MessageReadersModal messageId={selectedMessage.message_id} onClose={() => setSelectedMessage(null)} />
      )}

      <style jsx>{`
        .private-chat { display: flex; flex-direction: column; height: 100%; background: var(--bg-primary); }
        .chat-header {
          display: flex; align-items: center; gap: 12px;
          padding: max(14px, env(safe-area-inset-top)) 20px 14px 20px; 
          background: var(--bg-secondary); border-bottom: 1px solid var(--border);
        }
        .back-btn {
          background: none; border: none; cursor: pointer; font-size: 1.2rem;
          color: var(--text-secondary); padding: 4px 8px; border-radius: 6px;
          transition: color 0.2s;
        }
        .back-btn:hover { color: var(--accent); }
        .chat-header-avatar {
          width: 38px; height: 38px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), #a855f7);
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 700; font-size: 0.9rem;
        }
        .chat-header-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .chat-header-sub { font-size: 0.8rem; }
        .chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .chat-loading, .chat-empty {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 12px; color: var(--text-muted); font-size: 0.9rem;
        }
        .chat-empty span { font-size: 2.5rem; }
        .message-wrapper { display: flex; align-items: flex-end; gap: 8px; }
        .message-wrapper.own { flex-direction: row-reverse; }
        .message-bubble {
          max-width: min(65%, 520px); padding: 10px 14px; border-radius: 16px;
        }
        @media (max-width: 768px) { 
          .message-bubble { max-width: 92%; padding: 9px 12px; font-size: 0.9rem; }
          .chat-messages { padding: 12px 10px; gap: 10px; }
          .chat-header { padding: max(10px, env(safe-area-inset-top)) 14px 10px 10px; gap: 8px; }
        }
        .message-own { background: var(--message-own); border-bottom-right-radius: 4px; }
        .message-other { background: var(--message-other); border-bottom-left-radius: 4px; }
        .message-text { font-size: 0.9rem; line-height: 1.5; word-break: break-word; margin: 0; }
        .message-meta { display: flex; align-items: center; gap: 6px; margin-top: 4px; justify-content: flex-end; }
        .message-time { font-size: 0.7rem; color: var(--text-muted); }
        .message-edited { font-size: 0.65rem; color: var(--text-muted); font-style: italic; }
        .message-readers-btn { background: none; border: none; cursor: pointer; font-size: 0.7rem; color: var(--accent); }
      `}</style>
    </div>
  );
}
