'use client';

import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    setIsIOS(isiOS);

    if (isiOS) {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) setTimeout(() => setShowPrompt(true), 3000);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('[PWA] BeforeInstallPromptEvent captured');
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) setTimeout(() => setShowPrompt(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
        // Fallback for desktop if the prompt wasn't captured yet
        console.log('[PWA] Manual install fallback');
        return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="install-overlay">
      <div className="install-card">
        <div className="install-icon">🎁</div>
        <h3 className="install-title">Install ChatApp</h3>
        <p className="install-desc">
          {isIOS
            ? 'Tap the share button in Safari, then "Add to Home Screen" to install.'
            : 'Get the best experience on your desktop or mobile — fast and native-feeling.'}
        </p>

        <div className="install-actions">
          {!isIOS && (
            <button className="install-btn primary" onClick={handleInstall}>
              {deferredPrompt ? 'Install Now' : 'How to Install'}
            </button>
          )}
          <button className="install-btn secondary" onClick={handleDismiss}>Not Now</button>
        </div>

        {!isIOS && !deferredPrompt && (
          <div className="manual-hint">
             💡 Look for the <strong>Install Icon</strong> in your browser address bar to add to PC.
          </div>
        )}
      </div>

      <style jsx>{`
        .install-overlay { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 10000; width: 90%; max-width: 400px; animation: slideUp 0.3s ease; }
        .install-card { background: #1a1926; border: 1px solid #2a293d; border-radius: 20px; padding: 24px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
        .install-icon { font-size: 2rem; margin-bottom: 12px; }
        .install-title { font-size: 1.1rem; margin: 0 0 8px; color: white; }
        .install-desc { font-size: 0.85rem; color: #8888aa; margin-bottom: 20px; }
        .install-actions { display: flex; gap: 12px; justify-content: center; }
        .install-btn { padding: 10px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; border: none; }
        .install-btn.primary { background: #7c6af7; color: white; }
        .install-btn.secondary { background: #232231; color: #8888aa; }
        .manual-hint { margin-top: 15px; font-size: 0.8rem; color: #55556a; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 8px; }
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}
