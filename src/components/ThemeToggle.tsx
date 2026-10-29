'use client';

import { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';
import { applyTheme, THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    setReady(true);

    const syncTheme = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const nextTheme = event.newValue === 'dark' ? 'dark' : 'light';
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    setTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Switching still works for this visit when browser storage is blocked.
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-elevated p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-ground text-folio-text-secondary">
        <Moon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p id="dark-mode-label" className="text-sm font-medium text-folio-text-primary">Dark mode</p>
        <p id="dark-mode-description" className="text-xs text-folio-text-secondary">Saved in this browser.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={theme === 'dark'}
        aria-labelledby="dark-mode-label"
        aria-describedby="dark-mode-description"
        disabled={!ready}
        onClick={toggleTheme}
        className="flex h-11 w-12 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--folio-text-primary)] disabled:opacity-50"
      >
        <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${theme === 'dark' ? 'bg-folio-text-primary' : 'bg-folio-text-secondary'}`}>
          <span className={`h-5 w-5 rounded-full bg-surface-canvas shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
        </span>
      </button>
    </div>
  );
}
