'use client';

import { useTheme } from '@/context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '☀️' : '🌙'}

      <style jsx>{`
        .theme-toggle {
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 8px;
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 1rem;
          transition: background 0.2s, border-color 0.2s, transform 0.2s;
        }
        .theme-toggle:hover {
          border-color: var(--accent);
          transform: scale(1.05);
        }
      `}</style>
    </button>
  );
}
