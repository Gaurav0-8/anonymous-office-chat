'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { chatsAPI, messagesAPI, imagesAPI } from '@/lib/api';
import MessageInput from './MessageInput';
import MediaMessage from './MediaMessage';
import ImageModal from './ImageModal';
import AdminControls from './AdminControls';
import UserSidebar from './UserSidebar';

export default function MainChat({ currentUser, chatId, ws, wsReady, onStartPrivateChat }) {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAdminControls, setShowAdminControls] = useState(false);
  const [showUserSidebar, setShowUserSidebar] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messageReaders, setMessageReaders] = useState({}); // { msgId: [names] }
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
      } catch { /* ignore */ }
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

  const fetchReaders = async (msgId) => {
    if (messageReaders[msgId]) return;
    try {
      const res = await messagesAPI.getReaders(msgId);
      setMessageReaders(prev => ({ ...prev, [msgId]: res.data || [] }));
    } catch { /* ignore */ }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    // Maybe show a small toast later
  };

  const handleStar = (url) => {
    const saved = JSON.parse(localStorage.getItem('chat_favorites') || '[]');
    const exists = saved.find(f => f.url === url);
    if (!exists) {
      const updated = [{ id: Date.now().toString(), url, type: 'sticker' }, ...saved].slice(0, 50);
      localStorage.setItem('chat_favorites', JSON.stringify(updated));
      alert('Sticker added to favorites!');
    }
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
        <div className="chat-header-actions">
          {currentUser.role === 'admin' && (
            <button className="btn btn-secondary" onClick={() => setShowAdminControls(true)}>🛡️</button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowUserSidebar(true)}>👥</button>
        </div>
      </div>

      <div className="chat-messages">
        {loading ? (
          <div className="chat-loading"><div className="spinner" /></div>
        ) : (
          messages.map((msg) => (
            <div key={msg.message_id} className={`message-wrapper ${isOwnMessage(msg) ? 'own' : 'other'}`}>
              {!isOwnMessage(msg) && (
                <button 
                  className="message-avatar"
                  onClick={() => onStartPrivateChat(msg.sender_id)}
                  title={`Chat with ${msg.sender_name}`}
                >
                  {msg.sender_name?.[0]?.toUpperCase()}
                </button>
              )}
              <div className={`message-bubble ${isOwnMessage(msg) ? 'message-own' : 'message-other'}`}>
                {!isOwnMessage(msg) && (
                  <span className="message-sender" onClick={() => onStartPrivateChat(msg.sender_id)} style={{cursor: 'pointer'}}>
                    {msg.sender_name}
                  </span>
                )}
                
                <div className="message-content-wrapper">
                  {msg.image_file_id ? (
                    <div className="media-container">
                      <MediaMessage
                        fileId={msg.image_file_id}
                        onOpen={(url) => setSelectedImage(url)}
                      />
                      <button className="media-star-btn" onClick={() => handleStar(imagesAPI.getUrl(msg.image_file_id))} title="Save to Favorites">⭐</button>
                    </div>
                  ) : /^http.*\.(jpg|jpeg|gif|png|webp)(\?.*)?$/i.test(msg.message_text) ? (
                    <div className="message-sticker media-container">
                      <img src={msg.message_text} onClick={() => setSelectedImage(msg.message_text)} className="sticker-content" />
                      <button className="media-star-btn" onClick={() => handleStar(msg.message_text)} title="Save to Favorites">⭐</button>
                    </div>
                  ) : (
                    <p className="message-text">{msg.message_text}</p>
                  )}
                  
                  <div className="message-actions-overlay">
                    <button className="mini-action-btn" onClick={() => handleCopy(msg.message_text || '')} title="Copy">📋</button>
                  </div>
                </div>

                <div className="message-meta">
                  <span className="message-time">
                    {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  
                  {/* Teams Style Seen By */}
                  <div className="seen-by-container" onClick={() => fetchReaders(msg.message_id)}>
                    {isOwnMessage(msg) && (
                      <span className="seen-by-text">
                        {messageReaders[msg.message_id] ? (
                          `Seen by ${messageReaders[msg.message_id].slice(0, 2).join(', ')}${messageReaders[msg.message_id].length > 2 ? ` +${messageReaders[msg.message_id].length - 2}` : ''}`
                        ) : 'Seen by...'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={handleSend} onImageSend={handleImageSend} disabled={!wsReady} chatId={chatId} />

      {selectedImage && <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />}
      {showAdminControls && <AdminControls participants={participants} onClose={() => setShowAdminControls(false)} onRefresh={loadData} />}
      {showUserSidebar && <UserSidebar participants={participants} highlightUserId={selectedUser?.sender_id} onClose={() => { setShowUserSidebar(false); setSelectedUser(null); }} />}

      <style jsx>{`
        .main-chat { display: flex; flex-direction: column; height: 100%; background: var(--bg-primary); }
        .chat-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); }
        .chat-header-info { display: flex; align-items: center; gap: 12px; }
        .chat-header-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .message-wrapper { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 4px; }
        .message-wrapper.own { flex-direction: row-reverse; }
        .message-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; }
        .message-bubble { max-width: 70%; padding: 10px 14px; border-radius: 12px; position: relative; }
        .message-own { background: #312e81; border-bottom-right-radius: 4px; }
        .message-other { background: #1e1e2e; border-bottom-left-radius: 4px; }
        .message-sender { font-size: 0.75rem; font-weight: 700; color: #7c6af7; display: block; margin-bottom: 4px; }
        .message-text { font-size: 0.95rem; margin: 0; white-space: pre-wrap; line-height: 1.4; }
        .message-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
        .message-time { font-size: 0.7rem; color: #55556a; }
        
        .seen-by-text { font-size: 0.65rem; color: #7c6af7; cursor: pointer; transition: opacity 0.2s; }
        .seen-by-text:hover { opacity: 0.8; }
        
        .media-container { position: relative; border-radius: 10px; overflow: hidden; margin-top: 4px; }
        .sticker-content { max-width: 200px; max-height: 200px; display: block; cursor: pointer; }
        
        .media-star-btn { 
          position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); 
          border: none; color: white; width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;
        }
        .media-container:hover .media-star-btn { opacity: 1; }
        
        .message-content-wrapper { position: relative; }
        .message-actions-overlay { 
          position: absolute; right: -40px; top: 0; display: flex; flex-direction: column; 
          gap: 4px; opacity: 0; transition: opacity 0.2s; 
        }
        .message-wrapper.own .message-actions-overlay { right: auto; left: -40px; }
        .message-wrapper:hover .message-actions-overlay { opacity: 1; }
        
        .mini-action-btn { background: #252535; border: 1px solid #2e2e45; color: #8888aa; border-radius: 6px; padding: 4px; cursor: pointer; font-size: 0.8rem; }
        .mini-action-btn:hover { background: #7c6af7; color: white; }
      `}</style>
    </div>
  );
}
