"use client";

import { ChevronDown } from "lucide-react";
import { RoomThumbnailStrip } from "./RoomThumbnailStrip";
import type { StoryData } from "@/lib/editorial/buildRoomCards";
import { titleCase } from "@/lib/utils";

interface Props {
  storyData: StoryData;
  onScrollToRoom: (roomSlug: string) => void;
  activeRoomSlug?: string | null;
}

export function StoryHero({ storyData, onScrollToRoom, activeRoomSlug }: Props) {
  const { heroImage, title, projectPullQuote, designer, roomCount, topVendors, roomCards } =
    storyData;

  if (!heroImage) return null;

  const designerLabel = titleCase(designer?.studio ?? designer?.name ?? "Designer");

  return (
    <section className="relative min-h-screen flex flex-col justify-end overflow-hidden">
      {/* Full-bleed hero image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={heroImage.url}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Gradient overlay for text readability */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

      {/* Content overlay */}
      <div className="relative z-10 p-6 pb-8 md:p-10 md:pb-12 flex flex-col gap-5 max-w-4xl">
        {/* Title */}
        <h1 className="font-[var(--font-headline)] italic text-[28px] md:text-[40px] lg:text-[52px] leading-tight story-text-on-dark">
          {title}
        </h1>

        {/* Pull quote */}
        {projectPullQuote && (
          <div className="story-glass-quote px-5 py-4 max-w-xl">
            <p className="font-[var(--font-headline)] italic text-[18px] md:text-[22px] leading-relaxed story-text-on-dark">
              &ldquo;{projectPullQuote}&rdquo;
            </p>
            {designer?.name && (
              <p className="mt-2 text-[13px] font-[var(--font-body)] story-text-on-dark opacity-80">
                — {designer.name}
              </p>
            )}
          </div>
        )}

        {/* Credits bar */}
        <div className="story-glass-badge inline-flex items-center gap-2 self-start story-text-on-dark">
          <span className="font-medium">{designerLabel}</span>
          <span className="opacity-50">·</span>
          <span>{roomCount} room{roomCount !== 1 ? "s" : ""}</span>
          {topVendors.length > 0 && (
            <>
              <span className="opacity-50">·</span>
              <span className="truncate max-w-[200px]">{topVendors.join(" · ")}</span>
            </>
          )}
        </div>

        {/* Room thumbnail strip (desktop only) */}
        <RoomThumbnailStrip
          roomCards={roomCards}
          onScrollToRoom={onScrollToRoom}
          activeRoomSlug={activeRoomSlug}
        />
      </div>

      {/* Scroll indicator */}
      <div className="relative z-10 flex flex-col items-center pb-6 story-text-on-dark opacity-70">
        <span className="text-[13px] font-[var(--font-body)] tracking-wide uppercase mb-1">
          Explore Rooms
        </span>
        <ChevronDown className="w-5 h-5 story-bounce" />
      </div>
    </section>
  );
}
