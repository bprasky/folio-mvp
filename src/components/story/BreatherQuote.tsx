"use client";

// BreatherQuote — Full-width centered pull quote interstitial (Pattern 5).
// Theatrical entrance animation on scroll. No photo, no glass.
// Used to shift perspective between rooms.

import { useRef, useEffect, useState } from "react";

interface BreatherQuoteProps {
  quote: string;
  attribution: string;
  reducedMotion: boolean;
}

export function BreatherQuote({
  quote,
  attribution,
  reducedMotion,
}: BreatherQuoteProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      className="col-span-2 py-12 md:py-16 text-center"
      style={{
        borderTop: "1px solid rgba(87, 75, 67, 0.06)",
        borderBottom: "1px solid rgba(87, 75, 67, 0.06)",
        opacity: reducedMotion ? 1 : revealed ? 1 : 0,
        transition: reducedMotion ? undefined : "opacity 200ms ease",
      }}
    >
      <blockquote
        className="mx-auto max-w-[600px] px-6"
        style={{
          fontFamily: "var(--font-headline)",
          fontSize: "clamp(22px, 3vw, 26px)",
          fontStyle: "italic",
          fontWeight: 'var(--w-body)',
          lineHeight: 1.45, /* folio-design-system: off-scale */
          color: "rgba(87, 75, 67, 0.55)",
          transform: reducedMotion
            ? undefined
            : revealed
            ? "translateY(0)"
            : "translateY(24px)",
          opacity: revealed ? 1 : 0,
          transition: reducedMotion
            ? undefined
            : "opacity 700ms ease, transform 700ms ease",
        }}
      >
        &ldquo;{quote}&rdquo;
      </blockquote>
      <footer
        className="mt-4"
        style={{
          fontSize: 'var(--type-meta)',
          color: "rgba(87, 75, 67, 0.35)",
          opacity: revealed ? 1 : 0,
          transition: reducedMotion
            ? undefined
            : "opacity 500ms ease 300ms"
        }}
      >
        &mdash; {attribution}
      </footer>
    </div>
  );
}
