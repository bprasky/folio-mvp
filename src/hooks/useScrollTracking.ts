'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ScrollTrackingOptions {
  /** Debounce interval for scroll updates in ms */
  debounceMs?: number;
  /** Interval for time-on-page updates in ms */
  timeUpdateIntervalMs?: number;
}

/**
 * Hook to track scroll depth, visible sections, and time on page
 * for vendor presentation analytics.
 *
 * Usage:
 * ```tsx
 * const { viewToken, sectionRef } = useScrollTracking(orgId, 'rep');
 * <div ref={sectionRef('hook')}>...</div>
 * ```
 */
export function useScrollTracking(
  organizationId: string | null,
  presentationType: 'rep' | 'admin',
  options: ScrollTrackingOptions = {}
) {
  const { debounceMs = 2000, timeUpdateIntervalMs = 30000 } = options;

  const [viewToken, setViewToken] = useState<string | null>(null);
  const sectionsViewed = useRef<Set<string>>(new Set());
  const maxDepth = useRef(0);
  const startTime = useRef(Date.now());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize: create presentation view record
  useEffect(() => {
    if (!organizationId) return;

    fetch('/api/vendor/presentation-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'view',
        organizationId,
        presentationType,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.viewToken) {
          setViewToken(data.viewToken);
        }
      })
      .catch(console.error);
  }, [organizationId, presentationType]);

  // Track time on page at intervals
  useEffect(() => {
    if (!viewToken) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      fetch('/api/vendor/presentation-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'time',
          viewToken,
          timeMs: elapsed,
        }),
      }).catch(console.error);
    }, timeUpdateIntervalMs);

    return () => clearInterval(interval);
  }, [viewToken, timeUpdateIntervalMs]);

  // Send final time on page when leaving
  useEffect(() => {
    if (!viewToken) return;

    const handleBeforeUnload = () => {
      const elapsed = Date.now() - startTime.current;
      // Use sendBeacon for reliability on page exit
      navigator.sendBeacon(
        '/api/vendor/presentation-analytics',
        JSON.stringify({
          action: 'time',
          viewToken,
          timeMs: elapsed,
        })
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [viewToken]);

  // Debounced scroll depth update
  const sendScrollUpdate = useCallback(() => {
    if (!viewToken) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetch('/api/vendor/presentation-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scroll',
          viewToken,
          depth: maxDepth.current,
          sectionsViewed: Array.from(sectionsViewed.current),
        }),
      }).catch(console.error);
    }, debounceMs);
  }, [viewToken, debounceMs]);

  // Track scroll depth on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const depth = Math.min(window.scrollY / scrollHeight, 1);
        if (depth > maxDepth.current) {
          maxDepth.current = depth;
          sendScrollUpdate();
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sendScrollUpdate]);

  /**
   * Create a ref callback for a section element.
   * Uses IntersectionObserver to track when sections become visible.
   */
  const sectionRef = useCallback(
    (sectionId: string) => {
      return (element: HTMLElement | null) => {
        if (!element) return;

        const observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                sectionsViewed.current.add(sectionId);
                sendScrollUpdate();
                observer.unobserve(entry.target);
              }
            }
          },
          { threshold: 0.3 }
        );

        observer.observe(element);
      };
    },
    [sendScrollUpdate]
  );

  /**
   * Track a CTA click.
   */
  const trackCTA = useCallback(
    (ctaId: string) => {
      if (!viewToken) return;

      fetch('/api/vendor/presentation-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cta',
          viewToken,
          ctaId,
        }),
      }).catch(console.error);
    },
    [viewToken]
  );

  return {
    viewToken,
    sectionRef,
    trackCTA,
  };
}
