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
              className="text-[var(--type-eyebrow)] uppercase tracking-[1.5px]" /* folio-design-system: off-scale */
              style={{
                color: "rgba(87, 75, 67, 0.55)"
              }}
            >
              {story.location}
            </span>
          )}

          <h1
            className={compact
              ? "text-[var(--type-h3)] md:text-[var(--type-h2)] leading-[var(--lh-h1)] italic"
              : "text-[var(--type-stat)] md:text-[var(--type-h1)] leading-[var(--lh-h1)] italic"
            }
            style={{
              fontFamily: "var(--font-headline)",
              fontWeight: 'var(--w-body)',
              color: "rgba(87, 75, 67, 0.85)",
            }}
          >
            {story.title}
          </h1>

          {/* Designer + room count */}
          <div className="flex flex-col gap-1 mt-2">
            <div
              className="text-[var(--type-eyebrow)]"
              style={{
                color: "rgba(87, 75, 67, 0.55)"
              }}
            >
              {story.designerName}
            </div>
            <div
              className="text-[var(--type-eyebrow)]"
              style={{
                color: "rgba(87, 75, 67, 0.3)"
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
                ? "text-[var(--type-body)] md:text-[var(--type-h4)] italic leading-[var(--lh-body)]"
                : "text-[var(--type-h4)] md:text-[var(--type-h4)] italic leading-[var(--lh-body)]"
              }
              style={{
                fontFamily: "var(--font-headline)",
                fontWeight: 'var(--w-body)',
                color: "rgba(87, 75, 67, 0.85)",
              }}
            >
              &ldquo;{story.projectPullQuote}&rdquo;
              <footer
                className="mt-2 text-[var(--type-meta)] not-italic"
                style={{
                  color: "rgba(87, 75, 67, 0.55)"
                }}
              >
                &mdash; {story.designerName}
              </footer>
            </blockquote>
          )}

          {story.introText && (
            <p
              className={compact
                ? "text-[var(--type-meta)] leading-[1.65] whitespace-pre-line line-clamp-6" /* folio-design-system: off-scale */
                : "text-[var(--type-ui)] leading-[1.65] whitespace-pre-line" /* folio-design-system: off-scale */
              }
              style={{
                color: "rgba(87, 75, 67, 0.85)"
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
