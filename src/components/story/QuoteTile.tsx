"use client";

// QuoteTile — Frosted glass surface with room label, pull quote, attribution,
// product count + expand hint. Staggered reveal animation on scroll.
// Rule 2: Glass Lives Beside, Never Over.

import { useRef, useEffect, useState } from "react";
import clsx from "clsx";

interface QuoteTileProps {
  roomLabel: string;
  pullQuote: string | null;
  attribution: string;
  productCount: number;
  editorialTeaser?: string | null;
  onClick: () => void;
  isExpanded: boolean;
  wide?: boolean;
  /** "default" = glass-surface, "light" = glass-surface-sm (secondary/teaser tiles) */
  variant?: "default" | "light";
  reducedMotion?: boolean;
}

export function QuoteTile({
  roomLabel,
  pullQuote,
  attribution,
  productCount,
  editorialTeaser,
  onClick,
  isExpanded,
  wide = false,
  variant = "default",
  reducedMotion = false,
}: QuoteTileProps) {
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
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const stagger = (delayMs: number) =>
    reducedMotion
      ? {}
      : {
          transition: `opacity 400ms ease ${delayMs}ms, transform 400ms ease ${delayMs}ms`,
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0)" : `translateY(12px)`,
        };

  return (
    <div
      ref={ref}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={clsx(
        variant === "light" ? "glass-surface-sm" : "glass-surface",
        "cursor-pointer transition-all duration-200",
        wide ? "flex flex-row items-center gap-8 px-8 py-5" : "flex flex-col justify-center px-7 py-6",
        isExpanded
          ? "ring-1 ring-[rgba(87,75,67,0.12)]"
          : "hover:ring-1 hover:ring-[rgba(87,75,67,0.09)]"
      )}
      style={{
        ...(isExpanded ? { background: "var(--glass-bg-hover)" } : {}),
        minHeight: wide ? undefined : 300,
      }}
    >
      <div className={clsx(wide ? "flex-1 flex flex-col gap-2" : "flex flex-col gap-3")}>
        {/* Room label */}
        <span
          style={{
            fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
            fontSize: "10px",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: "rgba(87, 75, 67, 0.55)",
            ...stagger(0),
          }}
        >
          {roomLabel}
        </span>

        {/* Pull quote */}
        {pullQuote && (
          <blockquote
            style={{
              fontFamily: "var(--font-headline, 'Cormorant Garamond', serif)",
              fontSize: wide ? "17px" : "19px",
              fontWeight: 400,
              fontStyle: "italic",
              lineHeight: 1.45,
              color: "rgba(87, 75, 67, 0.85)",
              ...stagger(80),
            }}
          >
            &ldquo;{pullQuote}&rdquo;
          </blockquote>
        )}

        {/* Attribution */}
        <span
          style={{
            fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
            fontSize: "12px",
            color: "rgba(87, 75, 67, 0.55)",
            ...stagger(160),
          }}
        >
          &mdash; {attribution}
        </span>

        {/* Editorial teaser (optional) */}
        {editorialTeaser && !wide && (
          <p
            style={{
              fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
              fontSize: "13px",
              lineHeight: 1.6,
              color: "rgba(87, 75, 67, 0.45)",
              ...stagger(240),
            }}
          >
            {editorialTeaser}
          </p>
        )}
      </div>

      {/* Product count + expand hint */}
      <span
        className={clsx(wide ? "whitespace-nowrap" : "mt-auto pt-3")}
        style={{
          fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
          fontSize: "11px",
          color: "rgba(87, 75, 67, 0.3)",
          ...stagger(320),
        }}
      >
        {productCount > 0 && `${productCount} product${productCount !== 1 ? "s" : ""} · `}
        {isExpanded ? "Collapse ↑" : "Expand →"}
      </span>
    </div>
  );
}
