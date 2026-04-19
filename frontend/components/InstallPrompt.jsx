'use client';

import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. REGISTER SERVICE WORKER
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(
                (registration) => console.log('[SW] Registered with scope:', registration.scope),
                (err) => console.error('[SW] Registration failed:', err)
            );
        });
    }

    // 2. CHECK IF ALREADY INSTALLED
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // 3. IOS DETECTION
    const ua = window.navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    setIsIOS(isiOS);

    if (isiOS) {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) setTimeout(() => setShowPrompt(true), 5000);
      return;
    }

    // 4. CAPTURE INSTALL PROMPT (Android/Chrome/Edge)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('[PWA] BeforeInstallPromptEvent captured');
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 5. GLOBAL TRIGGER (e.g. from Sidebar)
    const triggerHandler = () => {
        if (deferredPrompt) {
            handleInstall();
        } else {
            setShowPrompt(true);
        }
    };
    window.addEventListener('trigger-pwa-install', triggerHandler);

    return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        window.removeEventListener('trigger-pwa-install', triggerHandler);
    };
  }, [deferredPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
        console.log('[PWA] Manual install instructions');
        return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="install-overlay">
      <div className="install-card">
        <div className="install-icon">📲</div>
        <h3 className="install-title">Install ChatApp</h3>
        <p className="install-desc">
          {isIOS
            ? 'Tap the share button in Safari, then "Add to Home Screen" to install.'
            : 'Get the best experience on your heart or desktop — fast and native-feeling.'}
        </p>

        <div className="install-actions">
          {!isIOS && deferredPrompt && (
            <button className="install-btn primary" onClick={handleInstall}>Install Now</button>
          )}
          <button className="install-btn secondary" onClick={handleDismiss}>Not Now</button>
        </div>

        {(!isIOS && !deferredPrompt) && (
          <div className="manual-hint">
             💡 Look for the <strong>Install Icon</strong> in your browser address bar to add to PC.
          </div>
        )}
      </div>

      <style jsx>{`
        .install-overlay { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 10000; width: 92%; max-width: 420px; animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .install-card { background: #1a1926; border: 1px solid #2a293d; border-radius: 24px; padding: 28px; text-align: center; box-shadow: 0 15px 50px rgba(0,0,0,0.6); }
        .install-icon { font-size: 2.2rem; margin-bottom: 12px; }
        .install-title { font-size: 1.25rem; font-weight: 800; margin: 0 0 10px; color: white; }
        .install-desc { font-size: 0.9rem; color: #8888aa; margin-bottom: 24px; line-height: 1.5; }
        .install-actions { display: flex; gap: 14px; justify-content: center; }
        .install-btn { padding: 12px 24px; border-radius: 14px; font-weight: 700; cursor: pointer; border: none; font-size: 0.95rem; transition: all 0.2s; }
        .install-btn.primary { background: #7c6af7; color: white; box-shadow: 0 4px 15px rgba(124, 106, 247, 0.3); }
        .install-btn.primary:hover { transform: translateY(-2px); background: #8b5cf6; }
        .install-btn.secondary { background: #232231; color: #8888aa; }
        .manual-hint { margin-top: 18px; font-size: 0.8rem; color: #6b6a8a; background: rgba(0,0,0,0.25); padding: 10px; border-radius: 12px; font-style: italic; }
        @keyframes slideUp { from { transform: translate(-50%, 40px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}
