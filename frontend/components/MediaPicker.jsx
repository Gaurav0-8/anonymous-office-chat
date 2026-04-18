'use client';

import { useRef } from 'react';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function MediaPicker({ onSelect, onClose }) {
  const fileInputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Only JPG, PNG, GIF, WebP images are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be under 10MB.');
      return;
    }
    onSelect(file);
  };

  return (
    <div className="media-picker">
      <div className="media-picker-header">
        <span>Attach Image</span>
        <button onClick={onClose} className="media-close-btn">✕</button>
      </div>

      <div className="media-picker-body">
        <div className="media-drop-zone" onClick={() => fileInputRef.current?.click()}>
          <span className="media-drop-icon">📷</span>
          <p>Click to select an image</p>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>JPG, PNG, GIF, WebP — max 10MB</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>

      <style jsx>{`
        .media-picker {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 12px; margin-top: 8px;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
        }
        .media-picker-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border-bottom: 1px solid var(--border);
          font-size: 0.875rem; font-weight: 600;
        }
        .media-close-btn {
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); padding: 2px 6px; border-radius: 4px;
        }
        .media-close-btn:hover { color: var(--danger); }
        .media-picker-body { padding: 16px; }
        .media-drop-zone {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          border: 2px dashed var(--border); border-radius: 10px; padding: 24px;
          cursor: pointer; transition: border-color 0.2s, background 0.2s;
          text-align: center; font-size: 0.875rem; color: var(--text-secondary);
        }
        .media-drop-zone:hover { border-color: var(--accent); background: var(--accent-glow); }
        .media-drop-icon { font-size: 2rem; }
      `}</style>
    </div>
  );
}
