'use client';

import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    setIsIOS(isiOS);

    // On iOS, show manual instructions
    if (isiOS) {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
      return;
    }

    // Android/Desktop: capture the install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 2000);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for manual triggers from the UI
    const manualTriggerHandler = () => setShowPrompt(true);
    window.addEventListener('trigger-pwa-install', manualTriggerHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('trigger-pwa-install', manualTriggerHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Register service worker on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('[SW] Registration failed:', err);
      });
    }
  }, []);

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="install-prompt-overlay">
      <div className="install-prompt-card">
        <div className="install-prompt-icon">📱</div>
        <h3 className="install-prompt-title">Install ChatApp</h3>
        <p className="install-prompt-desc">
          {isIOS
            ? 'Tap the share button in Safari, then "Add to Home Screen" to install ChatApp.'
            : 'Install ChatApp on your device for the best experience — fast, native-feeling, and always one tap away.'}
        </p>

          {!isIOS ? (
            <button className="install-btn primary" onClick={handleInstall}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {deferredPrompt ? 'Install App' : 'How to Install'}
            </button>
          ) : null}
          <button className="install-btn secondary" onClick={handleDismiss}>
            Not Now
          </button>
        </div>

        {!isIOS && !deferredPrompt && (
          <div className="manual-hint">
            <span className="hint-icon">💡</span> 
            Click the <strong>Install Icon</strong> in your browser's address bar to add ChatApp to your PC.
          </div>
        )}

        {isIOS && (
          <div className="ios-instructions">
            <div className="ios-step">
              <span className="ios-step-num">1</span>
              <span>Tap <strong>Share</strong> button <span style={{fontSize: '1.1em'}}>⬆️</span></span>
            </div>
            <div className="ios-step">
              <span className="ios-step-num">2</span>
              <span>Scroll and tap <strong>"Add to Home Screen"</strong></span>
            </div>
            <div className="ios-step">
              <span className="ios-step-num">3</span>
              <span>Tap <strong>"Add"</strong> to confirm</span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .install-prompt-overlay {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          width: calc(100% - 32px);
          max-width: 420px;
          animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(30px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .install-prompt-card {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border, #2a2a40);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          text-align: center;
        }
        .install-prompt-icon {
          font-size: 2.5rem;
          margin-bottom: 8px;
        }
        .install-prompt-title {
          font-size: 1.15rem;
          font-weight: 700;
          margin: 0 0 8px;
          color: var(--text-primary, #fff);
        }
        .install-prompt-desc {
          font-size: 0.85rem;
          color: var(--text-secondary, #999);
          line-height: 1.5;
          margin: 0 0 20px;
        }
        .install-prompt-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-bottom: 16px;
        }
        .manual-hint {
          background: rgba(124, 106, 247, 0.1);
          border: 1px dashed rgba(124, 106, 247, 0.3);
          border-radius: 12px;
          padding: 12px;
          font-size: 0.8rem;
          color: #8888aa;
          line-height: 1.4;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          text-align: left;
        }
        .hint-icon { font-size: 1.1rem; }

        .install-btn {
          padding: 10px 22px;
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .install-btn.primary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
        }
        .install-btn.primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        }
        .install-btn.secondary {
          background: var(--bg-secondary, #252540);
          color: var(--text-secondary, #999);
          border: 1px solid var(--border, #2a2a40);
        }
        .install-btn.secondary:hover {
          background: var(--bg-card, #1a1a2e);
          color: var(--text-primary, #fff);
        }
        .ios-instructions {
          margin-top: 16px;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ios-step {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.85rem;
          color: var(--text-secondary, #999);
        }
        .ios-step-num {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
