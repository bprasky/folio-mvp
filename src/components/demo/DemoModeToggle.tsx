'use client';

/**
 * Demo Mode Toggle
 * 
 * Shows a toggle button (only for demodesigner@folio.com) to switch
 * between Demo Tour mode and Free Roam mode.
 */

import { useDemoMode } from '@/contexts/DemoModeContext';
import { useSession } from 'next-auth/react';

export default function DemoModeToggle() {
  const { enabled, active, freeExplore, startDemo, enableFreeExplore, endDemo } = useDemoMode();
  const { data: session, status } = useSession();

  // Debug: Log values to help diagnose
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[DemoModeToggle] Debug:', {
      enabled,
      active,
      freeExplore,
      sessionEmail: session?.user?.email,
      status,
      hasUser: !!session?.user
    });
  }

  // Only show for demo users - wait for session to load
  if (status === 'loading') {
    return null;
  }

  // Only show for demo users
  if (!enabled || !session?.user) {
    return null;
  }

  const handleToggle = () => {
    if (active) {
      // Currently in tour mode - switch to free roam
      enableFreeExplore();
    } else if (freeExplore) {
      // Currently in free roam - switch back to tour
      startDemo();
    } else {
      // Not in any mode - start tour
      startDemo();
    }
  };

  const getLabel = () => {
    if (active) return 'Tour Mode';
    if (freeExplore) return 'Free Roam';
    return 'Start Tour';
  };

  return (
    <button
      onClick={handleToggle}
      className={`w-full rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? 'bg-neutral-900/90 text-white hover:bg-neutral-900'
          : 'bg-white/50 text-[var(--text-primary)] hover:bg-white/70 border border-white/20'
      }`}
      title={active ? 'Switch to Free Roam mode' : freeExplore ? 'Switch back to Tour mode' : 'Start the Demo Tour'}
    >
      {getLabel()}
    </button>
  );
}

