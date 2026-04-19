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
  const [forwardMsg, setForwardMsg] = useState(null);
  const [userList, setUserList] = useState([]);
  const [messageReaders, setMessageReaders] = useState({});
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

  const handleImageSend = async (fileId, text, viewOnce = false) => {
     try {
       await imagesAPI.sendImageMessage(chatId, fileId, text, viewOnce);
       setReplyTo(null);
     } catch (err) { console.error('Image send failed:', err); }
  };

  const handleReact = async (msgId, emoji) => {
    setMessages(prev => prev.map(m => {
        if (m.message_id !== msgId) return m;
        const exists = m.reactions?.find(r => r.emoji === emoji);
        let updated = [...(m.reactions || [])];
        if (exists?.me) {
            updated = updated.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, me: false } : r).filter(r => r.count > 0);
        } else if (exists) {
            updated = updated.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, me: true } : r);
        } else {
            updated.push({ emoji, count: 1, me: true });
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
            await imagesAPI.sendImageMessage(targetChatId, forwardMsg.image_file_id, forwardMsg.message_text, forwardMsg.view_once);
        } else {
            await messagesAPI.send(targetChatId, forwardMsg.message_text);
        }
        setForwardMsg(null);
        alert(`Forwarded to ${targetUser.display_name}`);
    } catch (err) { console.error('Forward failed:', err); }
  };

  const isOwnMessage = (msg) => msg.sender_id === currentUser.user_id;

  return (
    <div className="teams-chat insta-vibe">
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="group-avatar">💬</span>
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
            >              
              <div 
                className="bubble-wrapper"
                onContextMenu={(e) => { e.preventDefault(); setContextMsgId(msg.message_id); }}
                onMouseDown={() => { longPressTimer.current = setTimeout(() => setContextMsgId(msg.message_id), 500); }}
                onMouseUp={() => clearTimeout(longPressTimer.current)}
                onTouchStart={() => { longPressTimer.current = setTimeout(() => setContextMsgId(msg.message_id), 500); }}
                onTouchEnd={() => clearTimeout(longPressTimer.current)}
              >
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
                        <MediaMessage 
                            fileId={msg.image_url || msg.image_file_id} 
                            width={msg.image_width} 
                            height={msg.image_height} 
                            onOpen={(url) => setSelectedImage(url)} 
                            viewOnce={msg.view_once}
                            viewedAt={msg.viewed_at}
                            messageId={msg.message_id}
                            isOwn={isOwnMessage(msg)}
                        />
                        {(!msg.view_once || !msg.viewed_at) && msg.message_text && (
                            <p className="text with-image">{msg.message_text}</p>
                        )}
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
                    <div className="insta-menu">
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
                            <button onClick={() => { setReplyTo(msg); setContextMsgId(null); setFocusTrigger(f => f + 1); }}>↩️ Reply</button>
                            <button onClick={() => { setForwardMsg(msg); setContextMsgId(null); }}>➡️ Forward</button>
                            <button onClick={() => { navigator.clipboard.writeText(msg.message_text); setContextMsgId(null); }}>📋 Copy</button>
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
                      <h3>Forward to...</h3>
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
            <span className="preview-sender">Replying to {replyTo.sender_name}</span>
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
        .group-avatar { font-size: 1.6rem; border-radius: 50%; background: #7c6af7; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; }
        .chat-body { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .msg-row { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .msg-row.highlight { opacity: 0.8; }
        .bubble { padding: 12px 16px; border-radius: 22px; position: relative; }
        .bubble.own { background: linear-gradient(135deg, #7c6af7, #a855f7); color: white; border-bottom-right-radius: 4px; }
        .bubble.other { background: #262635; color: white; border-bottom-left-radius: 4px; }
        .sender { font-size: 0.75rem; font-weight: 700; color: #a855f7; margin-bottom: 4px; display: block; }
        .insta-menu { position: absolute; bottom: calc(100% + 10px); left: 0; z-index: 1000; background: #1c1c28; border-radius: 18px; padding: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); min-width: 200px; }
        .msg-row.own .insta-menu { left: auto; right: 0; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .insta-reaction-row { display: flex; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px; justify-content: space-around; }
        .insta-react-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; transition: transform 0.2s; padding: 4px; }
        .insta-react-btn:hover { transform: scale(1.3); }
        .insta-react-btn.plus { font-size: 1.1rem; color: #888; background: rgba(255,255,255,0.05); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
        .insta-action-list { display: flex; flex-direction: column; gap: 4px; }
        .insta-action-list button { background: none; border: none; padding: 10px 14px; color: white; text-align: left; border-radius: 10px; cursor: pointer; transition: background 0.2s; font-size: 0.9rem; font-weight: 600; }
        .insta-action-list button:hover { background: rgba(255,255,255,0.05); color: #7c6af7; }
        .reactions-pill-container { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
        .pill { background: rgba(255,255,255,0.08); border: none; border-radius: 12px; padding: 4px 10px; font-size: 0.75rem; color: white; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
        .pill.me { background: rgba(124, 106, 247, 0.3); border: 1px solid #7c6af7; }
        .forward-modal-overlay { position: fixed; inset: 0; z-index: 10001; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .forward-modal { background: #1a1926; border-radius: 20px; width: 100%; max-width: 360px; overflow: hidden; border: 1px solid #2a293d; }
        .modal-header { padding: 16px 20px; border-bottom: 1px solid #2a293d; display: flex; justify-content: space-between; align-items: center; }
        .user-list-scroll { max-height: 400px; overflow-y: auto; padding: 10px; }
        .user-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; cursor: pointer; transition: background 0.2s; }
        .user-avatar-small { width: 32px; height: 32px; border-radius: 50%; background: #7c6af7; display: flex; align-items: center; justify-content: center; font-weight: 700; }
        .user-item:hover { background: rgba(124,106,247,0.1); }
        .send-forward-btn { margin-left: auto; background: #7c6af7; border: none; border-radius: 8px; color: white; padding: 4px 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
        .meta { margin-top: 6px; text-align: right; }
        .time { font-size: 0.65rem; color: rgba(255,255,255,0.4); }
        .insta-full-picker { position: absolute; bottom: 100%; left: 0; z-index: 10001; }
      `}</style>
    </div>
  );
}
