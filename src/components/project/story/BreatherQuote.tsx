"use client";

import { useEffect, useRef, useState } from "react";
import type { BreatherData } from "@/lib/editorial/buildRoomCards";

interface Props {
  breather: BreatherData;
}

export function BreatherQuote({ breather }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
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
  }, []);

  return (
    <div
      ref={ref}
      className={`py-12 md:py-16 px-6 max-w-3xl mx-auto text-center ${
        revealed ? "story-revealed" : ""
      }`}
    >
      {/* Top border */}
      <div className="border-t border-[rgba(87,75,67,0.12)] mb-10" />

      {/* Quote */}
      <blockquote className="story-breather-quote">
        <p className="font-[var(--font-headline)] italic text-[22px] md:text-[28px] leading-relaxed story-text-on-light">
          &ldquo;{breather.quote}&rdquo;
        </p>
      </blockquote>

      {/* Attribution */}
      {breather.attribution && (
        <p className="story-breather-attr mt-4 text-[13px] font-[var(--font-body)] story-text-secondary">
          — {breather.attribution}
        </p>
      )}

      {/* Bottom border */}
      <div className="border-t border-[rgba(87,75,67,0.12)] mt-10" />
    </div>
  );
}
