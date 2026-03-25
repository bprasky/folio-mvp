"use client";

// StoryIntro — Two-column introduction panel below the hero.
// Left: location, title, credits. Right: pull quote, intro text.
// Mobile: stacks to single column.

import type { StoryData } from "@/lib/story/buildRoomTiles";

interface StoryIntroProps {
  story: StoryData;
}

export function StoryIntro({ story }: StoryIntroProps) {
  return (
    <section
      className="mt-[10px] pb-6 border-b"
      style={{ borderColor: "rgba(87, 75, 67, 0.06)" }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 md:gap-10">
        {/* Left column: Title, location, credits */}
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
            className="text-[32px] md:text-[44px] leading-[1.1] italic"
            style={{
              fontFamily: "var(--font-headline, 'Cormorant Garamond', serif)",
              fontWeight: 400,
              color: "rgba(87, 75, 67, 0.85)",
            }}
          >
            {story.title}
          </h1>

          {/* Credits */}
          <div className="flex flex-col gap-1 mt-2">
            {story.credits.slice(0, 4).map((credit, i) => (
              <div
                key={i}
                className="text-[11px]"
                style={{
                  fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                  color: "rgba(87, 75, 67, 0.55)",
                }}
              >
                <span className="uppercase tracking-[1px]">{credit.role}</span>
                {": "}
                {credit.url ? (
                  <a
                    href={credit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: "rgba(87, 75, 67, 0.7)" }}
                  >
                    {credit.name}
                  </a>
                ) : (
                  <span style={{ color: "rgba(87, 75, 67, 0.7)" }}>{credit.name}</span>
                )}
              </div>
            ))}
            <div
              className="text-[11px] mt-1"
              style={{
                fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                color: "rgba(87, 75, 67, 0.3)",
              }}
            >
              {story.roomCount} {story.roomCount === 1 ? "room" : "rooms"}
            </div>
          </div>
        </div>

        {/* Right column: Pull quote + intro text */}
        <div className="flex flex-col gap-4">
          {story.projectPullQuote && (
            <blockquote
              className="text-[18px] md:text-[20px] italic leading-[1.5]"
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
              className="text-[14px] leading-[1.65] whitespace-pre-line"
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
