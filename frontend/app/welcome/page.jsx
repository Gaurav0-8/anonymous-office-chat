'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Skip onboarding if already seen
  useState(() => {
    if (typeof window !== 'undefined') {
      const isComplete = localStorage.getItem('onboarding-complete');
      if (isComplete) {
        router.replace('/login');
      }
    }
  });

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

  const handleLoginJump = () => {
    localStorage.setItem('onboarding-complete', 'true');
    router.push('/login');
  };

  const slide = slides[currentSlide];

  return (
    <div className="welcome-page">
      <div className="aurora-container">
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
      </div>

      {/* Global Shortcut for Old Users */}
      <div className="fast-track-header">
        <button className="btn-signin-shortcut glass" onClick={handleLoginJump}>
          Sign In
        </button>
      </div>

      <div className="welcome-content">
        <div className="onboarding-card glass shadow-neon">
          <div className="app-branding">
            <div className="brand-logo">💬</div>
            <span className="brand-name">ChatApp</span>
          </div>

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
            <div className="nav-arrows">
              {currentSlide > 0 ? (
                <button className="arrow-btn prev" onClick={prev} aria-label="Previous">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              ) : <div className="arrow-placeholder" />}
              
              {slide.isFinal ? (
                <button className="login-final-btn" onClick={handleLoginJump}>
                  <span>Get Started</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              ) : slide.isPWA ? (
                <div className="pwa-action-container">
                  <button className="btn-skip" onClick={next}>Skip</button>
                  <button className="arrow-btn next highlight" onClick={() => {
                    window.dispatchEvent(new Event('trigger-pwa-install'));
                    next();
                  }} aria-label="Install & Next">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button className="arrow-btn next" onClick={next} aria-label="Next">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .welcome-page {
          min-height: 100vh; background: #02020a; color: white;
          overflow: hidden; position: relative; font-family: 'Inter', sans-serif;
        }

        .aurora-container { position: fixed; inset: 0; filter: blur(100px); opacity: 0.5; z-index: 1; }
        .aurora { position: absolute; border-radius: 50%; animation: drift 20s infinite alternate ease-in-out; }
        .aurora-1 { width: 600px; height: 600px; background: #3b82f6; top: -10%; left: -10%; }
        .aurora-2 { width: 500px; height: 500px; background: #7c3aed; bottom: -5%; right: -5%; animation-delay: -5s; }
        .aurora-3 { width: 400px; height: 400px; background: #db2777; top: 30%; right: 10%; animation-delay: -10s; }
        @keyframes drift { to { transform: translate(15%, 15%) scale(1.2) rotate(30deg); } }

        .welcome-content {
          position: relative; z-index: 10; height: 100vh;
          display: flex; align-items: center; justify-content: center; padding: 24px;
        }

        .onboarding-card {
          width: 100%; max-width: 480px; min-height: 580px;
          padding: 40px; display: flex; flex-direction: column;
          border-radius: 40px; border: 1px solid rgba(255,255,255,0.1);
        }

        .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(32px) saturate(180%); }
        .shadow-neon { box-shadow: 0 30px 100px rgba(0,0,0,0.6), 0 0 40px rgba(124, 106, 247, 0.05); }

        .app-branding { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; opacity: 0.8; }
        .brand-logo { font-size: 1.4rem; animation: breathe 4s infinite ease-in-out; }
        .brand-name { font-weight: 800; font-size: 1.1rem; letter-spacing: -0.02em; }
        @keyframes breathe { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.1); opacity: 1; } }

        .card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
        .slide-label { font-size: 0.7rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: rgba(255,255,255,0.4); }
        .progress-dots { display: flex; gap: 6px; }
        .dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.15); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .dot.active { background: #7c3aed; width: 22px; border-radius: 10px; box-shadow: 0 0 10px rgba(124, 106, 247, 0.5); }

        .slide-content { flex: 1; text-align: left; }
        .slide-icon { font-size: 4rem; margin-bottom: 24px; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.3)); }
        .slide-title { font-size: 2.2rem; font-weight: 900; margin-bottom: 16px; letter-spacing: -0.03em; line-height: 1.1; }
        .slide-desc { font-size: 1rem; line-height: 1.6; color: rgba(255,255,255,0.5); }

        .card-controls { margin-top: 40px; }
        .nav-arrows { display: flex; align-items: center; justify-content: space-between; width: 100%; }
        .arrow-placeholder { width: 56px; }

        .arrow-btn {
          width: 56px; height: 56px; border-radius: 28px; border: none;
          background: rgba(255,255,255,0.05); color: white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.3s ease;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .arrow-btn:hover { background: rgba(255,255,255,0.1); transform: scale(1.1); border-color: rgba(255,255,255,0.2); }
        .arrow-btn.next { background: white; color: black; box-shadow: 0 10px 25px rgba(255,255,255,0.1); }
        .arrow-btn.next:hover { transform: scale(1.1) translateX(4px); box-shadow: 0 15px 35px rgba(255,255,255,0.2); }
        .arrow-btn.next.highlight { background: linear-gradient(135deg, #7c3aed, #db2777); color: white; }

        .login-final-btn {
          height: 60px; padding: 0 32px; border-radius: 30px; border: none;
          background: white; color: black; font-weight: 900; font-size: 1.1rem;
          display: flex; align-items: center; gap: 14px; cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 15px 40px rgba(255,255,255,0.1);
        }
        .login-final-btn:hover { transform: scale(1.05); box-shadow: 0 20px 50px rgba(255,255,255,0.2); }

        .pwa-action-container { display: flex; align-items: center; gap: 20px; }
        .btn-skip { background: none; border: none; color: rgba(255,255,255,0.4); font-weight: 700; cursor: pointer; font-size: 0.9rem; }
        .btn-skip:hover { color: white; }

        .fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

        @media (max-width: 480px) {
          .onboarding-card { padding: 32px 24px; min-height: 520px; }
          .slide-title { font-size: 1.8rem; }
        }

        /* Fast Track Header */
        .fast-track-header {
          position: fixed;
          top: 32px;
          right: 32px;
          z-index: 100;
        }
        .btn-signin-shortcut {
          padding: 10px 24px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03);
          color: white;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .btn-signin-shortcut:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
