'use client';

import { useState, useRef } from 'react';
import { imagesAPI } from '@/lib/api';
import MediaPicker from './MediaPicker';

export default function MessageInput({ onSend, onImageSend, disabled, chatId }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
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
          onClick={() => setShowMedia(!showMedia)}
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

      {showMedia && (
        <MediaPicker onSelect={handleImageUpload} onClose={() => setShowMedia(false)} />
      )}

      <style jsx>{`
        .message-input-wrapper {
          border-top: 1px solid var(--border);
          background: var(--bg-secondary);
          padding: 12px 16px;
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
      `}</style>
    </div>
  );
}
