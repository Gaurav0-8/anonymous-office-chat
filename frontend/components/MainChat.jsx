'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { chatsAPI, messagesAPI, imagesAPI } from '@/lib/api';
import MessageInput from './MessageInput';
import MediaMessage from './MediaMessage';
import ImageModal from './ImageModal';
import RichPicker from './RichPicker';

export default function MainChat({ currentUser, chatId, ws, wsReady, onStartPrivateChat }) {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const [messageReaders, setMessageReaders] = useState({});
  const [focusTrigger, setFocusTrigger] = useState(0);
  const messagesEndRef = useRef(null);
  const reactionPickerRef = useRef(null);

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

  // Click outside to close reaction picker
  useEffect(() => {
    const handleClickOutside = (e) => {
        if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target)) {
            setReactionPickerMsgId(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      } catch (e) { console.error('WS parse err', e); }
    };
    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, chatId, currentUser.user_id]);

  const handleSend = async (text) => {
    try {
      await messagesAPI.send(chatId, text, replyTo ? parseInt(replyTo.message_id) : null);
      setReplyTo(null);
    } catch (err) { console.error('Send failed:', err); }
  };

  const handleImageSend = async (fileId, text) => {
     try {
       await imagesAPI.sendImageMessage(chatId, fileId, text);
       setReplyTo(null);
     } catch (err) { console.error('Image send failed:', err); }
  };

  const handleReact = async (msgId, emoji) => {
    try {
        await messagesAPI.react(msgId, emoji);
        setReactionPickerMsgId(null);
    } catch (err) { console.error('React failed:', err); }
  };

  const fetchReaders = async (msgId) => {
    if (messageReaders[msgId]) return;
    try {
      const res = await messagesAPI.getReaders(msgId);
      setMessageReaders(prev => ({ ...prev, [msgId]: res.data }));
    } catch (e) { /* ignore */ }
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

      <div className="chat-body">
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
              <div className="bubble-wrapper">
                <div className={`bubble ${isOwnMessage(msg) ? 'own' : 'other'}`}>
                  {!isOwnMessage(msg) && (
                    <span className="sender" onClick={() => onStartPrivateChat(msg.sender_id)}>
                      {msg.sender_name}
                    </span>
                  )}

                  {msg.parent_id && (
                    <div className="reply-quote-bar">
                      <span className="quote-sender">{msg.parent_sender}</span>
                      <p className="quote-text">{msg.parent_text}</p>
                    </div>
                  )}
                  
                  {msg.image_file_id ? (
                     <div className="media-attachment-container">
                        <MediaMessage fileId={msg.image_file_id} onOpen={(url) => setSelectedImage(url)} />
                        {msg.message_text && <p className="text with-image">{msg.message_text}</p>}
                     </div>
                  ) : /^http.*\.(jpg|jpeg|gif|png|webp)(\?.*)?$/i.test(msg.message_text) ? (
                    <img src={msg.message_text} onClick={() => setSelectedImage(msg.message_text)} className="sticker" alt="Chat inline media" />
                  ) : (
                    <p className="text">{msg.message_text}</p>
                  )}

                  <div className="meta">
                    <span className="time">
                      {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {msg.reactions?.length > 0 && (
                    <div className="reactions-pill-container">
                      {msg.reactions.map(r => (
                        <button key={r.emoji} className={`pill ${r.me ? 'me' : ''}`} onClick={() => handleReact(msg.message_id, r.emoji)}>
                          {r.emoji} {r.count}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`teams-hover-actions ${hoveredMsgId === msg.message_id || reactionPickerMsgId === msg.message_id ? 'visible' : ''}`}>
                    <div className="emoji-row">
                      {['👍', '❤️', '😂', '😮', '😢'].map(e => (
                        <button key={e} onClick={() => handleReact(msg.message_id, e)}>{e}</button>
                      ))}
                      <div className="reaction-plus-wrapper" ref={reactionPickerMsgId === msg.message_id ? reactionPickerRef : null}>
                        <button className="plus-btn" onClick={() => setReactionPickerMsgId(msg.message_id)}>＋</button>
                        {reactionPickerMsgId === msg.message_id && (
                            <div className="reaction-picker-popover">
                                <RichPicker 
                                    onEmojiSelect={(native) => handleReact(msg.message_id, native)} 
                                    onGifSelect={(url) => handleReact(msg.message_id, url)}
                                    onClose={() => setReactionPickerMsgId(null)}
                                />
                            </div>
                        )}
                      </div>
                    </div>
                    <div className="icon-row">
                       <button title="Reply" onClick={() => { setReplyTo(msg); setFocusTrigger(f => f + 1); }}>↩️</button>
                       <button title="Copy" onClick={() => handleCopy(msg.message_text)}>📋</button>
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

      <MessageInput onSend={handleSend} onImageSend={handleImageSend} disabled={!wsReady} chatId={chatId} focusTrigger={focusTrigger} />

      {selectedImage && <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />}

      <style jsx>{`
        .teams-chat { display: flex; flex-direction: column; height: 100%; background: #111019; position: relative; overflow: hidden; width: 100%; }
        .chat-header { padding: 12px 20px; background: #1a1926; border-bottom: 1px solid #2a293d; flex-shrink: 0; }
        .chat-header-info { display: flex; align-items: center; gap: 12px; }
        .group-avatar { font-size: 1.5rem; background: #2a293d; padding: 6px; border-radius: 8px; }
        .title { font-size: 1rem; margin: 0; color: white; }
        .subtitle { font-size: 0.75rem; color: #8888aa; }
        .chat-body { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px; display: flex; flex-direction: column; gap: 16px; width: 100%; }
        .msg-row { display: flex; align-items: flex-end; gap: 10px; position: relative; width: 100%; }
        .msg-row.own { flex-direction: row-reverse; }
        .bubble-wrapper { max-width: 75%; position: relative; }
        .bubble { padding: 10px 14px; border-radius: 8px; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        .bubble.own { background: #323145; color: white; }
        .bubble.other { background: #232231; color: white; }
        .sender { font-size: 0.75rem; font-weight: 700; color: #7c6af7; cursor: pointer; display: block; margin-bottom: 4px; }
        .text { font-size: 0.95rem; margin: 0; line-height: 1.4; word-wrap: break-word; }
        .text.with-image { margin-top: 8px; }
        .reply-quote-bar { background: rgba(0,0,0,0.2); border-left: 3px solid #7c6af7; padding: 8px; border-radius: 4px; margin-bottom: 8px; }
        .quote-sender { font-size: 0.7rem; font-weight: 700; color: #7c6af7; display: block; }
        .quote-text { font-size: 0.8rem; margin: 2px 0 0; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        
        .teams-hover-actions { position: absolute; top: -55px; right: 0; background: #1a1926; border: 1px solid #2a293d; border-radius: 12px; padding: 6px; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.5); opacity: 0; pointer-events: none; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); z-index: 1000; }
        .msg-row.own .teams-hover-actions { right: auto; left: 0; }
        .teams-hover-actions.visible { opacity: 1; pointer-events: auto; transform: translateY(-5px); }
        
        .emoji-row { display: flex; gap: 8px; padding: 4px; border-bottom: 1px solid #2a293d; align-items: center; }
        .emoji-row button { background: none; border: none; font-size: 1.3rem; cursor: pointer; transition: transform 0.1s; padding: 2px; }
        .emoji-row button:hover { transform: scale(1.2); }
        .plus-btn { color: #8888aa; font-weight: bold; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05) !important; font-size: 0.8rem !important; margin-left: 4px; }
        .plus-btn:hover { background: rgba(124, 106, 247, 0.2) !important; color: #7c6af7 !important; }
        
        .reaction-plus-wrapper { position: relative; }
        .reaction-picker-popover { position: absolute; bottom: 35px; right: 0; z-index: 2005; animation: popUp 0.15s ease-out; }
        @keyframes popUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }

        .icon-row { display: flex; align-items: center; gap: 12px; padding: 6px; }
        .icon-row button { background: none; border: none; font-size: 1rem; cursor: pointer; opacity: 0.7; transition: opacity 0.2s; }
        .icon-row button:hover { opacity: 1; }
        .divider { width: 1px; height: 16px; background: #2a293d; }
        .seen-by { font-size: 0.75rem; color: #8888aa; display: flex; align-items: center; gap: 4px; cursor: help; }
        .reactions-pill-container { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .pill { background: #111019; border: 1px solid #2a293d; border-radius: 12px; padding: 3px 8px; font-size: 0.75rem; color: #8888aa; cursor: pointer; transition: all 0.2s; }
        .pill.me { border-color: #7c6af7; background: rgba(124, 106, 247, 0.1); color: #7c6af7; font-weight: 600; }
        .pill:hover { background: #1a1926; transform: translateY(-1px); }
        .meta { margin-top: 4px; text-align: right; }
        .time { font-size: 0.65rem; color: #55556a; }
        .reply-preview { background: #1a1926; border-left: 4px solid #7c6af7; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #2a293d; }
        .preview-content { overflow: hidden; }
        .preview-sender { font-size: 0.75rem; font-weight: 700; color: #7c6af7; }
        .preview-text { font-size: 0.85rem; color: #8888aa; margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .preview-close { background: none; border: none; color: white; cursor: pointer; padding: 4px; }
        .sticker { max-width: 250px; border-radius: 8px; cursor: pointer; }
        .media-attachment-container { display: flex; flex-direction: column; }
      `}</style>
    </div>
  );
}
