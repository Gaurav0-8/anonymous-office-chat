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
  const [contextMenu, setContextMenu] = useState(null); // { x, y, msg }
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
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
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
    const res = await messagesAPI.getReaders(msgId);
    setMessageReaders(prev => ({ ...prev, [msgId]: res.data }));
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

      <div className="chat-messages" onContextMenu={e => e.preventDefault()}>
        {loading ? (
          <div className="chat-loading"><div className="spinner" /></div>
        ) : (
          messages.map((msg) => (
            <div key={msg.message_id} className={`message-wrapper ${isOwnMessage(msg) ? 'own' : 'other'}`}>
              {!isOwnMessage(msg) && (
                <button className="message-avatar" onClick={() => onStartPrivateChat(msg.sender_id)}>
                  {msg.sender_name?.[0]?.toUpperCase()}
                </button>
              )}
              <div 
                className={`message-bubble ${isOwnMessage(msg) ? 'message-own' : 'message-other'}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.pageX, y: e.pageY, msg });
                }}
              >
                {!isOwnMessage(msg) && (
                  <span className="message-sender" onClick={() => onStartPrivateChat(msg.sender_id)}>
                    {msg.sender_name}
                  </span>
                )}

                {/* Reply Quote Preview */}
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

                <button className="msg-more-btn" onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu({ x: e.pageX, y: e.pageY, msg });
                }}>···</button>

                {/* Reactions List */}
                {msg.reactions?.length > 0 && (
                  <div className="message-reactions-list">
                    {msg.reactions.map(r => (
                      <button 
                        key={r.emoji} 
                        className={`reaction-pill ${r.me ? 'me' : ''}`}
                        onClick={() => handleReact(msg.message_id, r.emoji)}
                      >
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
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Bar */}
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

      {/* Teams Style Context Menu */}
      {contextMenu && (
        <div className="teams-menu" style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 220) }} onClick={e => e.stopPropagation()}>
          <div className="teams-reactions-bar">
             {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
               <button key={emoji} className="teams-react-btn" onClick={() => { handleReact(contextMenu.msg.message_id, emoji); setContextMenu(null); }}>{emoji}</button>
             ))}
          </div>
          <div className="teams-menu-list">
            <button className="teams-menu-item" onClick={() => { setReplyTo(contextMenu.msg); setContextMenu(null); }}>
              <span className="menu-icon">↩️</span> Reply
            </button>
            <button className="teams-menu-item" onClick={() => { handleCopy(contextMenu.msg.message_text); setContextMenu(null); }}>
              <span className="menu-icon">📋</span> Copy text
            </button>
            <div className="teams-menu-divider" />
            <button className="teams-menu-item" onClick={() => { fetchReaders(contextMenu.msg.message_id); }}>
              <span className="menu-icon">👁️</span> 
              Read by {messageReaders[contextMenu.msg.message_id]?.length || 0} participants
            </button>
          </div>
        </div>
      )}

      {selectedImage && <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />}

      <style jsx>{`
        .main-chat { display: flex; flex-direction: column; height: 100%; background: var(--bg-primary); position: relative; }
        .chat-header { padding: 14px 20px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); }
        .chat-header-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        
        .message-wrapper { display: flex; align-items: flex-end; gap: 8px; }
        .message-wrapper.own { flex-direction: row-reverse; }
        .message-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: white; border: none; font-weight: 700; cursor: pointer; }
        
        .message-bubble { 
          max-width: 70%; padding: 12px 16px; border-radius: 12px; position: relative; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
        }
        .message-own { background: #3c3b54; color: white; border-bottom-right-radius: 4px; }
        .message-other { background: #252433; color: white; border-bottom-left-radius: 4px; }
        
        .reply-quote-bubble { 
          background: rgba(0,0,0,0.2); border-left: 3px solid var(--accent); 
          padding: 8px; border-radius: 4px; margin-bottom: 8px; cursor: default;
        }
        .reply-quote-sender { font-size: 0.7rem; font-weight: 700; color: var(--accent); }
        .reply-quote-text { font-size: 0.8rem; margin: 2px 0 0; opacity: 0.8; word-break: break-all; }
        
        .message-sender { font-size: 0.75rem; font-weight: 700; color: var(--accent); cursor: pointer; margin-bottom: 4px; display: block; }
        .message-text { font-size: 0.95rem; margin: 0; line-height: 1.4; word-break: break-word; }
        .msg-more-btn { position: absolute; right: 4px; top: 4px; background: none; border: none; color: #8888aa; cursor: pointer; opacity: 0; transition: opacity 0.2s; }
        .message-bubble:hover .msg-more-btn { opacity: 1; }
        
        .message-reactions-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .reaction-pill { 
          background: #1a1a24; border: 1px solid #2e2e45; border-radius: 12px; 
          padding: 2px 8px; font-size: 0.75rem; color: #8888aa; cursor: pointer; transition: all 0.2s;
        }
        .reaction-pill.me { border-color: var(--accent); background: rgba(124, 106, 247, 0.1); }
        .reaction-pill:hover { transform: scale(1.1); }
        
        .message-meta { margin-top: 4px; text-align: right; }
        .message-time { font-size: 0.65rem; color: #55556a; }
        
        .reply-bar { 
          padding: 10px 20px; background: #252433; border-top: 1px solid #3c3b54; 
          display: flex; align-items: center; justify-content: space-between;
          border-left: 4px solid var(--accent); 
        }
        .reply-bar-sender { font-size: 0.75rem; font-weight: 700; color: var(--accent); }
        .reply-bar-text { font-size: 0.85rem; margin: 2px 0 0; color: #8888aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .reply-bar-close { background: none; border: none; color: white; cursor: pointer; }

        .teams-menu { 
          position: fixed; background: #252433; border: 1px solid #3c3b54; 
          min-width: 200px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); 
          z-index: 10000; overflow: hidden;
        }
        .teams-reactions-bar { display: flex; padding: 10px; gap: 8px; background: #1a1a24; border-bottom: 1px solid #3c3b54; }
        .teams-react-btn { font-size: 1.2rem; background: none; border: none; cursor: pointer; transition: transform 0.2s; }
        .teams-react-btn:hover { transform: scale(1.3); }
        .teams-menu-list { display: flex; flex-direction: column; padding: 6px 0; }
        .teams-menu-item { 
          border: none; background: none; padding: 8px 16px; text-align: left; 
          color: white; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 10px;
        }
        .teams-menu-item:hover { background: #3c3b54; }
        .teams-menu-divider { height: 1px; background: #3c3b54; margin: 6px 0; }
        .menu-icon { font-size: 1rem; }

        .sticker-content { max-width: 250px; border-radius: 8px; cursor: pointer; }
      `}</style>
    </div>
  );
}
