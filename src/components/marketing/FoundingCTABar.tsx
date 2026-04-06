'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const WELCOME_DISMISSED_KEY = 'folio_welcome_dismissed';
const CTA_BAR_DISMISSED_KEY = 'folio_cta_bar_dismissed';

export function FoundingCTABar() {
  const [showBar, setShowBar] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') return;
    if (status === 'loading') return;

    // Already dismissed by user this session
    if (sessionStorage.getItem(CTA_BAR_DISMISSED_KEY)) return;

    // If modal already dismissed, show bar immediately (with slight delay for smooth entrance)
    if (sessionStorage.getItem(WELCOME_DISMISSED_KEY)) {
      const timer = setTimeout(() => {
        setShowBar(true);
        requestAnimationFrame(() => setIsAnimating(true));
      }, 300);
      return () => clearTimeout(timer);
    }

    // Poll for modal dismiss (same-tab storage events don't fire)
    const interval = setInterval(() => {
      if (sessionStorage.getItem(WELCOME_DISMISSED_KEY)) {
        clearInterval(interval);
        // Delay so bar doesn't appear instantly as modal animates out
        setTimeout(() => {
          setShowBar(true);
          requestAnimationFrame(() => setIsAnimating(true));
        }, 600);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [status]);

  // Hide if user logs in while bar is visible
  useEffect(() => {
    if (status === 'authenticated' && showBar) {
      setIsAnimating(false);
      setTimeout(() => setShowBar(false), 300);
    }
  }, [status, showBar]);

  const handleDismiss = () => {
    sessionStorage.setItem(CTA_BAR_DISMISSED_KEY, 'true');
    setIsAnimating(false);
    setTimeout(() => setShowBar(false), 300);
  };

  if (!showBar) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 transition-all duration-300',
        isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      )}
    >
      <div
        className="bg-[var(--surface-ground)] border-t border-[rgba(190,175,155,0.12)] shadow-[0_-2px_8px_rgba(0,0,0,0.04)]"
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
          <p className="font-body text-sm text-[#1a1a1a]">
            Folio is accepting founding designers
          </p>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/signup"
              className="accent-btn px-6 py-2 text-sm whitespace-nowrap"
            >
              Apply to Join
            </Link>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-[#999] hover:text-[#666] transition-colors rounded"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
