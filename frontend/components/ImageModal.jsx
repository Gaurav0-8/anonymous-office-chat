'use client';

import { useEffect } from 'react';

export default function ImageModal({ src, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <img src={src} alt="Full size image" className="modal-image" />
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.85); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }
        .modal-content { position: relative; max-width: 90vw; max-height: 90vh; }
        .modal-close {
          position: absolute; top: -14px; right: -14px;
          background: var(--bg-card); border: 1px solid var(--border);
          color: var(--text-primary); width: 32px; height: 32px;
          border-radius: 50%; cursor: pointer; font-size: 0.85rem;
          display: flex; align-items: center; justify-content: center;
          z-index: 10; transition: background 0.2s;
        }
        .modal-close:hover { background: var(--danger); color: white; }
        .modal-image {
          max-width: 90vw; max-height: 85vh;
          border-radius: 12px; display: block;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
}
