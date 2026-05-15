// InviteRibbon — sticky-bottom invitation rail (Task 05)
//
// Logged-out only (parent gates with `isOut`). Persistent rail (not a modal).
// Dismissal lasts 24h via localStorage; next-day visitors see it again.
//
// Hydration: server has no access to localStorage, so initial render hides the
// ribbon (visibility: hidden) and reveals on mount only if the user hasn't
// dismissed it within the last 24h. Prevents the flicker of "ribbon appears
// then disappears" for users who just dismissed it.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISSAL_KEY = "folio_invite_ribbon_dismissed_until";
const DISMISSAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export function InviteRibbon() {
  // `null` = haven't checked yet (server + initial client render)
  // `true` = should display
  // `false` = dismissed within window
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISMISSAL_KEY);
      if (!raw) {
        setVisible(true);
        return;
      }
      const dismissedUntil = Number(raw);
      if (Number.isFinite(dismissedUntil) && Date.now() < dismissedUntil) {
        setVisible(false);
      } else {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — show ribbon.
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(
        DISMISSAL_KEY,
        String(Date.now() + DISMISSAL_WINDOW_MS),
      );
    } catch {
      /* swallow */
    }
    setVisible(false);
  };

  if (visible === false) return null;

  return (
    <div
      role="region"
      aria-label="Folio invitation"
      // Hidden on mobile (<sm) — FoundingCTABar covers the conversion ask
      // with a single, shorter CTA. Two stacked banners ate ~18% of the
      // viewport. Desktop retains both rails.
      className="hidden sm:block fixed bottom-0 inset-x-0 z-40"
      style={{
        // Hide on initial paint and during the first frame post-hydration.
        // `visible === null` covers SSR + first client render; once the effect
        // runs, the ribbon reveals (true) or unmounts (false).
        visibility: visible === true ? "visible" : "hidden",
        background: "var(--folio-ink)",
        color: "var(--folio-bg)",
        // iOS Safari home-indicator + bottom URL-bar safe area: extends the
        // ink background past the screen edge so the ribbon doesn't get
        // clipped under the system UI.
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        className={
          // Mobile: stack copy and CTAs vertically; CTAs row spans full
          // width, dismiss X is absolute-positioned so it doesn't push the
          // primary CTA off-screen.
          // Desktop (sm+): single row with copy left, CTAs right.
          "max-w-[1440px] mx-auto px-4 sm:px-10 py-3 sm:py-5 " +
          "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-6"
        }
      >
        <div className="pr-10 sm:pr-0">
          <p
            style={{
              fontFamily: "var(--font-headline)",
              fontStyle: "italic",
              fontSize: "var(--type-h4)",
              lineHeight: "var(--lh-h4)",
              fontWeight: "var(--w-h4)",
            }}
          >
            Folio is invitation-only for designers
          </p>
          <p
            className="folio-meta opacity-80 mt-0.5"
            style={{ color: "var(--folio-bg)" }}
          >
            Save work, follow studios, build your portfolio.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 sm:shrink-0">
          <Link
            href="/auth/signin"
            className="flex-1 sm:flex-initial text-center px-3 sm:px-4 py-2 rounded-full folio-ui border border-white/20 hover:bg-white/10 transition-colors whitespace-nowrap"
            style={{ color: "var(--folio-bg)" }}
          >
            I have an invite
          </Link>
          <Link
            href="/auth/signup"
            className="flex-1 sm:flex-initial text-center px-3 sm:px-4 py-2 rounded-full folio-ui transition-colors whitespace-nowrap"
            style={{
              background: "var(--folio-bg)",
              color: "var(--folio-ink)",
            }}
          >
            Request invite
          </Link>
        </div>

        {/* Dismiss X: top-right on mobile (absolute, out of the flex flow),
            inline on desktop. */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss for 24 hours"
          className="absolute top-3 right-3 sm:static sm:ml-1 w-8 h-8 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
          style={{ color: "var(--folio-bg)" }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
