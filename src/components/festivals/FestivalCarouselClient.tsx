"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from '@/components/FolioImage';

type Festival = {
  id: string;
  title: string;
  slug: string;
  location: string | null;
  startDate: Date | string;
  endDate: Date | string;
  imageUrl: string | null;
};

export default function FestivalCarouselClient({
  festivals,
  initialIndex,
}: {
  festivals: Festival[];
  initialIndex: number;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), Math.max(festivals.length - 1, 0)));
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Ensure refs length matches data length
  cardRefs.current = useMemo(
    () => new Array(festivals.length).fill(null),
    [festivals.length]
  );

  // Scroll to the initial card on mount
  useEffect(() => {
    scrollToIndex(index, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollToIndex(i: number, smooth = true) {
    const node = cardRefs.current[i];
    if (node && scrollerRef.current) {
      node.scrollIntoView({ inline: "center", behavior: smooth ? "smooth" : "auto", block: "nearest" });
    }
  }

  function go(delta: number) {
    const next = Math.min(Math.max(index + delta, 0), festivals.length - 1);
    setIndex(next);
    scrollToIndex(next);
  }

  function fmtRange(s: Date | string, e: Date | string) {
    const sd = new Date(s);
    const ed = new Date(e);
    const sameMonth = sd.getUTCFullYear() === ed.getUTCFullYear() && sd.getUTCMonth() === ed.getUTCMonth();
    const mo = sd.toLocaleString(undefined, { month: "short" });
    const mo2 = ed.toLocaleString(undefined, { month: "short" });
    const d1 = sd.getUTCDate();
    const d2 = ed.getUTCDate();
    const y1 = sd.getUTCFullYear();
    const y2 = ed.getUTCFullYear();
    return sameMonth
      ? `${mo} ${d1}–${d2}, ${y1}`
      : `${mo} ${d1}, ${y1} – ${mo2} ${d2}, ${y2}`;
  }

  if (!festivals.length) return null;

  return (
    <div className="relative">
      {/* Arrows */}
      <button
        aria-label="Previous festival"
        onClick={() => go(-1)}
        disabled={index === 0}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/50 hover:bg-black/70 text-white px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ←
      </button>
      <button
        aria-label="Next festival"
        onClick={() => go(1)}
        disabled={index === festivals.length - 1}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/50 hover:bg-black/70 text-white px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        →
      </button>

      {/* Constrained scroller:
         - max-h keeps entire carousel compact
         - px-[12.5%] preserves ~25% left peek (with 50–60% card widths)
      */}
      <div
        ref={scrollerRef}
        className="flex overflow-x-auto no-scrollbar scroll-smooth scroll-px-[12.5%] px-[12.5%] gap-5 md:gap-6 py-4"
        style={{
          scrollSnapType: "x mandatory",
          maxHeight: 420, // desktop cap
        }}
        onScroll={() => {
          // Optionally: update index on manual scroll (center detection)
          // We keep arrow-centric UX; omit for simplicity.
        }}
      >
        {festivals.map((f, i) => {
          const active = i === index;
          return (
            <motion.div
              key={f.id}
              ref={(el) => (cardRefs.current[i] = el)}
              style={{ scrollSnapAlign: "center" }}
              animate={{ scale: active ? 1.0 : 0.97, opacity: active ? 1 : 0.9 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="w-[80%] sm:w-[70%] md:w-[60%] lg:w-[55%] xl:w-[50%] shrink-0 cursor-pointer"
              onClick={() => {
                router.push(`/festivals/${f.slug ?? String(f.id)}`);
              }}
            >
              <article className="rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5 bg-surface-canvas hover:shadow-md transition-shadow">
                {/* Wider aspect lowers visual height */}
                <div className="aspect-[21/9] overflow-hidden bg-surface-ground relative">
                  {f.imageUrl ? (
                    <Image
                      alt={f.title}
                      src={f.imageUrl}
                      fill
                      className="object-cover"
                      loading={i === 0 ? "eager" : "lazy"}
                      sizes="(max-width: 640px) 80vw, (max-width: 768px) 70vw, (max-width: 1024px) 60vw, 55vw"
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-sm text-folio-text-tertiary">No image</div>
                  )}
                </div>

                {/* Tight text block to save vertical space */}
                <div className="p-3 md:p-4">
                  <h3 className="text-base md:text-lg font-semibold tracking-tight line-clamp-1">{f.title}</h3>
                  <p className="text-xs md:text-sm text-folio-text-secondary line-clamp-1 mt-0.5">{f.location ?? ""}</p>
                  <p className="mt-0.5 text-xs text-folio-text-tertiary">{fmtRange(f.startDate, f.endDate)}</p>
                </div>
              </article>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

