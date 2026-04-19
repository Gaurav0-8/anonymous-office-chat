'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { chatsAPI, messagesAPI, imagesAPI } from '@/lib/api';
import MessageInput from './MessageInput';
import MediaMessage from './MediaMessage';
import ImageModal from './ImageModal';

export default function MainChat({ currentUser, chatId, ws, wsReady, onStartPrivateChat }) {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [messageReaders, setMessageReaders] = useState({});
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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

  // WebSocket Handlers
  useEffect(() => {
    if (!ws) return;
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message' && data.message?.chat_id === chatId) {
          setMessages(prev => [...prev.filter(m => m.message_id !== data.message.message_id), data.message]);
        }
        if (data.type === 'reaction_update') {
          setMessages(prev => prev.map(m => {
            if (m.message_id !== data.data.message_id) return m;
            const existing = m.reactions || [];
            let updated = [...existing];
            const reactionIdx = updated.findIndex(r => r.emoji === data.data.emoji);
            if (data.data.action === 'add') {
              if (reactionIdx > -1) {
                updated[reactionIdx] = { ...updated[reactionIdx], count: updated[reactionIdx].count + 1 };
                if (data.data.user_id === currentUser.user_id) updated[reactionIdx].me = true;
              } else {
                updated.push({ emoji: data.data.emoji, count: 1, me: data.data.user_id === currentUser.user_id });
              }
            } else {
              if (reactionIdx > -1) {
                updated[reactionIdx].count = Math.max(0, updated[reactionIdx].count - 1);
                if (data.data.user_id === currentUser.user_id) updated[reactionIdx].me = false;
                if (updated[reactionIdx].count === 0) updated = updated.filter(r => r.emoji !== data.data.emoji);
              }
            }
            return { ...m, reactions: updated };
          }));
        }
      } catch { /* ignore */ }
    };
    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, chatId, currentUser.user_id]);

  const handleSend = async (text) => {
    await messagesAPI.send(chatId, text, replyTo?.message_id);
    setReplyTo(null);
  };

  const handleImageSend = async (fileId, text) => {
    await imagesAPI.sendImageMessage(chatId, fileId, text);
  };

  const handleReact = async (msgId, emoji) => {
    await messagesAPI.react(msgId, emoji);
  };

  const fetchReaders = async (msgId) => {
    if (messageReaders[msgId]) return;
    try {
      const res = await messagesAPI.getReaders(msgId);
      setMessageReaders(prev => ({ ...prev, [msgId]: res.data }));
    } catch {}
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  const isOwnMessage = (msg) => msg.sender_id === currentUser.user_id;

  return (
    <div className="main-chat">
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="chat-header-icon">🌐</span>
          <div>
            <h2 className="chat-header-title">Main Group Chat</h2>
            <span className="chat-header-sub text-muted">{participants.length} members</span>
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {loading ? (
          <div className="chat-loading"><div className="spinner" /></div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.message_id} 
              className={`message-wrapper ${isOwnMessage(msg) ? 'own' : 'other'}`}
              onMouseEnter={() => { setHoveredMsgId(msg.message_id); fetchReaders(msg.message_id); }}
              onMouseLeave={() => setHoveredMsgId(null)}
            >
              {!isOwnMessage(msg) && (
                <button className="message-avatar" onClick={() => onStartPrivateChat(msg.sender_id)}>
                  {msg.sender_name?.[0]?.toUpperCase()}
                </button>
              )}
              
              <div className={`message-bubble-container`}>
                <div className={`message-bubble ${isOwnMessage(msg) ? 'message-own' : 'message-other'}`}>
                  {!isOwnMessage(msg) && (
                    <span className="message-sender" onClick={() => onStartPrivateChat(msg.sender_id)}>
                      {msg.sender_name}
                    </span>
                  )}

                  {msg.parent_id && (
                    <div className="reply-quote-bubble">
                      <span className="reply-quote-sender">{msg.parent_sender}</span>
                      <p className="reply-quote-text">{msg.parent_text}</p>
                    </div>
                  )}
                  
                  {msg.image_file_id ? (
                    <MediaMessage fileId={msg.image_file_id} onOpen={(url) => setSelectedImage(url)} />
                  ) : /^http.*\.(jpg|jpeg|gif|png|webp)(\?.*)?$/i.test(msg.message_text) ? (
                    <img src={msg.message_text} onClick={() => setSelectedImage(msg.message_text)} className="sticker-content" />
                  ) : (
                    <p className="message-text">{msg.message_text}</p>
                  )}

                  {msg.reactions?.length > 0 && (
                    <div className="message-reactions-list">
                      {msg.reactions.map(r => (
                        <button key={r.emoji} className={`reaction-pill ${r.me ? 'me' : ''}`} onClick={() => handleReact(msg.message_id, r.emoji)}>
                          {r.emoji} {r.count}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="message-meta">
                    <span className="message-time">
                      {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* HOVER MENU */}
                  {hoveredMsgId === msg.message_id && (
                    <div className="hover-menu">
                       <button title="Reply" onClick={() => setReplyTo(msg)}>↩️</button>
                       <button title="Copy" onClick={() => handleCopy(msg.message_text)}>📋</button>
                       <button title="React" onClick={(e) => { e.stopPropagation(); /* show reaction picker or toggle thumb */ handleReact(msg.message_id, '👍'); }}>👍</button>
                       {messageReaders[msg.message_id] && (
                         <div className="seen-indicator" title={messageReaders[msg.message_id].join(', ')}>
                           👁️ {messageReaders[msg.message_id].length}
                         </div>
                       )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {replyTo && (
        <div className="reply-bar">
          <div className="reply-bar-info">
            <span className="reply-bar-sender">Replying to {replyTo.sender_name}</span>
            <p className="reply-bar-text">{replyTo.message_text}</p>
          </div>
          <button className="reply-bar-close" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      <MessageInput onSend={handleSend} onImageSend={handleImageSend} disabled={!wsReady} chatId={chatId} />

      {selectedImage && <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />}

      <style jsx>{`
        .main-chat { display: flex; flex-direction: column; height: 100%; background: var(--bg-primary); position: relative; }
        .chat-header { padding: 14px 20px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); }
        .chat-header-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .message-wrapper { display: flex; align-items: flex-end; gap: 8px; position: relative; }
        .message-wrapper.own { flex-direction: row-reverse; }
        .message-bubble-container { max-width: 70%; position: relative; }
        .message-bubble { 
          padding: 10px 14px; border-radius: 12px; position: relative; 
          transition: background 0.2s;
        }
        .message-own { background: #3c3b54; color: white; border-bottom-right-radius: 4px; }
        .message-other { background: #252433; color: white; border-bottom-left-radius: 4px; }
        
        /* HOVER MENU STYLES */
        .hover-menu { 
          position: absolute; top: -30px; right: 0; background: #252433; 
          border: 1px solid #3c3b54; border-radius: 8px; display: flex; 
          align-items: center; gap: 8px; padding: 4px 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 100; animation: fadeIn 0.15s ease;
        }
        .message-wrapper.own .hover-menu { right: auto; left: 0; }
        .hover-menu button { background: none; border: none; font-size: 0.9rem; cursor: pointer; padding: 2px; }
        .hover-menu button:hover { transform: scale(1.2); }
        .seen-indicator { font-size: 0.75rem; color: #8888aa; border-left: 1px solid #3c3b54; padding-left: 8px; cursor: help; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        .reply-quote-bubble { background: rgba(0,0,0,0.2); border-left: 3px solid var(--accent); padding: 8px; border-radius: 4px; margin-bottom: 8px; }
        .reply-quote-sender { font-size: 0.7rem; font-weight: 700; color: var(--accent); }
        .reply-quote-text { font-size: 0.8rem; margin: 2px 0 0; opacity: 0.8; }
        
        .message-sender { font-size: 0.75rem; font-weight: 700; color: var(--accent); cursor: pointer; margin-bottom: 4px; display: block; }
        .message-text { font-size: 0.95rem; margin: 0; line-height: 1.4; word-break: break-word; }
        .message-reactions-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .reaction-pill { background: #1a1a24; border: 1px solid #2e2e45; border-radius: 12px; padding: 2px 8px; font-size: 0.75rem; color: #8888aa; cursor: pointer; }
        .reaction-pill.me { border-color: var(--accent); background: rgba(124, 106, 247, 0.1); }
        .message-meta { margin-top: 4px; text-align: right; }
        .message-time { font-size: 0.65rem; color: #55556a; }
        
        .reply-bar { padding: 10px 20px; background: #252433; border-top: 1px solid #3c3b54; display: flex; align-items: center; justify-content: space-between; border-left: 4px solid var(--accent); }
        .reply-bar-sender { font-size: 0.75rem; font-weight: 700; color: var(--accent); }
        .reply-bar-text { font-size: 0.85rem; margin: 2px 0 0; color: #8888aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .reply-bar-close { background: none; border: none; color: white; cursor: pointer; }
        .sticker-content { max-width: 250px; border-radius: 8px; cursor: pointer; }
      `}</style>
    </div>
  );
}
