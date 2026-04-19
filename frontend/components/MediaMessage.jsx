'use client';

import { useState } from 'react';
import { imagesAPI } from '@/lib/api';

export default function MediaMessage({ fileId, width, height, onOpen, viewOnce, viewedAt, messageId, isOwn }) {
  const [localViewed, setLocalViewed] = useState(!!viewedAt);
  const isUrl = fileId && (fileId.startsWith('http://') || fileId.startsWith('https://'));
  const src = isUrl ? fileId : `/uploads/${fileId}`;
  
  const aspectRatio = width && height ? `${width}/${height}` : 'auto';

  const handleOpenVanish = async () => {
    if (localViewed) return;
    onOpen(src);
    if (!isOwn) {
        try {
            await imagesAPI.confirmView(messageId);
            setLocalViewed(true);
        } catch (e) { console.error('Vanish confirm failed', e); }
    }
  };

  if (viewOnce) {
    return (
        <div className={`vanish-bubble ${localViewed ? 'viewed' : ''}`} onClick={handleOpenVanish}>
            <div className="vanish-icon">
                {localViewed ? '📤' : '📸'}
            </div>
            <div className="vanish-label">
                {localViewed ? 'Opened' : (isOwn ? 'Photo' : 'View Photo')}
            </div>
            <style jsx>{`
                .vanish-bubble {
                    display: flex; align-items: center; gap: 10px;
                    padding: 8px 16px; border-radius: 20px;
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.1);
                    cursor: pointer; min-width: 140px;
                    transition: all 0.2s;
                    margin-bottom: 4px;
                }
                .vanish-bubble:not(.viewed):hover { background: rgba(255,255,255,0.15); border-color: #7c6af7; }
                .vanish-bubble.viewed { opacity: 0.5; cursor: default; }
                .vanish-icon { font-size: 1.2rem; }
                .vanish-label { font-size: 0.9rem; font-weight: 700; color: white; }
            `}</style>
        </div>
    );
  }

  return (
    <div className="media-message" style={{ maxWidth: 300 }}>
      <img
        src={src}
        alt="Shared media"
        style={{ aspectRatio, minHeight: '100px', backgroundColor: '#1c1c28' }}
        className="media-msg-img"
        loading="lazy"
        onClick={() => onOpen(src)}
        onError={(e) => { 
          // Fallback if filepath is direct
          if (!e.target.src.includes('undefined')) {
             const parts = fileId.split('.');
             if (parts.length > 1) e.target.src = `/uploads/${fileId}`;
          }
        }}
      />

      <style jsx>{`
        .media-message { width: 100%; cursor: pointer; margin-bottom: 4px; }
        .media-msg-img {
          width: 100%; height: auto; border-radius: 12px;
          object-fit: cover; display: block;
          transition: opacity 0.2s;
        }
        .media-msg-img:hover { opacity: 0.95; }
      `}</style>
    </div>
  );
}
