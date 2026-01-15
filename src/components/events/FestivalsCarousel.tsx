"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import FestivalCard from "./FestivalCard";

type Festival = {
  id: string;
  title: string;
  location: string | null;
  startDate: Date | string;
  endDate: Date | string;
  imageUrl: string | null;
  slug?: string;
};

type FestivalsCarouselProps = {
  festivals: Festival[];
};

export default function FestivalsCarousel({ festivals }: FestivalsCarouselProps) {
  const [x, setX] = useState(0);
  const [cardWidth, setCardWidth] = useState(720);
  const GAP = 24;

  const now = new Date();
  const nextIdx = useMemo(() => {
    const upcoming = festivals.findIndex(
      (f) => new Date(f.startDate).getTime() > now.getTime()
    );
    return upcoming !== -1 ? upcoming : festivals.length - 1;
  }, [festivals]);

  useEffect(() => {
    // Calculate card width based on viewport
    const updateCardWidth = () => {
      const vw = window.innerWidth;
      // Responsive card width: smaller on mobile
      const calculatedWidth = vw < 768 ? vw * 0.85 : vw < 1024 ? 600 : 720;
      setCardWidth(calculatedWidth);
    };
    
    updateCardWidth();
    window.addEventListener('resize', updateCardWidth);
    return () => window.removeEventListener('resize', updateCardWidth);
  }, []);

  useEffect(() => {
    const vw = window.innerWidth;
    const PEEK = Math.round(cardWidth * 0.25);
    const centerOffset = (vw - cardWidth) / 2;
    const shift = nextIdx * (cardWidth + GAP) - (centerOffset - PEEK);
    setX(-Math.max(0, shift));
  }, [nextIdx, cardWidth, GAP]);

  const nudge = (dir: 1 | -1) => setX((prev) => prev + dir * -(cardWidth + GAP));

  if (!festivals.length) {
    return (
      <section aria-label="Festival timeline" className="relative w-screen">
        <div className="h-[340px] bg-[var(--bg-elevated)] rounded-2xl flex items-center justify-center">
          <p className="text-[var(--text-secondary)]">No festivals available</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-screen mx-[calc(50%-50vw)]">
      <div className="relative">
        <motion.div
          className="flex gap-6 pl-[25%] pr-8 items-stretch"
          animate={{ x }}
          transition={{ type: "tween", ease: "easeOut", duration: 0.6 }}
        >
          {festivals.map((f, i) => {
            const isPast = new Date(f.endDate) < now;
            return (
              <div
                key={f.id}
                style={{ width: `${cardWidth}px`, flexShrink: 0 }}
              >
                <FestivalCard
                  festival={f}
                  isPast={isPast}
                  isNext={i === nextIdx}
                />
              </div>
            );
          })}
        </motion.div>

        {/* Arrows */}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between">
          <button
            className="pointer-events-auto rounded-full bg-[var(--bg-base)]/70 hover:bg-[var(--bg-base)] px-3 py-2 m-2 shadow-md transition-colors z-30"
            onClick={() => nudge(-1)}
            aria-label="Previous festival"
          >
            ‹
          </button>
          <button
            className="pointer-events-auto rounded-full bg-[var(--bg-base)]/70 hover:bg-[var(--bg-base)] px-3 py-2 m-2 shadow-md transition-colors z-30"
            onClick={() => nudge(1)}
            aria-label="Next festival"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}

