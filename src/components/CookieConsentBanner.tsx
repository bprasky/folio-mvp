'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const COOKIE_CONSENT_KEY = 'folio_cookie_consent';

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const hasConsented = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!hasConsented) {
      // Small delay before showing banner for smoother UX
      const timer = setTimeout(() => {
        setIsVisible(true);
        setIsAnimating(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString());
    setIsAnimating(false);
    // Wait for animation to complete before hiding
    setTimeout(() => setIsVisible(false), 300);
  };

  const handleDismiss = () => {
    // Just hide without storing consent - will show again on next visit
    setIsAnimating(false);
    setTimeout(() => setIsVisible(false), 300);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 p-4 transition-all duration-300',
        isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      )}
    >
      <div className="max-w-4xl mx-auto">
        <div className="ridge-card p-4 sm:p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Text Content */}
            <div className="flex-1">
              <p className="text-sm text-folio-text-secondary">
                We use essential cookies to make Folio work. By continuing to use this site, you agree to our use of cookies.{' '}
                <Link
                  href="/cookies"
                  className="text-[var(--accent)] hover:text-[var(--accent-hover)] underline underline-offset-2"
                >
                  Learn more
                </Link>
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={handleAccept}
                className="accent-btn px-5 py-2 text-sm font-medium rounded-lg transition-colors"
              >
                Accept
              </button>
              <button
                onClick={handleDismiss}
                className="p-2 text-folio-text-tertiary hover:text-folio-text-primary transition-colors rounded-lg hover:bg-surface-ground"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
