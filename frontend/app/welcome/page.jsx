'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    { 
      icon: '🛡️', 
      title: 'The Gateway', 
      desc: 'No passwords to leak. No usernames to hack. Enter the workspace securely with your Google account in just one click.',
      label: 'Security First'
    },
    { 
      icon: '🎭', 
      title: 'The Mask', 
      desc: 'On your first visit, pick an alias. This becomes your unique identity within the app. Your real name remains a ghost.',
      label: 'Identity Control'
    },
    { 
      icon: '💬', 
      title: 'The Whisper', 
      desc: 'Some thoughts are meant for one. Start secure, private conversations that stay between you and your colleague.',
      label: 'Direct Access'
    },
    { 
      icon: '⏱️', 
      title: 'The 24h Cycle', 
      desc: 'Everything resets with the sun. We preserve context for 24 hours, then wipe the slate clean for a fresh day.',
      label: 'Ephemeral Peace'
    },
    { 
      icon: '📲', 
      title: 'The Shortcut', 
      desc: 'Take the workspace with you. Install this chat to your home screen for native speed and instant accessibility.',
      label: 'Stay Connected',
      isPWA: true
    },
    { 
      icon: '✨', 
      title: 'Ready?', 
      desc: 'You are now briefed on the workspace. Your coworkers are waiting. Step into the anonymous hall.',
      label: 'Get Started',
      isFinal: true
    }
  ];

  const next = () => {
    if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1);
  };

  const prev = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
  };

  const slide = slides[currentSlide];

  return (
    <div className="welcome-page">
      <div className="aurora-container">
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
      </div>

      <div className="welcome-content">
        <div className="onboarding-card glass shadow-neon">
          <div className="card-top">
            <span className="slide-label">{slide.label}</span>
            <div className="progress-dots">
              {slides.map((_, i) => (
                <div key={i} className={`dot ${i === currentSlide ? 'active' : ''}`} />
              ))}
            </div>
          </div>

          <div className="slide-content fade-in" key={currentSlide}>
            <div className="slide-icon">{slide.icon}</div>
            <h1 className="slide-title">{slide.title}</h1>
            <p className="slide-desc">{slide.desc}</p>
          </div>

          <div className="card-controls">
            {currentSlide > 0 && (
              <button className="btn-secondary" onClick={prev}>Previous</button>
            )}
            
            {slide.isFinal ? (
              <button className="btn-primary highlight-btn" onClick={() => router.push('/login')}>
                Login Now
              </button>
            ) : slide.isPWA ? (
              <div className="pwa-controls" style={{ display: 'flex', gap: '12px', flex: 1 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={next}>Skip</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={() => {
                  window.dispatchEvent(new Event('trigger-pwa-install'));
                  next();
                }}>Install</button>
              </div>
            ) : (
              <button className="btn-primary" onClick={next}>Next</button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .welcome-page {
          min-height: 100vh;
          background: #02020a;
          color: white;
          overflow: hidden;
          position: relative;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        .aurora-container { position: fixed; inset: 0; filter: blur(100px); opacity: 0.5; z-index: 1; }
        .aurora { position: absolute; border-radius: 50%; animation: drift 20s infinite alternate ease-in-out; }
        .aurora-1 { width: 600px; height: 600px; background: #3b82f6; top: -10%; left: -10%; }
        .aurora-2 { width: 500px; height: 500px; background: #7c3aed; bottom: -5%; right: -5%; animation-delay: -5s; }
        .aurora-3 { width: 400px; height: 400px; background: #db2777; top: 30%; right: 10%; animation-delay: -10s; }

        @keyframes drift { to { transform: translate(15%, 15%) scale(1.2) rotate(30deg); } }

        .welcome-content {
          position: relative;
          z-index: 10;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .onboarding-card {
          width: 100%;
          max-width: 480px;
          min-height: 520px;
          padding: 40px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-radius: 40px;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(24px) saturate(180%);
        }
        
        .shadow-neon {
          box-shadow: 0 20px 80px rgba(0,0,0,0.5), 0 0 20px rgba(124, 106, 247, 0.1);
        }

        .card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; }
        .slide-label { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #7c3aed; }
        
        .progress-dots { display: flex; gap: 6px; }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.1); transition: all 0.3s; }
        .dot.active { background: #7c3aed; width: 20px; border-radius: 10px; }

        .slide-content { flex: 1; text-align: center; }
        .slide-icon { font-size: 4.5rem; margin-bottom: 24px; animation: bounce 4s infinite ease-in-out; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        
        .slide-title { font-size: 2.2rem; font-weight: 900; margin-bottom: 16px; letter-spacing: -0.02em; }
        .slide-desc { font-size: 1.05rem; line-height: 1.6; color: rgba(255,255,255,0.6); }

        .card-controls { display: flex; gap: 12px; margin-top: 40px; }
        
        button {
          height: 56px;
          border-radius: 20px;
          border: none;
          font-weight: 800;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex; align-items: center; justify-content: center;
        }

        .btn-primary {
          background: white;
          color: black;
          flex: 1;
          box-shadow: 0 10px 30px rgba(255,255,255,0.1);
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 15px 40px rgba(255,255,255,0.2); }
        .btn-primary:active { transform: scale(0.98); }
        
        .highlight-btn {
          background: linear-gradient(135deg, #7c3aed, #db2777);
          color: white;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.05);
          color: white;
          padding: 0 24px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }

        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 480px) {
          .onboarding-card { padding: 32px 24px; min-height: 480px; }
          .slide-title { font-size: 1.8rem; }
        }
      `}</style>
    </div>
  );
}
