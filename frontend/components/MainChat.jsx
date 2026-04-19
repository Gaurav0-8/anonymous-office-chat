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
  const [replyTo, setReplyTo] = useState(null); // The message object being replied to
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [messageReaders, setMessageReaders] = useState({}); // { msgId: ["Name1", "Name2"] }
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
    try {
      // Corrected: Passing message_id for reply support
      await messagesAPI.send(chatId, text, replyTo ? parseInt(replyTo.message_id) : null);
      setReplyTo(null);
    } catch (err) {
      console.error('Send failed:', err);
    }
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
    <div className="teams-chat">
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="group-avatar">🌐</span>
          <div>
            <h2 className="title">Main Group Chat</h2>
            <span className="subtitle">{participants.length} participants</span>
          </div>
        </div>
      </div>

      <div className="chat-body scrollable">
        {loading ? (
          <div className="centered"><div className="spinner" /></div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.message_id} 
              className={`msg-row ${isOwnMessage(msg) ? 'own' : 'other'}`}
              onMouseEnter={() => { setHoveredMsgId(msg.message_id); fetchReaders(msg.message_id); }}
              onMouseLeave={() => setHoveredMsgId(null)}
            >
              {!isOwnMessage(msg) && (
                <button className="avatar" onClick={() => onStartPrivateChat(msg.sender_id)}>
                  {msg.sender_name?.[0]?.toUpperCase()}
                </button>
              )}
              
              <div className="bubble-wrapper">
                <div className={`bubble ${isOwnMessage(msg) ? 'own' : 'other'}`}>
                  {!isOwnMessage(msg) && (
                    <span 1 className="sender" onClick={() => onStartPrivateChat(msg.sender_id)}>
                      {msg.sender_name}
                    </span>
                  )}

                  {/* Reply Quote Block */}
                  {msg.parent_id && (
                    <div className="reply-quote-bar">
                      <span className="quote-sender">{msg.parent_sender}</span>
                      <p className="quote-text">{msg.parent_text}</p>
                    </div>
                  )}
                  
                  {msg.image_file_id ? (
                    <MediaMessage fileId={msg.image_file_id} onOpen={(url) => setSelectedImage(url)} />
                  ) : /^http.*\.(jpg|jpeg|gif|png|webp)(\?.*)?$/i.test(msg.message_text) ? (
                    <img src={msg.message_text} onClick={() => setSelectedImage(msg.message_text)} className="sticker" />
                  ) : (
                    <p className="text">{msg.message_text}</p>
                  )}

                  <div className="meta">
                    <span className="time">
                      {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Reaction Pills */}
                  {msg.reactions?.length > 0 && (
                    <div className="reactions-pill-container">
                      {msg.reactions.map(r => (
                        <button key={r.emoji} className={`pill ${r.me ? 'me' : ''}`} onClick={() => handleReact(msg.message_id, r.emoji)}>
                          {r.emoji} {r.count}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* TEAMS STYLE HOVER ACTIONS */}
                  <div className={`teams-hover-actions ${hoveredMsgId === msg.message_id ? 'visible' : ''}`}>
                    <div className="emoji-row">
                      {['👍', '❤️', '😂', '😮', '😢'].map(e => (
                        <button key={e} onClick={() => handleReact(msg.message_id, e)}>{e}</button>
                      ))}
                    </div>
                    <div className="icon-row">
                       <button title="Reply with Quote" onClick={() => setReplyTo(msg)}>↩️</button>
                       <button title="Copy Text" onClick={() => handleCopy(msg.message_text)}>📋</button>
                       <div className="divider" />
                       <div className="seen-by" title={messageReaders[msg.message_id]?.join(', ') || 'No readers yet'}>
                         👁️ {messageReaders[msg.message_id]?.length || 0}
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {replyTo && (
        <div className="reply-preview">
          <div className="preview-content">
            <span className="preview-sender">Replying to {replyTo.sender_name}</span>
            <p className="preview-text">{replyTo.message_text}</p>
          </div>
          <button className="preview-close" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      <MessageInput onSend={handleSend} onImageSend={handleImageSend} disabled={!wsReady} chatId={chatId} />

      {selectedImage && <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />}

      <style jsx>{`
        .teams-chat { display: flex; flex-direction: column; height: 100%; background: #111019; position: relative; }
        .chat-header { padding: 12px 20px; background: #1a1926; border-bottom: 1px solid #2a293d; }
        .chat-header-info { display: flex; align-items: center; gap: 12px; }
        .group-avatar { font-size: 1.5rem; background: #2a293d; padding: 6px; border-radius: 8px; }
        .title { font-size: 1rem; margin: 0; color: white; }
        .subtitle { font-size: 0.75rem; color: #8888aa; }
        
        .chat-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .msg-row { display: flex; align-items: flex-end; gap: 10px; position: relative; }
        .msg-row.own { flex-direction: row-reverse; }
        
        .avatar { width: 32px; height: 32px; border-radius: 50%; background: #7c6af7; color: white; border: none; font-size: 0.8rem; font-weight: 700; cursor: pointer; flex-shrink: 0; }
        .bubble-wrapper { max-width: 65%; position: relative; }
        
        .bubble { 
          padding: 10px 14px; border-radius: 8px; position: relative; 
          box-shadow: 0 1px 2px rgba(0,0,0,0.2); 
        }
        .bubble.own { background: #323145; color: white; }
        .bubble.other { background: #232231; color: white; }
        
        .sender { font-size: 0.75rem; font-weight: 700; color: #7c6af7; cursor: pointer; display: block; margin-bottom: 4px; }
        .text { font-size: 0.95rem; margin: 0; line-height: 1.4; word-wrap: break-word; }
        
        .reply-quote-bar { 
          background: rgba(0,0,0,0.2); border-left: 3px solid #7c6af7; 
          padding: 8px; border-radius: 4px; margin-bottom: 8px; 
        }
        .quote-sender { font-size: 0.7rem; font-weight: 700; color: #7c6af7; display: block; }
        .quote-text { font-size: 0.8rem; margin: 2px 0 0; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* TEAMS HOVER PANEL */
        .teams-hover-actions { 
          position: absolute; top: -35px; right: 0; 
          background: #1a1926; border: 1px solid #2a293d; 
          border-radius: 8px; padding: 4px; display: flex; flex-direction: column;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5); opacity: 0; pointer-events: none;
          transition: all 0.2s; z-index: 1000;
        }
        .msg-row.own .teams-hover-actions { right: auto; left: 0; }
        .teams-hover-actions.visible { opacity: 1; pointer-events: auto; top: -45px; }
        
        .emoji-row { display: flex; gap: 6px; padding: 4px; border-bottom: 1px solid #2a293d; }
        .emoji-row button { background: none; border: none; font-size: 1.2rem; cursor: pointer; transition: transform 0.1s; }
        .emoji-row button:hover { transform: scale(1.3); }
        
        .icon-row { display: flex; align-items: center; gap: 10px; padding: 6px; }
        .icon-row button { background: none; border: none; font-size: 1rem; cursor: pointer; opacity: 0.7; }
        .icon-row button:hover { opacity: 1; }
        .divider { width: 1px; height: 14px; background: #2a293d; }
        .seen-by { font-size: 0.75rem; color: #8888aa; display: flex; align-items: center; gap: 4px; cursor: help; }

        .reactions-pill-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .pill { background: #111019; border: 1px solid #2a293d; border-radius: 10px; padding: 2px 6px; font-size: 0.7rem; color: #8888aa; cursor: pointer; }
        .pill.me { border-color: #7c6af7; background: rgba(124, 106, 247, 0.1); }
        .meta { margin-top: 4px; text-align: right; }
        .time { font-size: 0.65rem; color: #55556a; }

        .reply-preview { 
          background: #1a1926; border-left: 4px solid #7c6af7; 
          padding: 8px 16px; display: flex; align-items: center; justify-content: space-between;
          border-top: 1px solid #2a293d;
        }
        .preview-sender { font-size: 0.75rem; font-weight: 700; color: #7c6af7; }
        .preview-text { font-size: 0.85rem; color: #8888aa; margin: 2px 0 0; }
        .preview-close { background: none; border: none; color: white; cursor: pointer; font-size: 1rem; }
        
        .sticker { max-width: 250px; border-radius: 8px; cursor: pointer; }
        .centered { padding: 40px; text-align: center; }
        .scrollable::-webkit-scrollbar { width: 6px; }
        .scrollable::-webkit-scrollbar-thumb { background: #2a293d; border-radius: 3px; }
      `}</style>
    </div>
  );
}
