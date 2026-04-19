'use client';

import { useState, useEffect, useRef } from 'react';
import { imagesAPI } from '@/lib/api';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

const TENOR_API_KEY = 'LIVDSRZULEUB';

export default function RichPicker({ onEmojiSelect, onGifSelect, onStickerSelect, onClose }) {
  const [activeTab, setActiveTab] = useState('emoji');
  const [activePack, setActivePack] = useState('memes');
  const [gifs, setGifs] = useState([]);
  const [communityStickers, setCommunityStickers] = useState([]);
  const [gifSearch, setGifSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const fileInputRef = useRef(null);

  // High-Quality Starter Sticker Packs
  const starterPacks = {
    memes: [
      { id: 's1', url: 'https://i.imgflip.com/4/30zz5g.jpg', label: 'Jalwa' },
      { id: 's2', url: 'https://i.imgflip.com/4/1ur9b0.jpg', label: 'Paisa' },
      { id: 's3', url: 'https://i.imgflip.com/4/26am.jpg', label: 'Saale' },
      { id: 's4', url: 'https://i.imgflip.com/4/9ehk.jpg', label: 'Control' },
    ],
    reactions: [
      { id: 'r1', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f921/512.webp', label: 'Clown' },
      { id: 'r2', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f5ff/512.webp', label: 'Chad' },
    ]
  };

  useEffect(() => {
    const saved = localStorage.getItem('chat_favorites');
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  const fetchCommunityStickers = async () => {
    try {
      const res = await imagesAPI.getStickers();
      setCommunityStickers(res.data || []);
    } catch (err) {
      console.error('Failed to fetch community stickers:', err);
    }
  };

  useEffect(() => {
    fetchCommunityStickers();
  }, []);

  const handleCreateSticker = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_sticker', 'true'); // Tells backend to make it permanent

    try {
      const res = await imagesAPI.upload(formData);
      const newStickerUrl = res.data.url.startsWith('/') ? `${window.location.origin}${res.data.url}` : res.data.url;
      
      // Auto-favorite and select it
      toggleFavorite({ id: res.data.file_id, url: newStickerUrl }, 'sticker');
      onStickerSelect(newStickerUrl);
      
      // Refresh list
      fetchCommunityStickers();
    } catch (err) {
      alert('Failed to upload sticker. Try a smaller image.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (item, type) => {
    const newItem = { ...item, type };
    setFavorites(prev => {
      const exists = prev.find(f => f.id === item.id);
      let updated;
      if (exists) {
        updated = prev.filter(f => f.id !== item.id);
      } else {
        updated = [newItem, ...prev].slice(0, 50);
      }
      localStorage.setItem('chat_favorites', JSON.stringify(updated));
      return updated;
    });
  };

  const fetchGifs = async (query = 'trending') => {
    setLoading(true);
    try {
      const endpoint = !query || query === 'trending'
        ? `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=12&client_key=chatapp_v2`
        : `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&q=${query}&limit=12&client_key=chatapp_v2`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error('Failed to fetch GIFs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'gif' && gifs.length === 0) fetchGifs('trending');
    if (activeTab === 'community') fetchCommunityStickers();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'gif') {
      const timeoutId = setTimeout(() => {
        if (gifSearch.length > 1) fetchGifs(gifSearch);
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
            placeholder={activeTab === 'gif' ? "Search Tenor..." : "Search emojis..."}
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
            <div className="sticker-grid">
              {favorites.map(f => (
                <div key={f.id} className="sticker-wrapper" onClick={() => f.type === 'gif' ? onGifSelect(f.url) : onStickerSelect(f.url)}>
                   <img src={f.url} alt="" className={f.type === 'gif' ? 'gif-thumb' : ''} />
                </div>
              ))}
              {favorites.length === 0 && <div className="empty-state">No favorites yet.</div>}
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
              {loading ? <div className="loader">Loading...</div> : gifs.map(gif => (
                <img 
                  key={gif.id} 
                  src={gif.media_formats.tinygif.url} 
                  onClick={() => onGifSelect(gif.media_formats.gif.url)}
                  className="gif-item"
                  alt=""
                />
              ))}
            </div>
          </div>
        )}

        {(activeTab === 'sticker' || activeTab === 'community') && (
          <div className="sticker-section">
            <div className="pack-nav">
               <button className={`pack-btn ${activeTab === 'sticker' && activePack === 'memes' ? 'active' : ''}`} onClick={() => {setActiveTab('sticker'); setActivePack('memes');}}>🇮🇳 Memes</button>
               <button className={`pack-btn ${activeTab === 'sticker' && activePack === 'reactions' ? 'active' : ''}`} onClick={() => {setActiveTab('sticker'); setActivePack('reactions');}}>🔥 Reactions</button>
               <button className={`pack-btn community-tab-btn ${activeTab === 'community' ? 'active' : ''}`} onClick={() => setActiveTab('community')}>👥 Community</button>
               <button className="pack-btn create-btn" onClick={() => fileInputRef.current.click()}>➕ Create</button>
            </div>
            
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleCreateSticker} />

            <div className="sticker-grid">
               {loading ? <div className="loader">Uploading...</div> : (
                  activeTab === 'community' ? (
                    communityStickers.length === 0 ? <div className="empty-state">No community stickers yet. Be the first!</div> :
                    communityStickers.map(s => (
                      <div key={s.id} className="sticker-wrapper">
                         <img src={s.url} alt="" onClick={() => onStickerSelect(s.url)} />
                         <button 
                           className={`fav-star ${favorites.find(f => f.id === s.id) ? 'active' : ''}`}
                           onClick={() => toggleFavorite({id: s.id, url: s.url}, 'sticker')}
                         >★</button>
                      </div>
                    ))
                  ) : (
                    starterPacks[activePack].map(s => (
                      <div key={s.id} className="sticker-wrapper">
                         <img src={s.url} alt={s.label} onClick={() => onStickerSelect(s.url)} />
                         <button 
                           className={`fav-star ${favorites.find(f => f.id === s.id) ? 'active' : ''}`}
                           onClick={() => toggleFavorite({id: s.id, url: s.url}, 'sticker')}
                         >★</button>
                      </div>
                    ))
                  )
               )}
            </div>
          </div>
        )}
      </div>

      <div className="picker-footer">
        <button className={`nav-tab ${activeTab === 'recent' ? 'active' : ''}`} onClick={() => setActiveTab('recent')}>🕒</button>
        <button className={`nav-tab ${activeTab === 'emoji' ? 'active' : ''}`} onClick={() => setActiveTab('emoji')}>😀</button>
        <button className={`nav-tab ${activeTab === 'gif' ? 'active' : ''}`} onClick={() => setActiveTab('gif')}>🎬</button>
        <button className={`nav-tab ${activeTab === 'sticker' || activeTab === 'community' ? 'active' : ''}`} onClick={() => setActiveTab('sticker')}>🖼️</button>
      </div>

      <style jsx>{`
        .whatsapp-picker {
          background: #1a1a24; width: 380px; height: 480px; border-radius: 24px;
          display: flex; flex-direction: column; overflow: hidden; border: 1px solid #2e2e45;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6); animation: slideIn 0.15s ease-out;
        }
        @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .picker-header { padding: 12px 16px; display: flex; align-items: center; gap: 12px; background: #252535; }
        .search-bar { flex: 1; background: #1a1a24; border-radius: 20px; display: flex; align-items: center; padding: 6px 14px; gap: 10px; }
        .search-bar input { background: none; border: none; color: white; width: 100%; outline: none; font-size: 0.85rem; }
        .close-btn { background: none; border: none; color: #8888aa; cursor: pointer; font-size: 1.1rem; }
        .picker-body { flex: 1; overflow-y: auto; overflow-x: hidden; }
        .section-label { font-size: 0.7rem; color: #7c6af7; font-weight: 800; text-transform: uppercase; padding: 15px 20px 10px; display: block; }
        .sticker-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 10px 20px; }
        .sticker-wrapper { position: relative; aspect-ratio: 1; background: #252535; border-radius: 12px; overflow: hidden; cursor: pointer; }
        .sticker-wrapper img { width: 100%; height: 100%; object-fit: contain; padding: 5px; }
        .gif-thumb { object-fit: cover !important; padding: 0 !important; }
        .fav-star { 
          position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.5); border: none; color: #fff; 
          width: 22px; height: 22px; border-radius: 50%; font-size: 0.7rem; cursor: pointer; opacity: 0.5;
        }
        .fav-star.active { color: #f5a623; opacity: 1; }
        .pack-nav { display: flex; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #2e2e45; overflow-x: auto; }
        .pack-btn { background: #252535; border: 1px solid #2e2e45; border-radius: 12px; padding: 4px 10px; font-size: 0.7rem; color: #8888aa; white-space: nowrap; cursor: pointer; }
        .pack-btn.active { background: #7c6af7; color: white; border-color: #7c6af7; }
        .community-tab-btn { border-color: #4ecb71; color: #4ecb71; }
        .create-btn { background: #1a1a24; border-style: dashed; color: #7c6af7; }
        .gif-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 12px; }
        .gif-item { width: 100%; height: 110px; object-fit: cover; border-radius: 8px; cursor: pointer; }
        .picker-footer { display: flex; background: #252535; padding: 6px 10px; border-top: 1px solid #2e2e45; }
        .nav-tab { flex: 1; padding: 8px; font-size: 1.2rem; background: none; border: none; cursor: pointer; filter: grayscale(1); opacity: 0.6; }
        .nav-tab.active { filter: grayscale(0); opacity: 1; transform: scale(1.1); }
        .loader { color: #8888aa; text-align: center; padding: 40px; font-size: 0.8rem; grid-column: span 3; }
        .empty-state { grid-column: span 3; color: #55556a; text-align: center; padding: 50px 0; font-size: 0.8rem; }
      `}</style>
    </div>
  );
}
