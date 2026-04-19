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

  // Click outside to close picker
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
            reader.onload = (event) => {
                setPastedPreview(event.target.result);
            };
            reader.readAsDataURL(file);
            e.preventDefault();
        }
    }
  };

  const handleSelectRich = (item) => {
    if (item.type === 'emoji') {
      setText(prev => prev + item.data);
    } else {
      // GIF/Sticker
      onSend(item.data);
      setShowPicker(false);
    }
  };

  return (
    <div className="message-input-area">
      {pastedPreview && (
          <div className="pasted-media-preview-bar">
              <div className="preview-container">
                  <img src={pastedPreview} alt="Paste preview" />
                  <button className="remove-pasted" onClick={() => { setPastedFile(null); setPastedPreview(null); }}>✕</button>
              </div>
              <div className="preview-metadata">
                  <span>Image ready to send. Type a caption below.</span>
              </div>
          </div>
      )}

      <form onSubmit={handleSubmit} className="input-container">
        <div className="picker-wrapper" ref={pickerRef}>
          {showPicker && <div className="picker-popover"><RichPicker onSelect={handleSelectRich} /></div>}
          <button type="button" className="action-btn emoji-trigger" onClick={() => setShowPicker(!showPicker)}>😊</button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          placeholder={pastedFile ? "Add a caption..." : "Type a message or paste an image..."}
          disabled={disabled || isUploading}
          className="main-input"
        />

        <button type="submit" disabled={disabled || (!text.trim() && !pastedFile) || isUploading} className="send-btn">
          {isUploading ? <div className="spinner-mini" /> : '▲'}
        </button>
      </form>

      <style jsx>{`
        .message-input-area { padding: 12px 20px; background: #1a1926; border-top: 1px solid #2a293d; position: relative; }
        .pasted-media-preview-bar { background: #232231; border-radius: 12px; padding: 12px; margin-bottom: 12px; display: flex; align-items: center; gap: 16px; border: 1px solid #7c6af7; box-shadow: 0 4px 15px rgba(124, 106, 247, 0.2); }
        .preview-container { position: relative; width: 60px; height: 60px; border-radius: 8px; overflow: hidden; flex-shrink: 0; }
        .preview-container img { width: 100%; height: 100%; object-fit: cover; }
        .remove-pasted { position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.7); border: none; color: white; width: 20px; height: 20px; font-size: 0.6rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .preview-metadata { font-size: 0.8rem; color: #8888aa; }
        
        .input-container { display: flex; align-items: center; gap: 10px; background: #111019; border-radius: 12px; padding: 6px 12px; border: 1px solid #2a293d; transition: border-color 0.2s; }
        .input-container:focus-within { border-color: #7c6af7; }
        .main-input { flex: 1; background: none; border: none; color: white; padding: 10px 0; outline: none; font-size: 0.95rem; }
        .action-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 4px; opacity: 0.7; transition: opacity 0.2s; }
        .action-btn:hover { opacity: 1; }
        .send-btn { background: #7c6af7; color: white; border: none; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .send-btn:disabled { background: #2a293d; color: #55556a; cursor: not-allowed; }
        .send-btn:not(:disabled):hover { background: #8b5cf6; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124, 106, 247, 0.3); }
        .picker-wrapper { position: relative; }
        .picker-popover { position: absolute; bottom: 50px; left: 0; z-index: 2000; animation: slideUp 0.15s ease-out; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .spinner-mini { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.2); border-top: 2px solid white; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
