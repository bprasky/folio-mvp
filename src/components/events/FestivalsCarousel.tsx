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
  const [cardWidth, setCardWidth] = useState(880);
  const GAP = 16;

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
      const calculatedWidth = vw < 768 ? vw * 0.85 : vw < 1024 ? 640 : 880;
      setCardWidth(calculatedWidth);
    };
    
    updateCardWidth();
    window.addEventListener('resize', updateCardWidth);
    return () => window.removeEventListener('resize', updateCardWidth);
  }, []);

  useEffect(() => {
    const vw = window.innerWidth;
    const PEEK = Math.round(vw * 0.10); // matches pl-[10%]
    const centerOffset = (vw - cardWidth) / 2;
    const shift = nextIdx * (cardWidth + GAP) - (centerOffset - PEEK);
    setX(-Math.max(0, shift));
  }, [nextIdx, cardWidth, GAP]);

  const nudge = (dir: 1 | -1) => setX((prev) => prev + dir * -(cardWidth + GAP));

  if (!festivals.length) {
    return (
      <section aria-label="Festival timeline" className="relative w-screen">
        <div className="h-[340px] bg-surface-ground rounded-2xl flex items-center justify-center">
          <p className="text-folio-text-secondary">No festivals available</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-screen mx-[calc(50%-50vw)]">
      <div className="relative">
        <motion.div
          className="flex gap-4 pl-[10%] pr-8 items-stretch"
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
            className="pointer-events-auto rounded-full bg-white/70 hover:bg-surface-elevated px-4 py-3 ml-4 shadow-sm backdrop-blur-sm transition-colors z-30 text-[rgb(30,30,30)]"
            onClick={() => nudge(-1)}
            aria-label="Previous festival"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.56 9.5l3.22 3.22a.75.75 0 1 1-1.06 1.06l-3.75-3.75a.75.75 0 0 1 0-1.06l3.75-3.75a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>
          </button>
          <button
            className="pointer-events-auto rounded-full bg-white/70 hover:bg-surface-elevated px-4 py-3 mr-4 shadow-sm backdrop-blur-sm transition-colors z-30 text-[rgb(30,30,30)]"
            onClick={() => nudge(1)}
            aria-label="Next festival"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l3.75 3.75a.75.75 0 0 1 0 1.06l-3.75 3.75a.75.75 0 1 1-1.06-1.06L11.44 9.5 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
          </button>
        </div>
      </div>
    </section>
  );
}

