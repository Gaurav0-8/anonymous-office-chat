'use client';

import { useState, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

const TENOR_API_KEY = 'LIVDSRZULEUB'; // Common public demo key or use a placeholder

export default function RichPicker({ onEmojiSelect, onGifSelect, onStickerSelect, onClose }) {
  const [activeTab, setActiveTab] = useState('emoji');
  const [gifs, setGifs] = useState([]);
  const [gifSearch, setGifSearch] = useState('');
  const [loadingGifs, setLoadingGifs] = useState(false);

  // Sample Stickers (Emojis rendered large or custom SVGs)
  const stickers = [
    { id: 'rocket', content: '🚀' },
    { id: 'fire', content: '🔥' },
    { id: 'heart', content: '❤️' },
    { id: 'cool', content: '😎' },
    { id: 'laugh', content: '😂' },
    { id: 'party', content: '🎉' },
    { id: 'cat', content: '🐱' },
    { id: 'dog', content: '🐶' },
    { id: 'unicorn', content: '🦄' },
    { id: 'alien', content: '👽' },
    { id: 'taco', content: '🌮' },
    { id: 'pizza', content: '🍕' },
  ];

  useEffect(() => {
    if (activeTab === 'gif' && gifs.length === 0) {
      fetchGifs('trending');
    }
  }, [activeTab]);

  const fetchGifs = async (query) => {
    setLoadingGifs(true);
    try {
      const endpoint = query === 'trending' 
        ? `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=12`
        : `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&q=${query}&limit=12`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error('Failed to fetch GIFs:', err);
    } finally {
      setLoadingGifs(false);
    }
  };

  const handleGifSearch = (e) => {
    const val = e.target.value;
    setGifSearch(val);
    if (val.length > 2) {
      const timeoutId = setTimeout(() => fetchGifs(val), 500);
      return () => clearTimeout(timeoutId);
    } else if (val === '') {
      fetchGifs('trending');
    }
  };

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
              onChange={handleGifSearch}
            />
            <div className="gif-grid">
              {loadingGifs ? (
                <div className="picker-loader">Loading...</div>
              ) : (
                gifs.map((gif) => (
                  <img 
                    key={gif.id} 
                    src={gif.media_formats.tinygif.url} 
                    alt={gif.content_description}
                    className="gif-item"
                    onClick={() => onGifSelect(gif.media_formats.gif.url)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'sticker' && (
          <div className="sticker-container">
            <div className="sticker-grid">
              {stickers.map((s) => (
                <button 
                  key={s.id} 
                  className="sticker-item"
                  onClick={() => onStickerSelect(s.content)}
                >
                  {s.content}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .rich-picker {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          width: 350px;
          height: 400px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 40px rgba(0,0,0,0.4);
          animation: scaleUp 0.2s ease-out;
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .picker-tabs {
          display: flex;
          padding: 8px;
          gap: 4px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }
        .tab-btn {
          flex: 1;
          background: none;
          border: none;
          padding: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .tab-btn:hover { background: var(--border); color: var(--text-primary); }
        .tab-btn.active {
          background: var(--accent);
          color: white;
        }
        .picker-close {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0 8px;
          font-size: 1.1rem;
        }
        .picker-content {
          flex: 1;
          overflow: hidden;
          position: relative;
        }
        .emoji-container {
          height: 100%;
        }
        .gif-container {
          padding: 12px;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .gif-search {
          background: var(--bg-input);
          border: 1px solid var(--border);
          padding: 8px 12px;
          border-radius: 8px;
          color: white;
          font-size: 0.85rem;
          outline: none;
        }
        .gif-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          overflow-y: auto;
        }
        .gif-item {
          width: 100%;
          height: 100px;
          object-fit: cover;
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .gif-item:hover { transform: scale(1.05); }
        .sticker-container {
          padding: 16px;
          height: 100%;
          overflow-y: auto;
        }
        .sticker-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .sticker-item {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          aspect-ratio: 1;
          font-size: 2.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .sticker-item:hover {
          background: var(--border);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .picker-loader {
          grid-column: span 2;
          text-align: center;
          padding: 40px;
          color: var(--text-muted);
        }
        @media (max-width: 480px) {
          .rich-picker {
            width: 100%;
            height: 350px;
            border-radius: 16px 16px 0 0;
          }
        }
      `}</style>
    </div>
  );
}
