'use client';

import { useState, useEffect, useCallback } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

const TENOR_API_KEY = 'LIVDSRZULEUB';
const GIPHY_KEYS = ['dc6zaTOxFJmzC', '0UT9HBy9j9nrSAtCHp8UvFp6q7M6Q9YF'];

export default function RichPicker({ onEmojiSelect, onGifSelect, onClose }) {
  const [activeTab, setActiveTab] = useState('emoji');
  const [gifs, setGifs] = useState([]);
  const [gifSearch, setGifSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchGifs = useCallback(async (query = '') => {
    setLoading(true);
    setErrorMsg('');
    
    try {
        const endpoint = `https://tenor.googleapis.com/v2/posts?key=${TENOR_API_KEY}&limit=20&q=${query || 'trending'}`;
        const res = await fetch(endpoint);
        if (res.ok) {
            const json = await res.json();
            const formatted = json.results?.map(r => ({
                id: r.id,
                images: { 
                    fixed_width_small: { url: r.media_formats?.tinygif?.url }, 
                    original: { url: r.media_formats?.gif?.url } 
                }
            })) || [];
            if (formatted.length > 0) {
                setGifs(formatted);
                setLoading(false);
                return;
            }
        }
    } catch (err) { console.warn('GIF fallback trigger', err); }

    for (const key of GIPHY_KEYS) {
        try {
          const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(query || 'trending')}&limit=20&rating=g`);
          if (res.status === 401) continue;
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setGifs(json.data);
            setLoading(false);
            return;
          }
        } catch (e) { /* ignore */ }
    }

    setErrorMsg('GIFs currently unavailable.');
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'gif' && gifs.length === 0) fetchGifs();
  }, [activeTab, gifs.length, fetchGifs]);

  useEffect(() => {
    if (activeTab === 'gif') {
      const timeoutId = setTimeout(() => fetchGifs(gifSearch), 600);
      return () => clearTimeout(timeoutId);
    }
  }, [gifSearch, activeTab, fetchGifs]);

  return (
    <div className="whatsapp-picker">
      <div className="picker-header">
        <div className="search-bar">
          <input 
            type="text" 
            placeholder={activeTab === 'gif' ? "Search Tenor GIFs..." : "Search emojis..."}
            value={gifSearch}
            onChange={(e) => setGifSearch(e.target.value)}
          />
        </div>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="picker-body">
        {activeTab === 'emoji' && (
          <div className="emoji-section">
             <Picker data={data} onEmojiSelect={(emoji) => onEmojiSelect(emoji.native)} theme="dark" set="native" previewPosition="none" navPosition="none" perLine={8} />
          </div>
        )}

        {activeTab === 'gif' && (
          <div className="gif-section">
            <div className="gif-grid">
              {loading ? (
                <div className="loader">⚡ Connecting...</div>
              ) : errorMsg ? (
                <div className="empty-state">{errorMsg}</div>
              ) : gifs.map(gif => (
                <img key={gif.id} src={gif.images?.fixed_width_small?.url} onClick={() => onGifSelect(gif.images?.original?.url)} className="gif-item" alt="gif" />
              ))}
            </div>
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
        .search-bar { flex: 1; background: #1a1a24; border-radius: 20px; display: flex; align-items: center; padding: 6px 14px; }
        .search-bar input { background: none; border: none; color: white; width: 100%; outline: none; font-size: 0.85rem; }
        .close-btn { background: none; border: none; color: #8888aa; cursor: pointer; }
        .picker-body { flex: 1; overflow-y: auto; }
        .gif-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 12px; }
        .gif-item { width: 100%; height: 110px; object-fit: cover; border-radius: 8px; cursor: pointer; }
        .picker-footer { display: flex; background: #252535; padding: 6px 10px; border-top: 1px solid #2e2e45; gap: 10px; }
        .nav-tab { flex: 1; padding: 10px; font-size: 0.85rem; font-weight: 700; background: #1a1a24; color: #8888aa; border: 1px solid #2e2e45; border-radius: 12px; cursor: pointer; }
        .nav-tab.active { background: #7c6af7; color: white; border-color: #7c6af7; }
        .loader { color: #8888aa; text-align: center; padding: 40px; }
        .empty-state { grid-column: span 2; color: #55556a; text-align: center; padding: 50px 0; }
      `}</style>
    </div>
  );
}
