'use client';

/**
 * Replay Demo Button
 * 
 * Shows a small "Replay Demo" button in the navigation for demo users
 * who have completed the demo tour. Only visible for demodesigner@folio.com.
 */

import { useDemoMode } from '@/contexts/DemoModeContext';
import { useSession } from 'next-auth/react';

export default function ReplayDemoButton() {
  const { enabled, active, startDemo } = useDemoMode();
  const { data: session } = useSession();

  // Only show for demo users, and only when demo is not currently active
  if (!enabled || active || !session?.user) {
    return null;
  }

  return (
    <button
      onClick={startDemo}
      className="px-3 py-1.5 text-xs font-medium text-folio-ink/60 hover:text-folio-ink hover:bg-folio-background/50 rounded transition-colors"
      title="Replay the Designer Demo tour"
    >
      Replay Demo
    </button>
  );
}




