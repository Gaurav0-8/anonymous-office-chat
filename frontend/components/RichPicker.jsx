'use client';

import { useState, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

const TENOR_API_KEY = 'LIVDSRZULEUB'; // Common public demo key or use a placeholder
const TENOR_API_KEY = 'LIVDSRZULEUB';

export default function RichPicker({ onEmojiSelect, onGifSelect, onStickerSelect, onClose }) {
  const [activeTab, setActiveTab] = useState('emoji');
  const [gifs, setGifs] = useState([]);
  const [gifSearch, setGifSearch] = useState('');
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [favorites, setFavorites] = useState([]);

  // Indian Meme Stickers & Dark Humor
  const stickers = [
    { id: 'jalwa', content: '😎', label: 'Jalwa hai Hamara' },
    { id: 'paisa', content: '🤑', label: 'Paisa hi Paisa' },
    { id: 'saale', content: '😤', label: 'Abey Saale!' },
    { id: 'control', content: '😇', label: 'Control Uday...' },
    { id: 'mirzapur', content: '🔫', label: 'Bhaukal' },
    { id: 'hera_pheri', content: '🤡', label: '21 Din mein Paise Double' },
    { id: 'chup', content: '🤫', label: 'Bilkul Chup!' },
    { id: 'doge', content: '🐕', label: 'Doge Meme' },
    { id: 'chad', content: '🗿', label: 'Giga Chad' },
    { id: 'clown', content: '🤡', label: 'Hum bhi Pagal...' },
    { id: 'skull', content: '💀', label: 'Ded' },
    { id: 'fire', content: '🔥', label: 'Jhukega Nahi' },
  ];

  useEffect(() => {
    const saved = localStorage.getItem('chat_favorites');
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  const toggleFavorite = (item, type) => {
    const newItem = { ...item, type };
    setFavorites(prev => {
      const exists = prev.find(f => f.id === item.id);
      const updated = exists ? prev.filter(f => f.id !== item.id) : [newItem, ...prev];
      localStorage.setItem('chat_favorites', JSON.stringify(updated.slice(0, 20)));
      return updated;
    });
  };

  useEffect(() => {
    if (activeTab === 'gif' && gifs.length === 0) {
      fetchGifs('trending');
    }
  }, [activeTab]);

  const fetchGifs = async (query) => {
    setLoadingGifs(true);
    try {
      const endpoint = query === 'trending' 
        ? `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=12&client_key=chatapp_v2`
        : `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&q=${query}&limit=12&client_key=chatapp_v2`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error('Failed to fetch GIFs:', err);
    } finally {
      setLoadingGifs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'gif') {
      const timeoutId = setTimeout(() => {
        if (gifSearch.length > 2) fetchGifs(gifSearch);
        else if (gifSearch === '') fetchGifs('trending');
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [gifSearch, activeTab]);

  return (
    <div className="rich-picker">
      <div className="picker-tabs">
        <button 
          className={`tab-btn ${activeTab === 'emoji' ? 'active' : ''}`}
          onClick={() => setActiveTab('emoji')}
        >
          😀 Emoji
        </button>
        <button 
          className={`tab-btn ${activeTab === 'gif' ? 'active' : ''}`}
          onClick={() => setActiveTab('gif')}
        >
          🎬 GIFs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'sticker' ? 'active' : ''}`}
          onClick={() => setActiveTab('sticker')}
        >
          ✨ Stickers
        </button>
        <button onClick={onClose} className="picker-close">✕</button>
      </div>

      <div className="picker-content">
        {/* Quick Actions / Create at the top */}
        <div className="quick-actions">
           <button className="action-item create-btn">➕ Create Sticker</button>
           <button className="action-item trending-btn" onClick={() => { setActiveTab('gif'); fetchGifs('trending'); }}>🔥 Trending</button>
        </div>

        {activeTab === 'emoji' && (
          <div className="emoji-container">
            <Picker 
              data={data} 
              onEmojiSelect={(emoji) => onEmojiSelect(emoji.native)}
              theme="dark"
              set="native"
              previewPosition="none"
              skinTonePosition="none"
              navPosition="bottom"
              perLine={8}
            />
          </div>
        )}

        {activeTab === 'gif' && (
          <div className="gif-container">
            <input 
              type="text" 
              className="gif-search" 
              placeholder="Search Tenor GIFs..." 
              value={gifSearch}
              onChange={(e) => setGifSearch(e.target.value)}
            />
            <div className="gif-grid">
              {loadingGifs ? (
                <div className="picker-loader">Loading...</div>
              ) : (
                gifs.map((gif) => (
                  <div key={gif.id} className="gif-wrapper">
                    <img 
                      src={gif.media_formats.tinygif.url} 
                      alt={gif.content_description}
                      className="gif-item"
                      onClick={() => onGifSelect(gif.media_formats.gif.url)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'sticker' && (
          <div className="sticker-container">
            {favorites.length > 0 && (
               <div className="favorites-section">
                  <span className="section-title">⭐ Favorites</span>
                  <div className="sticker-grid favorite-grid">
                    {favorites.map(f => (
                      <button key={`fav-${f.id}`} className="sticker-item" onClick={() => onStickerSelect(f.content)}>
                        {f.content}
                      </button>
                    ))}
                  </div>
               </div>
            )}

            <div className="all-stickers-section">
              <span className="section-title">🎭 Indian Memes</span>
              <div className="sticker-grid">
                {stickers.map((s) => (
                  <div key={s.id} className="sticker-wrapper">
                    <button 
                      className="sticker-item"
                      onClick={() => onStickerSelect(s.content)}
                      title={s.label}
                    >
                      {s.content}
                      <span className="sticker-label">{s.label}</span>
                    </button>
                    <button 
                      className={`fav-toggle ${favorites.find(f => f.id === s.id) ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(s, 'sticker'); }}
                    >
                      ★
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .rich-picker {
          background: #12121e;
          border: 1px solid #2e2e45;
          border-radius: 20px;
          overflow: hidden;
          width: 380px;
          height: 480px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 50px rgba(0,0,0,0.6);
          animation: scaleUp 0.15s ease-out;
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .picker-tabs {
          display: flex;
          padding: 10px;
          gap: 6px;
          background: #1a1a2e;
          border-bottom: 1px solid #2e2e45;
        }
        .tab-btn {
          flex: 1;
          background: #252535;
          border: none;
          padding: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          color: #8888aa;
          cursor: pointer;
          border-radius: 10px;
          transition: all 0.2s;
        }
        .tab-btn.active {
          background: var(--accent, #7c6af7);
          color: white;
        }
        .picker-close {
          background: none; border: none; color: #55556a;
          cursor: pointer; padding: 0 10px; font-size: 1.2rem;
        }
        .quick-actions {
          display: flex;
          padding: 10px 14px;
          gap: 8px;
          border-bottom: 1px solid #2e2e45;
          background: rgba(0,0,0,0.1);
        }
        .action-item {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 700;
          border: 1px dashed #3e3e55;
          background: transparent;
          color: #aaaaee;
          cursor: pointer;
          transition: all 0.2s;
        }
        .action-item:hover { background: #252535; border-color: var(--accent, #7c6af7); }
        .picker-content {
          flex: 1;
          overflow-y: auto;
          position: relative;
        }
        .emoji-container { height: 100%; }
        .gif-container { padding: 12px; height: 100%; display: flex; flex-direction: column; gap: 12px; }
        .gif-search {
          background: #252535; border: 1px solid #2e2e45;
          padding: 10px 14px; border-radius: 12px;
          color: white; font-size: 0.85rem; outline: none;
        }
        .gif-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .gif-item { width: 100%; height: 110px; object-fit: cover; border-radius: 8px; cursor: pointer; transition: transform 0.2s; }
        .gif-item:hover { transform: scale(1.03); }
        .sticker-container { padding: 14px; display: flex; flex-direction: column; gap: 20px; }
        .section-title {
          font-size: 0.75rem; color: #7c6af7; font-weight: 800;
          text-transform: uppercase; letter-spacing: 1px;
          margin-bottom: 10px; display: block;
        }
        .sticker-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .sticker-wrapper { position: relative; }
        .sticker-item {
          width: 100%;
          background: #1a1a2e;
          border: 1px solid #2e2e45;
          border-radius: 14px;
          aspect-ratio: 1;
          font-size: 2.2rem;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          padding-top: 5px;
        }
        .sticker-label { font-size: 0.55rem; font-weight: 700; color: #8888aa; margin-top: 4px; text-align: center; }
        .sticker-item:hover { background: #2e2e45; transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .fav-toggle {
          position: absolute; top: 5px; right: 5px;
          background: none; border: none; color: #3e3e55;
          cursor: pointer; font-size: 0.9rem; transition: color 0.2s;
        }
        .fav-toggle.active { color: #f5a623; }
        .picker-loader { grid-column: span 2; text-align: center; padding: 40px; color: #8888aa; }
        @media (max-width: 480px) {
          .rich-picker { width: 100%; height: 400px; border-radius: 20px 20px 0 0; }
        }
      `}</style>
    </div>
  );
}
