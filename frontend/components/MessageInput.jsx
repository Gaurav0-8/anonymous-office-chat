'use client';

import { useState, useRef } from 'react';
import { imagesAPI } from '@/lib/api';
import { createPortal } from 'react-dom';
import MediaPicker from './MediaPicker';
import RichPicker from './RichPicker';

export default function MessageInput({ onSend, onImageSend, disabled, chatId }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showRich, setShowRich] = useState(false);
  const textareaRef = useRef(null);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    try {
      setSending(true);
      await onSend(text.trim());
      setText('');
      textareaRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
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
    } catch (err) {
      console.error('Failed to send image:', err);
    }
  };

  return (
    <div className="message-input-wrapper">
      <div className="message-input-bar">
        <button
          className="input-action-btn"
          id="emoji-trigger-btn"
          onClick={() => { 
            console.log('[MessageInput] Emoji button clicked, current state:', showRich);
            setShowRich(!showRich); 
            setShowMedia(false); 
          }}
          disabled={disabled}
          title="Emojis & GIFs"
        >
          😊
        </button>

        <button
          className="input-action-btn"
          onClick={() => { setShowMedia(!showMedia); setShowRich(false); }}
          disabled={disabled}
          title="Attach media"
        >
          📎
        </button>

        <textarea
          ref={textareaRef}
          className="message-textarea"
          placeholder={disabled ? 'Connecting...' : 'Type a message... (Enter to send)'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          rows={1}
        />

        <button
          className={`send-btn ${text.trim() ? 'active' : ''}`}
          onClick={handleSend}
          disabled={!text.trim() || disabled || sending}
          title="Send message"
        >
          {sending ? (
            <div className="spinner" style={{ width: 18, height: 18 }} />
          ) : (
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>

      {showRich && typeof document !== 'undefined' && createPortal(
        <div className="rich-picker-portal-overlay" onClick={() => setShowRich(false)}>
          <div className="rich-picker-popover-fixed" onClick={e => e.stopPropagation()}>
            <RichPicker 
              onEmojiSelect={(emoji) => {
                setText(prev => prev + emoji);
                textareaRef.current?.focus();
              }}
              onGifSelect={async (url) => { 
                await onImageSend(url, ''); 
                setShowRich(false); 
              }}
              onClose={() => setShowRich(false)}
            />
          </div>
        </div>,
        document.body
      )}

      {showMedia && (
        <MediaPicker onSelect={handleImageUpload} onClose={() => setShowMedia(false)} />
      )}

      <style jsx>{`
        .message-input-wrapper {
          border-top: 1px solid var(--border);
          background: var(--bg-secondary);
          padding: 12px 16px;
          position: relative; /* CRITICAL: Anchors the absolute popovers */
        }
        .message-input-bar {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 8px 12px;
          transition: border-color 0.2s;
        }
        .message-input-bar:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }
        .input-action-btn {
          background: none; border: none; cursor: pointer;
          font-size: 1.1rem; padding: 4px;
          opacity: 0.6; transition: opacity 0.2s;
          flex-shrink: 0;
        }
        .input-action-btn:hover { opacity: 1; }
        .input-action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .message-textarea {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--text-primary); font-size: 0.9rem; line-height: 1.5;
          resize: none; max-height: 120px; overflow-y: auto;
          font-family: inherit;
        }
        .message-textarea::placeholder { color: var(--text-muted); }
        .send-btn {
          background: var(--bg-card); border: 1px solid var(--border);
          color: var(--text-muted); border-radius: 8px;
          width: 36px; height: 36px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.2s;
        }
        .send-btn.active {
          background: var(--accent); border-color: var(--accent);
          color: white; box-shadow: 0 2px 8px var(--accent-glow);
        }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .send-btn.active:hover { background: var(--accent-hover); transform: scale(1.05); }
        .rich-picker-portal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: transparent;
        }
        .rich-picker-popover-fixed {
          position: fixed;
          bottom: 80px;
          left: 20px;
          z-index: 10000;
          filter: drop-shadow(0 8px 40px rgba(0,0,0,0.6));
        }
        @media (max-width: 480px) {
          .rich-picker-popover-fixed {
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
