'use client';

import { useState, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

const TENOR_API_KEY = 'LIVDSRZULEUB';

export default function RichPicker({ onEmojiSelect, onGifSelect, onStickerSelect, onClose }) {
  const [activeTab, setActiveTab] = useState('emoji');
  const [activePack, setActivePack] = useState('memes');
  const [gifs, setGifs] = useState([]);
  const [gifSearch, setGifSearch] = useState('');
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [favorites, setFavorites] = useState([]);

  // Sticker Packs Configuration
  const stickerPacks = {
    memes: [
      { id: 'm1', url: 'https://i.imgflip.com/4/30zz5g.jpg', label: 'Jalwa' },
      { id: 'm2', url: 'https://i.imgflip.com/4/1ur9b0.jpg', label: 'Paisa' },
      { id: 'm3', url: 'https://i.imgflip.com/4/26am.jpg', label: 'Saale' },
      { id: 'm4', url: 'https://i.imgflip.com/4/9ehk.jpg', label: 'Control' },
      { id: 'm5', url: 'https://i.imgflip.com/ng749.jpg', label: 'Mirzapur' },
      { id: 'm6', url: 'https://i.imgflip.com/4/19vzk7.jpg', label: 'Hera Pheri' },
    ],
    reactions: [
      { id: 'r1', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f921/512.webp', label: 'Clown' },
      { id: 'r2', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f5ff/512.webp', label: 'Chad' },
      { id: 'r3', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f480/512.webp', label: 'Skull' },
    ]
  };

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
    <div className="whatsapp-picker">
      <div className="picker-header">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder={activeTab === 'gif' ? "Search Tenor..." : "Search emojis & stickers..."}
            value={gifSearch}
            onChange={(e) => setGifSearch(e.target.value)}
          />
        </div>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="picker-body">
        {activeTab === 'recent' && (
          <div className="content-section">
            <span className="section-label">Recently Used</span>
            <div className="sticker-grid favorite-grid">
              {favorites.map(f => (
                <div key={f.id} className="sticker-wrapper" onClick={() => f.type === 'gif' ? onGifSelect(f.url) : onStickerSelect(f.url)}>
                   <img src={f.url} alt="" className={f.type === 'gif' ? 'gif-thumb' : ''} />
                </div>
              ))}
              {favorites.length === 0 && <div className="empty-state">No favorites yet. Star some!</div>}
            </div>
          </div>
        )}

        {activeTab === 'emoji' && (
          <div className="emoji-section">
             <Picker 
              data={data} 
              onEmojiSelect={(emoji) => onEmojiSelect(emoji.native)}
              theme="dark"
              set="native"
              previewPosition="none"
              skinTonePosition="none"
              navPosition="none"
              perLine={8}
            />
          </div>
        )}

        {activeTab === 'gif' && (
          <div className="gif-section">
            <div className="gif-grid">
              {loadingGifs ? <div className="loader">...</div> : gifs.map(gif => (
                <img 
                  key={gif.id} 
                  src={gif.media_formats.tinygif.url} 
                  alt=""
                  onClick={() => onGifSelect(gif.media_formats.gif.url)}
                  className="gif-item"
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sticker' && (
          <div className="sticker-section">
            <div className="pack-nav">
               <button className={`pack-btn ${activePack === 'memes' ? 'active' : ''}`} onClick={() => setActivePack('memes')}>🇮🇳 Memes</button>
               <button className={`pack-btn ${activePack === 'reactions' ? 'active' : ''}`} onClick={() => setActivePack('reactions')}>🔥 Reactions</button>
            </div>
            <div className="sticker-grid">
               {stickerPacks[activePack].map(s => (
                 <div key={s.id} className="sticker-wrapper">
                    <img src={s.url} alt={s.label} onClick={() => onStickerSelect(s.url)} />
                    <button 
                      className={`fav-star ${favorites.find(f => f.id === s.id) ? 'active' : ''}`}
                      onClick={() => toggleFavorite({id: s.id, url: s.url}, 'sticker')}
                    >★</button>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      <div className="picker-footer">
        <button className={`nav-tab ${activeTab === 'recent' ? 'active' : ''}`} onClick={() => setActiveTab('recent')}>🕒</button>
        <button className={`nav-tab ${activeTab === 'emoji' ? 'active' : ''}`} onClick={() => setActiveTab('emoji')}>😀</button>
        <button className={`nav-tab ${activeTab === 'gif' ? 'active' : ''}`} onClick={() => setActiveTab('gif')}>🎬</button>
        <button className={`nav-tab ${activeTab === 'sticker' ? 'active' : ''}`} onClick={() => setActiveTab('sticker')}>🖼️</button>
      </div>

      <style jsx>{`
        .whatsapp-picker {
          background: #1a1a24;
          width: 380px;
          height: 480px;
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          overflow: hidden;
          border: 1px solid #2e2e45;
          animation: slideIn 0.2s ease-out;
        }
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .picker-header {
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: #252535;
        }
        .search-bar {
          flex: 1;
          background: #1a1a24;
          border-radius: 20px;
          display: flex;
          align-items: center;
          padding: 6px 14px;
          gap: 10px;
        }
        .search-icon { font-size: 0.9rem; opacity: 0.5; }
        .search-bar input {
          background: none; border: none; color: white;
          width: 100%; outline: none; font-size: 0.85rem;
        }
        .close-btn { background: none; border: none; color: #8888aa; cursor: pointer; font-size: 1.1rem; }

        .picker-body { flex: 1; overflow-y: auto; padding-bottom: 10px; }
        .section-label { font-size: 0.7rem; color: #7c6af7; font-weight: 800; text-transform: uppercase; padding: 15px 20px 10px; display: block; }
        
        .sticker-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 10px 20px; }
        .sticker-wrapper { position: relative; aspect-ratio: 1; background: #252535; border-radius: 12px; overflow: hidden; cursor: pointer; transition: transform 0.2s; }
        .sticker-wrapper:hover { transform: scale(1.05); }
        .sticker-wrapper img { width: 100%; height: 100%; object-fit: contain; padding: 10px; }
        .fav-star { position: absolute; top: 4px; right: 4px; background: none; border: none; color: #55556a; font-size: 0.9rem; cursor: pointer; }
        .fav-star.active { color: #f5a623; }

        .pack-nav { display: flex; gap: 10px; padding: 12px 20px; border-bottom: 1px solid #2e2e45; overflow-x: auto; margin-bottom: 10px; }
        .pack-btn { background: #252535; border: 1px solid #2e2e45; border-radius: 15px; padding: 4px 12px; font-size: 0.75rem; color: #8888aa; white-space: nowrap; cursor: pointer; }
        .pack-btn.active { background: #7c6af7; color: white; border-color: #7c6af7; }

        .emoji-section { height: 100%; }
        .gif-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 12px; }
        .gif-item { width: 100%; height: 110px; object-fit: cover; border-radius: 8px; cursor: pointer; }

        .picker-footer {
          display: flex;
          background: #252535;
          padding: 6px 10px;
          border-top: 1px solid #2e2e45;
        }
        .nav-tab {
          flex: 1;
          padding: 8px;
          font-size: 1.2rem;
          background: none;
          border: none;
          cursor: pointer;
          filter: grayscale(1);
          opacity: 0.5;
          transition: all 0.2s;
        }
        .nav-tab.active { filter: grayscale(0); opacity: 1; transform: scale(1.1); }
        .loader { color: #8888aa; text-align: center; padding: 20px; }
        
        .empty-state { grid-column: span 3; color: #55556a; text-align: center; padding: 40px 0; font-size: 0.8rem; }
        @media (max-width: 480px) {
          .whatsapp-picker { width: 100%; height: 450px; border-radius: 24px 24px 0 0; }
        }
      `}</style>
    </div>
  );
}
