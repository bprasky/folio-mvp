'use client';

import { useEffect, useState } from 'react';
import { flags } from '@/lib/flags';

/**
 * Single source of truth for AI access across all vendor dashboard components
 * Returns true when AI is unlocked (via flag, demo mode, or URL param)
 */
export function useAIUnlocked() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkUnlocked = () => {
      const params = new URLSearchParams(window.location.search);
      const demoParam = params.get('demo') === '1';
      const isUnlocked = flags.vendorAIInsights || demoParam || flags.vendorDemoData;
      setUnlocked(isUnlocked);
    };

    // Check on mount
    checkUnlocked();

    // Listen for URL changes (when demo toggle updates)
    const handlePopState = () => checkUnlocked();
    window.addEventListener('popstate', handlePopState);

    // Listen for demo state updates
    const handleDemoUpdate = () => checkUnlocked();
    window.addEventListener('demo-state-updated', handleDemoUpdate);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('demo-state-updated', handleDemoUpdate);
    };
  }, []);

  return unlocked;
}


