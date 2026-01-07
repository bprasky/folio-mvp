/**
 * Festival Countdown Component
 * Displays time until festival start, live status, or post-event state
 * Brand-safe: warm neutrals, serif numerals, subtle styling
 */

'use client';

import { useCountdown } from '@/hooks/useFestivalVitality';

export interface FestivalCountdownProps {
  startISO?: string;
  endISO?: string;
  highlightsUrl?: string;
}

export function FestivalCountdown({
  startISO,
  endISO,
  highlightsUrl,
}: FestivalCountdownProps) {
  const { state, label, a11yLabel } = useCountdown(startISO, endISO);

  if (!startISO) return null;

  // Live state: Show "Happening now" chip
  if (state === 'live') {
    return (
      <div
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-stone-800 bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)]"
        role="status"
        aria-label="Happening now"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
        <span>Happening now</span>
      </div>
    );
  }

  // Post-event state: Show "Ended" with optional highlights link
  if (state === 'post') {
    if (highlightsUrl) {
      return (
        <a
          href={highlightsUrl}
          className="text-xs font-medium text-stone-700 underline underline-offset-2 hover:opacity-80 transition-opacity"
          aria-label="View event highlights"
        >
          Ended · See highlights
        </a>
      );
    }
    return (
      <span className="text-xs text-stone-600" aria-label="Event has ended">
        Ended
      </span>
    );
  }

  // Pre-event state: Show countdown
  return (
    <div className="inline-flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-stone-600 font-sans">
        Starts in
      </span>
      <span
        className="text-sm md:text-base tracking-wide font-serif text-stone-800"
        aria-live="polite"
        aria-label={a11yLabel}
        suppressHydrationWarning
      >
        {label}
      </span>
    </div>
  );
}

