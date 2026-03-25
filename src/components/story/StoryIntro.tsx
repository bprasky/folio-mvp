"use client";

// StoryIntro — Introduction panel for the story.
// Default: Two-column grid below the hero (landscape).
// Compact: Single-column stack beside the hero (portrait).

import type { StoryData } from "@/lib/story/buildRoomTiles";

interface StoryIntroProps {
  story: StoryData;
  compact?: boolean;
}

export function StoryIntro({ story, compact = false }: StoryIntroProps) {
  return (
    <section
      className={compact ? "pb-4" : "mt-[10px] pb-6 border-b"}
      style={compact ? undefined : { borderColor: "rgba(87, 75, 67, 0.06)" }}
    >
      <div className={compact
        ? "flex flex-col gap-4"
        : "grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 md:gap-10"
      }>
        {/* Title block: location, title, designer */}
        <div className="flex flex-col gap-3">
          {story.location && (
            <span
              className="text-[11px] uppercase tracking-[1.5px]"
              style={{
                fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                color: "rgba(87, 75, 67, 0.55)",
              }}
            >
              {story.location}
            </span>
          )}

          <h1
            className={compact
              ? "text-[28px] md:text-[36px] leading-[1.1] italic"
              : "text-[32px] md:text-[44px] leading-[1.1] italic"
            }
            style={{
              fontFamily: "var(--font-headline, 'Cormorant Garamond', serif)",
              fontWeight: 400,
              color: "rgba(87, 75, 67, 0.85)",
            }}
          >
            {story.title}
          </h1>

          {/* Designer + room count */}
          <div className="flex flex-col gap-1 mt-2">
            <div
              className="text-[11px]"
              style={{
                fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                color: "rgba(87, 75, 67, 0.55)",
              }}
            >
              {story.designerName}
            </div>
            <div
              className="text-[11px]"
              style={{
                fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                color: "rgba(87, 75, 67, 0.3)",
              }}
            >
              {story.roomCount} {story.roomCount === 1 ? "room" : "rooms"}
            </div>
          </div>
        </div>

        {/* Quote + intro text */}
        <div className="flex flex-col gap-4">
          {story.projectPullQuote && (
            <blockquote
              className={compact
                ? "text-[16px] md:text-[18px] italic leading-[1.5]"
                : "text-[18px] md:text-[20px] italic leading-[1.5]"
              }
              style={{
                fontFamily: "var(--font-headline, 'Cormorant Garamond', serif)",
                fontWeight: 400,
                color: "rgba(87, 75, 67, 0.85)",
              }}
            >
              &ldquo;{story.projectPullQuote}&rdquo;
              <footer
                className="mt-2 text-[12px] not-italic"
                style={{
                  fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                  color: "rgba(87, 75, 67, 0.55)",
                }}
              >
                &mdash; {story.designerName}
              </footer>
            </blockquote>
          )}

          {story.introText && (
            <p
              className={compact
                ? "text-[13px] leading-[1.65] whitespace-pre-line line-clamp-6"
                : "text-[14px] leading-[1.65] whitespace-pre-line"
              }
              style={{
                fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                color: "rgba(87, 75, 67, 0.85)",
              }}
            >
              {story.introText}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
