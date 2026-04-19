'use client';

import { useState, useRef, useEffect } from 'react';
import { imagesAPI } from '@/lib/api';
import { createPortal } from 'react-dom';
import MediaPicker from './MediaPicker';
import RichPicker from './RichPicker';

export default function MessageInput({ onSend, onImageSend, disabled, chatId, focusTrigger }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showRich, setShowRich] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (focusTrigger) {
      textareaRef.current?.focus();
    }
  }, [focusTrigger]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    try {
      setSending(true);
      await onSend(text.trim());
      setText('');
      textareaRef.current?.focus();
    } catch (err) { console.error('Send error', err); } finally { setSending(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await imagesAPI.upload(formData);
      await onImageSend(data.file_id, text.trim());
      setText('');
      setShowMedia(false);
    } catch (err) { console.error('Upload error', err); }
  };

  return (
    <div className="message-input-wrapper">
      <div className="message-input-bar">
        <button className="input-action-btn" onClick={() => { setShowRich(!showRich); setShowMedia(false); }} disabled={disabled}>😊</button>
        <button className="input-action-btn" onClick={() => { setShowMedia(!showMedia); setShowRich(false); }} disabled={disabled}>📎</button>
        <textarea ref={textareaRef} className="message-textarea" placeholder={disabled ? 'Connecting...' : 'Type a message...'} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown} disabled={disabled || sending} rows={1} />
        <button className={`send-btn ${text.trim() ? 'active' : ''}`} onClick={handleSend} disabled={!text.trim() || disabled || sending}>
          {sending ? <div className="spinner" /> : <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
        </button>
      </div>

      {showRich && typeof document !== 'undefined' && createPortal(
        <div className="rich-picker-portal-overlay" onClick={() => setShowRich(false)}>
          <div className="rich-picker-popover-fixed" onClick={e => e.stopPropagation()}>
            <RichPicker 
              onEmojiSelect={(emoji) => { setText(prev => prev + emoji); textareaRef.current?.focus(); }}
              onGifSelect={async (url) => { await onImageSend(url, ''); setShowRich(false); }}
              onClose={() => setShowRich(false)}
            />
          </div>
        </div>,
        document.body
      )}

      {showMedia && <MediaPicker onSelect={handleImageUpload} onClose={() => setShowMedia(false)} />}

      <style jsx>{`
        .message-input-wrapper { border-top: 1px solid #2a293d; background: #1a1926; padding: 12px 16px; }
        .message-input-bar { display: flex; align-items: flex-end; gap: 10px; background: #232231; border: 1px solid #2a293d; border-radius: 12px; padding: 8px 12px; }
        .input-action-btn { background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.6; }
        .message-textarea { flex: 1; background: transparent; border: none; outline: none; color: white; font-size: 0.9rem; resize: none; max-height: 120px; }
        .send-btn { background: #232231; border: 1px solid #2a293d; color: #8888aa; border-radius: 8px; width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .send-btn.active { background: #7c6af7; color: white; }
        .rich-picker-popover-fixed { position: fixed; bottom: 80px; left: 20px; z-index: 10000; }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
