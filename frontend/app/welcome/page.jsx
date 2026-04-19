'use client';

import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="welcome-page">
      <div className="welcome-container">
        {/* Hero */}
        <div className="welcome-hero fade-in">
          <div className="welcome-icon">
            <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1>Anonymous Office Chat</h1>
          <p>Connect with your colleagues anonymously. Share thoughts freely in a secure, moderated environment.</p>
        </div>

        {/* Features */}
        <div className="welcome-features">
          {[
            { icon: '👤', title: 'Anonymous Identity', desc: 'Choose from 50 unique display names. Your real identity stays private.' },
            { icon: '⏱️', title: 'Auto-Delete Messages', desc: 'Messages automatically delete after 30 minutes for privacy.' },
            { icon: '🔒', title: 'Secure & Moderated', desc: 'Admins can moderate to maintain a respectful environment.' },
          ].map((f) => (
            <div key={f.title} className="welcome-feature-card card">
              <span className="welcome-feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="welcome-cta">
          <button className="btn btn-primary welcome-cta-btn" onClick={() => router.push('/login')}>
            Get Started
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <p className="text-muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
            Already have an account?{' '}
            <button onClick={() => router.push('/login')} className="text-accent" style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Sign In
            </button>
          </p>
        </div>
      </div>

      <style jsx>{`
        .welcome-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at top, rgba(124,106,247,0.15) 0%, transparent 60%), var(--bg-primary);
          padding: 24px;
        }
        .welcome-container { max-width: 900px; width: 100%; text-align: center; }
        .welcome-hero { margin-bottom: 48px; }
        .welcome-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 80px; height: 80px;
          background: linear-gradient(135deg, var(--accent), #a855f7);
          border-radius: 20px; margin-bottom: 24px;
          box-shadow: 0 8px 32px var(--accent-glow);
          color: white;
        }
        .welcome-hero h1 { font-size: 2.8rem; font-weight: 800; margin-bottom: 16px; background: linear-gradient(135deg, var(--text-primary), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .welcome-hero p { font-size: 1.1rem; color: var(--text-secondary); max-width: 560px; margin: 0 auto; line-height: 1.7; }
        .welcome-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 48px; }
        @media (max-width: 640px) { .welcome-features { grid-template-columns: 1fr; } .welcome-hero h1 { font-size: 2rem; } }
        .welcome-feature-card { padding: 28px 24px; text-align: left; transition: transform 0.2s, box-shadow 0.2s; }
        .welcome-feature-card:hover { transform: translateY(-4px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .welcome-feature-icon { font-size: 2rem; display: block; margin-bottom: 12px; }
        .welcome-feature-card h3 { font-size: 1rem; font-weight: 700; margin-bottom: 8px; }
        .welcome-feature-card p { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; }
        .welcome-cta-btn { padding: 14px 32px; font-size: 1rem; border-radius: 12px; }
      `}</style>
    </div>
  );
}
