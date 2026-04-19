'use client';

import { useState, useRef, useEffect } from 'react';
import RichPicker from './RichPicker';
import { imagesAPI } from '@/lib/api';

export default function MessageInput({ onSend, onImageSend, disabled, chatId, focusTrigger }) {
  const [text, setText] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pastedFile, setPastedFile] = useState(null);
  const [pastedPreview, setPastedPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (focusTrigger > 0) inputRef.current?.focus();
  }, [focusTrigger]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target) && !event.target.closest('.emoji-trigger')) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isUploading) return;

    if (pastedFile) {
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', pastedFile);
            const res = await imagesAPI.upload(formData);
            // Default to standard send (no vanish mode)
            await onImageSend(res.data.file_id, text);
            setPastedFile(null);
            setPastedPreview(null);
            setText('');
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Failed to send image');
        } finally {
            setIsUploading(false);
        }
        return;
    }

    if (text.trim() && !disabled) {
      onSend(text);
      setText('');
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            setPastedFile(file);
            const reader = new FileReader();
            reader.onload = (event) => setPastedPreview(event.target.result);
            reader.readAsDataURL(file);
            e.preventDefault();
        }
    }
  };

  return (
    <div className="message-input-area">
      {pastedPreview && (
          <div className="pasted-media-preview-bar fade-in">
              <div className="preview-container">
                  <img src={pastedPreview} alt="Paste preview" />
                  <button className="remove-pasted" onClick={() => { setPastedFile(null); setPastedPreview(null); }}>✕</button>
              </div>
              <div className="preview-metadata">
                  <span>Image attached</span>
              </div>
          </div>
      )}

      <form onSubmit={handleSubmit} className="input-container">
        <div className="picker-wrapper" ref={pickerRef}>
          {showPicker && (
            <div className="picker-popover">
                <RichPicker 
                    onEmojiSelect={(e) => { setText(p => p + e); inputRef.current?.focus(); }} 
                    onGifSelect={(url) => { onSend(url); setShowPicker(false); }}
                    onClose={() => setShowPicker(false)}
                />
            </div>
          )}
          <button type="button" className="action-btn emoji-trigger" onClick={() => setShowPicker(!showPicker)}>😊</button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          placeholder={pastedFile ? "Add a caption..." : "Message..."}
          disabled={disabled || isUploading}
          className="main-input"
        />

        <button type="submit" disabled={disabled || (!text.trim() && !pastedFile) || isUploading} className="send-btn">
          {isUploading ? <div className="spinner-mini" /> : '▲'}
        </button>
      </form>

      <style jsx>{`
        .message-input-area { padding: 12px 20px; background: #050510; border-top: 1px solid rgba(255,255,255,0.05); }
        .pasted-media-preview-bar { background: #1c1c28; border-radius: 18px; padding: 12px; margin-bottom: 12px; display: flex; align-items: center; gap: 16px; border: 1px solid #7c6af7; box-shadow: 0 8px 30px rgba(124, 106, 247, 0.2); }
        .preview-container { position: relative; width: 64px; height: 64px; border-radius: 12px; overflow: hidden; flex-shrink: 0; border: 2px solid rgba(255,255,255,0.1); }
        .preview-container img { width: 100%; height: 100%; object-fit: cover; }
        .remove-pasted { position: absolute; top: -2px; right: -2px; background: #ff4757; border: none; color: white; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; }
        .preview-metadata { font-size: 0.85rem; color: #888; font-weight: 600; }
        
        .input-container { display: flex; align-items: center; gap: 10px; background: #1c1c28; border-radius: 26px; padding: 6px 14px; border: 1px solid rgba(255,255,255,0.05); }
        .main-input { flex: 1; background: none; border: none; color: white; padding: 10px 0; outline: none; font-size: 0.95rem; }
        .action-btn { background: none; border: none; font-size: 1.3rem; cursor: pointer; opacity: 0.7; }
        .send-btn { background: #7c6af7; color: white; border: none; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; transition: all 0.2s; }
        .send-btn:disabled { background: #262635; color: #555; cursor: not-allowed; }
        .picker-popover { position: absolute; bottom: 65px; left: 20px; z-index: 2000; animation: bounceUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        @keyframes bounceUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .spinner-mini { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.2); border-top: 2px solid white; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .message-input-area { padding: 10px 14px; padding-bottom: max(10px, env(safe-area-inset-bottom)); }
          .input-container { padding: 4px 10px; gap: 8px; border-radius: 20px; }
          .main-input { font-size: 0.95rem; /* Prevents iOS auto-zoom */ }
          .action-btn { font-size: 1.2rem; }
          .send-btn { width: 30px; height: 30px; font-size: 0.8rem; }
        }
      `}</style>
    </div>
  );
}
