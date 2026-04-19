'use client';

import { useState, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

// Using Giphy Public Beta Key
const GIPHY_API_KEY = 'cwEZMAd8U7YscbyV7zUuK27y0YIuOkpT';

export default function RichPicker({ onEmojiSelect, onGifSelect, onClose }) {
  const [activeTab, setActiveTab] = useState('emoji');
  const [gifs, setGifs] = useState([]);
  const [gifSearch, setGifSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 🎬 Giphy Integration
  const fetchGifs = async (query = '') => {
    setLoading(true);
    try {
      const endpoint = !query
        ? `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`
        : `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${query}&limit=20&rating=g&lang=en`;
      
      const res = await fetch(endpoint);
      const { data } = await res.json();
      setGifs(data || []);
    } catch (err) {
      console.error('Giphy Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'gif' && gifs.length === 0) fetchGifs();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'gif') {
      const timeoutId = setTimeout(() => {
        fetchGifs(gifSearch);
      }, 600);
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
            placeholder={activeTab === 'gif' ? "Search Giphy..." : "Search emojis..."}
            value={gifSearch}
            onChange={(e) => setGifSearch(e.target.value)}
          />
        </div>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="picker-body">
        {activeTab === 'emoji' && (
          <div className="emoji-section">
             <Picker 
              data={data} 
              onEmojiSelect={(emoji) => onEmojiSelect(emoji.native)}
              theme="dark"
              set="native"
              previewPosition="none"
              navPosition="none"
              perLine={8}
            />
          </div>
        )}

        {activeTab === 'gif' && (
          <div className="gif-section">
            <div className="gif-grid">
              {loading ? <div className="loader">⚡ Loading Giphys...</div> : gifs.length === 0 ? <div className="empty-state">No GIFs found</div> : gifs.map(gif => (
                <img 
                  key={gif.id} 
                  src={gif.images.fixed_width_small.url} 
                  onClick={() => onGifSelect(gif.images.original.url)}
                  className="gif-item"
                  alt=""
                />
              ))}
            </div>
            <div className="giphy-attribution">Powered by GIPHY</div>
          </div>
        )}
      </div>

      <div className="picker-footer">
        <button className={`nav-tab ${activeTab === 'emoji' ? 'active' : ''}`} onClick={() => setActiveTab('emoji')}>😀 Emoji</button>
        <button className={`nav-tab ${activeTab === 'gif' ? 'active' : ''}`} onClick={() => setActiveTab('gif')}>🎬 GIFs</button>
      </div>

      <style jsx>{`
        .whatsapp-picker { background: #1a1a24; width: 380px; height: 480px; border-radius: 24px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #2e2e45; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
        .picker-header { padding: 12px 16px; display: flex; align-items: center; gap: 12px; background: #252535; }
        .search-bar { flex: 1; background: #1a1a24; border-radius: 20px; display: flex; align-items: center; padding: 6px 14px; gap: 10px; }
        .search-bar input { background: none; border: none; color: white; width: 100%; outline: none; font-size: 0.85rem; }
        .close-btn { background: none; border: none; color: #8888aa; cursor: pointer; font-size: 1.1rem; }
        .picker-body { flex: 1; overflow-y: auto; overflow-x: hidden; }
        .gif-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 12px; }
        .gif-item { width: 100%; height: 110px; object-fit: cover; border-radius: 8px; cursor: pointer; transition: transform 0.2s; }
        .gif-item:hover { transform: scale(1.02); }
        .giphy-attribution { font-size: 0.6rem; color: #55556a; text-align: center; padding: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .picker-footer { display: flex; background: #252535; padding: 6px 10px; border-top: 1px solid #2e2e45; gap: 10px; }
        .nav-tab { flex: 1; padding: 10px; font-size: 0.85rem; font-weight: 700; background: #1a1a24; color: #8888aa; border: 1px solid #2e2e45; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
        .nav-tab.active { background: #7c6af7; color: white; border-color: #7c6af7; }
        .loader { color: #8888aa; text-align: center; padding: 40px; font-size: 0.8rem; grid-column: span 2; }
        .empty-state { grid-column: span 2; color: #55556a; text-align: center; padding: 50px 0; font-size: 0.8rem; }
        @media (max-width: 480px) { .whatsapp-picker { width: 100%; height: 450px; border-radius: 24px 24px 0 0; } }
      `}</style>
    </div>
  );
}
