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
  const [contextMsgId, setContextMsgId] = useState(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const [menuPosition, setMenuPosition] = useState('top'); 
  const [forwardMsg, setForwardMsg] = useState(null);
  const [userList, setUserList] = useState([]);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const messagesEndRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const longPressTimer = useRef(null);

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
    chatsAPI.getMainChat().then(res => {
        setUserList(res.data?.participants?.filter(p => p.user_id !== currentUser.user_id) || []);
    });
  }, [loadData, currentUser.user_id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const handleClick = (e) => {
        if (!e.target.closest('.bubble-wrapper') && !e.target.closest('.insta-menu')) {
            setContextMsgId(null);
        }
        if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target)) {
            setReactionPickerMsgId(null);
        }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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
    setMessages(prev => prev.map(m => {
        if (m.message_id !== msgId) return m;
        const exists = m.reactions?.find(r => r.emoji === emoji);
        let updated = [...(m.reactions || [])];
        
        // Remove ANY existing reaction by "me" to enforce single-reaction limit
        updated = updated.map(r => ({ ...r, count: r.me ? r.count - 1 : r.count, me: false })).filter(r => r.count > 0);

        if (exists?.me) {
            // Already reacted with the same emoji -> toggled off (already handled by line above)
        } else {
            // New emoji or was different emoji -> add this one
            const newExists = updated.find(r => r.emoji === emoji);
            if (newExists) {
                updated = updated.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, me: true } : r);
            } else {
                updated.push({ emoji, count: 1, me: true });
            }
        }
        return { ...m, reactions: updated };
    }));
    try {
        await messagesAPI.react(msgId, emoji);
        setReactionPickerMsgId(null);
        setContextMsgId(null);
    } catch (err) { console.error('React failed:', err); }
  };

  const handleForward = async (targetUser) => {
    if (!forwardMsg) return;
    try {
        const res = await chatsAPI.createPrivateChat(targetUser.user_id);
        const targetChatId = res.data.chat_id;
        if (forwardMsg.image_file_id) {
            await imagesAPI.sendImageMessage(targetChatId, forwardMsg.image_file_id, forwardMsg.message_text);
        } else {
            await messagesAPI.send(targetChatId, forwardMsg.message_text);
        }
        setForwardMsg(null);
        window.dispatchEvent(new Event('refresh-chat-list'));
    } catch (err) { console.error('Forward failed:', err); }
  };

  const isOwnMessage = (msg) => String(msg.sender_id) === String(currentUser?.user_id);

  return (
    <div className="teams-chat insta-vibe">
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="header-icon">🛡️</span>
          <div>
            <h2 className="title">Office Chat</h2>
            <span className="subtitle">{participants.length} Active Users</span>
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
              className={`msg-row ${isOwnMessage(msg) ? 'own' : 'other'} ${contextMsgId === msg.message_id ? 'highlight' : ''}`}
              style={{ zIndex: contextMsgId === msg.message_id ? 9999 : 1, position: 'relative' }}
            >              
              <div 
                className="bubble-wrapper"
                onContextMenu={(e) => { 
                  e.preventDefault(); 
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuPosition(rect.top < 220 ? 'bottom' : 'top');
                  setContextMsgId(msg.message_id); 
                }}
                onMouseDown={(e) => { 
                  const target = e.currentTarget;
                  longPressTimer.current = setTimeout(() => {
                    const rect = target.getBoundingClientRect();
                    setMenuPosition(rect.top < 220 ? 'bottom' : 'top');
                    setContextMsgId(msg.message_id);
                  }, 600); 
                }}
                onMouseUp={() => clearTimeout(longPressTimer.current)}
                onTouchStart={(e) => { 
                  const target = e.currentTarget;
                  longPressTimer.current = setTimeout(() => {
                    const rect = target.getBoundingClientRect();
                    setMenuPosition(rect.top < 220 ? 'bottom' : 'top');
                    setContextMsgId(msg.message_id);
                  }, 600); 
                }}
                onTouchEnd={() => clearTimeout(longPressTimer.current)}
              >
                {!isOwnMessage(msg) && (
                  <div className="other-sender-label">{msg.sender_name}</div>
                )}
                
                <div className={`bubble ${isOwnMessage(msg) ? 'own' : 'other'}`}>
                  {msg.parent_id && (
                    <div className="reply-quote-bar">
                      <span className="quote-sender">{msg.parent_sender === currentUser.display_name ? 'You' : msg.parent_sender}</span>
                      <p className="quote-text">{msg.parent_text}</p>
                    </div>
                  )}
                  
                  {msg.image_file_id ? (
                     <div className="media-attachment-container">
                        <MediaMessage 
                            fileId={msg.image_url || msg.image_file_id} 
                            width={msg.image_width} 
                            height={msg.image_height} 
                            onOpen={(url) => setSelectedImage(url)} 
                        />
                        {msg.message_text && <p className="text with-image">{msg.message_text}</p>}
                     </div>
                  ) : (
                    <p className="text">{msg.message_text}</p>
                  )}

                  <div className="meta">
                    <span className="time">
                      {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {msg.reactions?.length > 0 && (
                    <div className="reactions-pill-container" onClick={() => setContextMsgId(msg.message_id)}>
                      {msg.reactions.map(r => (
                        <button key={r.emoji} className={`pill ${r.me ? 'me' : ''}`} onClick={(e) => { e.stopPropagation(); handleReact(msg.message_id, r.emoji); }}>
                          {r.emoji} {r.count}
                        </button>
                      ))}
                    </div>
                  )}

                  {contextMsgId === msg.message_id && (
                    <div className={`insta-menu ${menuPosition}`}>
                        <div className="insta-reaction-row">
                            {['❤️', '🙌', '🔥', '😂', '😮', '😢'].map(e => (
                                <button key={e} onClick={() => handleReact(msg.message_id, e)} className="insta-react-btn">{e}</button>
                            ))}
                            <button className="insta-react-btn plus" onClick={() => setReactionPickerMsgId(msg.message_id)}>＋</button>
                             {reactionPickerMsgId === msg.message_id && (
                                <div className="insta-full-picker" ref={reactionPickerRef}>
                                    <RichPicker onEmojiSelect={(e) => handleReact(msg.message_id, e)} onGifSelect={() => {}} />
                                </div>
                            )}
                        </div>
                        <div className="insta-action-list">
                            <button onClick={() => { setReplyTo(msg); setContextMsgId(null); setFocusTrigger(f => f + 1); }}>Reply</button>
                            <button onClick={() => { setForwardMsg(msg); setContextMsgId(null); }}>Forward</button>
                            <button onClick={() => { navigator.clipboard.writeText(msg.message_text); setContextMsgId(null); }}>Copy</button>
                        </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {forwardMsg && (
          <div className="forward-modal-overlay">
              <div className="forward-modal fade-in">
                  <div className="modal-header">
                      <h3>Forward to</h3>
                      <button onClick={() => setForwardMsg(null)}>✕</button>
                  </div>
                  <div className="user-list-scroll">
                      {userList.map(u => (
                          <div key={u.user_id} className="user-item" onClick={() => handleForward(u)}>
                              <div className="user-avatar-small">{u.display_name[0]}</div>
                              <div className="user-name-small">{u.display_name}</div>
                              <button className="send-forward-btn">Send</button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {replyTo && (
        <div className="reply-preview">
          <div className="preview-content">
            <span className="preview-sender">Replying to {replyTo.sender_id === currentUser.user_id ? 'You' : replyTo.sender_name}</span>
            <p className="preview-text">{replyTo.message_text}</p>
          </div>
          <button className="preview-close" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      <MessageInput onSend={handleSend} onImageSend={handleImageSend} disabled={!wsReady} chatId={chatId} focusTrigger={focusTrigger} />

      {selectedImage && <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />}

      <style jsx>{`
        .teams-chat.insta-vibe { display: flex; flex-direction: column; height: 100%; background: #050510; position: relative; overflow: hidden; }
        .chat-header { padding: 16px 20px; background: rgba(10,10,20,0.8); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.05); }
        .header-icon { font-size: 1.4rem; background: #7c6af7; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; margin-right: 12px; }
        .chat-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        
        .msg-row { display: flex; flex-direction: column; width: 100%; }
        .msg-row.own { align-items: flex-end; }
        .msg-row.other { align-items: flex-start; }
        
        .bubble-wrapper { max-width: 80%; position: relative; }
        .other-sender-label { font-size: 0.7rem; font-weight: 700; color: #7c6af7; margin-bottom: 4px; margin-left: 12px; }
        
        .bubble { padding: 10px 14px; border-radius: 18px; position: relative; font-size: 0.95rem; line-height: 1.4; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
        .bubble.own { background: linear-gradient(135deg, #7c6af7, #a855f7); color: white; border-bottom-right-radius: 4px; }
        .bubble.other { background: #262635; color: white; border-bottom-left-radius: 4px; }
        
        .msg-row.highlight { opacity: 0.7; transform: scale(0.98); }
        
        .insta-menu { position: absolute; z-index: 10000; background: #1c1c28; border-radius: 18px; padding: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); animation: slideIn 0.2s ease-out; min-width: 180px; }
        .insta-menu.top { bottom: calc(100% + 10px); }
        .insta-menu.bottom { top: calc(100% + 10px); }
        
        .msg-row.own .insta-menu { right: 0; }
        .msg-row.other .insta-menu { left: 0; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        
        .insta-reaction-row { display: flex; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 4px; justify-content: space-around; }
        .insta-react-btn { background: none; border: none; font-size: 1.4rem; cursor: pointer; transition: transform 0.2s; }
        .insta-react-btn:hover { transform: scale(1.3); }
        .insta-action-list { display: flex; flex-direction: column; gap: 0; }
        .insta-action-list button { background: none; border: none; padding: 10px 14px; color: white; text-align: left; border-radius: 0; cursor: pointer; transition: background 0.2s; font-size: 0.9rem; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .insta-action-list button:last-child { border-bottom: none; }
        .insta-action-list button:hover { background: rgba(255,255,255,0.05); color: #7c6af7; }
        
        .reactions-pill-container { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .pill { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 3px 8px; font-size: 0.7rem; color: #ccc; cursor: pointer; transition: all 0.2s; }
        .pill.me { border-color: #7c6af7; background: rgba(124, 106, 247, 0.2); color: white; }
        
        .meta { margin-top: 4px; text-align: right; }
        .time { font-size: 0.65rem; color: rgba(255,255,255,0.3); }
        .insta-full-picker { position: absolute; bottom: 100%; left: 0; z-index: 10001; }

        .reply-quote-bar {
          background: rgba(255, 255, 255, 0.1);
          border-left: 3px solid #fff;
          padding: 6px 10px;
          border-radius: 6px;
          margin-bottom: 6px;
          font-size: 0.8rem;
          max-width: 100%;
          cursor: pointer;
        }
        .bubble.other .reply-quote-bar {
          background: rgba(255, 255, 255, 0.05);
          border-left-color: #7c6af7;
        }
        .quote-sender { font-weight: 700; display: block; margin-bottom: 2px; opacity: 0.9; font-size: 0.75rem; }
        .quote-text { margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.7; }

        .reply-preview {
          background: #10101a;
          border-top: 1px solid rgba(255,255,255,0.05);
          padding: 10px 16px; 
          display: flex; 
          align-items: center; 
          gap: 12px;
          animation: slideUp 0.2s ease-out;
        }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .preview-content { flex: 1; border-left: 3px solid #7c6af7; padding-left: 12px; min-width: 0; }
        .preview-sender { font-size: 0.75rem; font-weight: 700; color: #7c6af7; display: block; margin-bottom: 1px; }
        .preview-text { font-size: 0.8rem; margin: 0; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .preview-close { background: none; border: none; color: #666; font-size: 1.1rem; cursor: pointer; padding: 4px; }

        .forward-modal-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px); z-index: 20000;
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .forward-modal {
          background: #1c1c28; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px; width: 100%; max-width: 360px;
          display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        }
        .modal-header {
          padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex; align-items: center; justify-content: space-between;
        }
        .modal-header h3 { font-size: 1rem; margin: 0; font-weight: 700; }
        .modal-header button { background: none; border: none; color: #888; font-size: 1.2rem; cursor: pointer; }
        .user-list-scroll { max-height: 320px; overflow-y: auto; padding: 12px; }
        .user-item {
          display: flex; align-items: center; gap: 12px; padding: 10px;
          border-radius: 14px; cursor: pointer; transition: background 0.2s;
        }
        .user-item:hover { background: rgba(255,255,255,0.05); }
        .user-avatar-small {
          width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, #7c6af7, #a855f7);
          display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; color: white;
        }
        .user-name-small { flex: 1; font-size: 0.9rem; font-weight: 500; }
        .send-forward-btn {
          background: rgba(124,106,247,0.15); color: #7c6af7; border: 1px solid rgba(124,106,247,0.3); padding: 5px 12px;
          border-radius: 8px; font-weight: 600; font-size: 0.75rem; transition: all 0.2s;
        }
        .user-item:hover .send-forward-btn { background: #7c6af7; color: white; }

        .spinner { width: 30px; height: 30px; border: 3px solid rgba(124,106,247,0.2); border-top: 3px solid #7c6af7; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (min-width: 1024px) {
          .bubble-wrapper { max-width: 65%; }
          .bubble { padding: 8px 14px; font-size: 0.875rem; }
          .title { font-size: 1.25rem; }
          .subtitle { font-size: 0.8rem; }
        }

        @media (max-width: 768px) {
          .chat-header { display: none; }
          .chat-body { padding: 12px 10px; gap: 10px; }
          .bubble-wrapper { max-width: 92%; }
          .bubble { padding: 9px 12px; font-size: 0.9rem; }
          .insta-menu { min-width: 170px; padding: 8px; font-size: 0.85rem; }
          .insta-action-list button { padding: 8px 10px; font-size: 0.85rem; }
          .reactions-pill-container { gap: 3px; margin-top: 6px; }
          .pill { padding: 2px 6px; font-size: 0.65rem; }
          .header-icon { width: 30px; height: 30px; font-size: 1.1rem; margin-right: 8px; }
          .title { font-size: 1.1rem; }
          .subtitle { font-size: 0.75rem; }
        }
      `}</style>
    </div>
  );
}
