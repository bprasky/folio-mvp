"use client";

// QuoteTile — Room pull quote that doubles as the expand affordance.
// Collapsed: big italic pull quote in the headline font, no glass card,
// chevron-down underneath signals "click for the full narrative."
// Expanded: pull quote is replaced in place by the room's editorial
// narrative (the quote came from the narrative anyway, so nothing is lost).
// Layout-wise the tile stays in its own grid column so the photo column
// doesn't reflow.

import { useRef, useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";

interface QuoteTileProps {
  roomLabel: string;
  pullQuote: string | null;
  attribution: string;
  productCount: number;
  editorialTeaser?: string | null;
  editorialNarrative?: string | null;
  onClick: () => void;
  isExpanded: boolean;
  wide?: boolean;
  reducedMotion?: boolean;
}

export function QuoteTile({
  roomLabel,
  pullQuote,
  attribution,
  productCount,
  editorialTeaser,
  editorialNarrative,
  onClick,
  isExpanded,
  wide = false,
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

  const showNarrative = isExpanded && !!editorialNarrative;

  return (
    <div
      ref={ref}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={clsx(
        "cursor-pointer rounded-[12px] transition-colors duration-200 group",
        wide ? "flex flex-row items-center gap-8 px-8 py-5" : "flex flex-col justify-center px-2 py-6",
        "hover:bg-[rgba(87,75,67,0.03)]"
      )}
    >
      <div className={clsx(wide ? "flex-1 flex flex-col gap-2" : "flex flex-col gap-4")}>
        {/* Room label */}
        <span
          style={{
            fontSize: 'var(--type-fine)',
            fontWeight: 'var(--w-h1)',
            textTransform: "uppercase",
            letterSpacing: 'var(--ls-wide)',
            color: "rgba(87, 75, 67, 0.55)",
            ...stagger(0)
          }}
        >
          {roomLabel}
        </span>

        {/* Body — narrative when expanded, big pull quote when collapsed */}
        {showNarrative ? (
          <div
            className="whitespace-pre-line"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 'var(--type-body)',
              fontWeight: 'var(--w-body)',
              lineHeight: 1.7, /* folio-design-system: off-scale */
              color: "rgba(87, 75, 67, 0.85)",
              ...stagger(80),
            }}
          >
            {editorialNarrative}
          </div>
        ) : (
          pullQuote && (
            <blockquote
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: wide ? 'var(--type-h4)' : 'var(--type-h3)',
                fontWeight: 'var(--w-body)',
                fontStyle: "italic",
                lineHeight: 1.25, /* folio-design-system: off-scale */
                color: "rgba(87, 75, 67, 0.92)",
                ...stagger(80),
              }}
            >
              &ldquo;{pullQuote}&rdquo;
            </blockquote>
          )
        )}

        {/* Attribution */}
        <span
          style={{
            fontSize: 'var(--type-meta)',
            color: "rgba(87, 75, 67, 0.55)",
            ...stagger(160)
          }}
        >
          &mdash; {attribution}
        </span>

        {/* Editorial teaser (optional, only on collapsed regular tiles) */}
        {editorialTeaser && !wide && !showNarrative && (
          <p
            style={{
              fontSize: 'var(--type-meta)',
              lineHeight: 'var(--lh-body)',
              color: "rgba(87, 75, 67, 0.45)",
              ...stagger(240)
            }}
          >
            {editorialTeaser}
          </p>
        )}
      </div>

      {/* Affordance — chevron rotates 180° on expand, product count beside it */}
      <div
        className={clsx(
          wide ? "whitespace-nowrap flex items-center gap-3" : "mt-5 flex items-center gap-3"
        )}
        style={{
          fontSize: 'var(--type-meta)',
          color: "rgba(87, 75, 67, 0.55)",
          ...stagger(320)
        }}
      >
        {productCount > 0 && (
          <span style={{ fontSize: 'var(--type-eyebrow)', color: "rgba(87, 75, 67, 0.4)" }}>
            {productCount} product{productCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="flex items-center gap-1.5 group-hover:text-[rgba(87,75,67,0.85)] transition-colors">
          {isExpanded ? "Collapse" : "Read more"}
          <ChevronDown
            size={16}
            strokeWidth={1.75}
            className="transition-transform duration-300"
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </span>
      </div>
    </div>
  );
}
