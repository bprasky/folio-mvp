"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { featureFlags } from "@/lib/featureFlags";
import { FestivalCountdown } from "@/components/events/FestivalCountdown";
import { RSVPPresence } from "@/components/events/RSVPPresence";
import { FriendsGoing } from "@/components/events/FriendsGoing";
import { useVitalityData } from "@/hooks/useFestivalVitality";

type Festival = {
  id: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  heroImageUrl: string;
  editorialSlug?: string;
  rsvpUrl?: string;
  addToCalendarUrl?: string;
};

export default function FestivalCarousel({ events }: { events: Festival[] }) {
  const today = new Date();
  const sorted = useMemo(
    () => [...events].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate)),
    [events]
  );

  const activeIndex = useMemo(() => {
    if (!sorted.length) return 0;
    let idx = sorted.findIndex(e => new Date(e.startDate) >= today);
    if (idx === -1) idx = sorted.length - 1;
    return idx;
  }, [sorted, today]);

  const [index, setIndex] = useState(activeIndex);
  useEffect(() => setIndex(activeIndex), [activeIndex]);

  const prev = sorted[index - 1];
  const curr = sorted[index];
  const next = sorted[index + 1];

  const isPast = (e: Festival) => new Date(e.endDate) < today;
  const isUpcoming = (e: Festival) => new Date(e.startDate) > today;

  if (!sorted.length) {
    return (
      <section aria-label="Design Festivals" className="relative">
        <h1 className="mb-4 font-serif text-2xl sm:text-[28px] text-folio-text-primary tracking-tight">Design Festivals</h1>
        <div className="relative h-[240px] sm:h-[300px] lg:h-[340px] rounded-2xl bg-surface-ground flex items-center justify-center">
          <p className="text-folio-text-secondary">No festivals available</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Design Festivals" className="relative">
      <h1 className="mb-4 font-serif text-2xl sm:text-[28px] text-folio-text-primary tracking-tight">Design Festivals</h1>

      <div className="relative h-[240px] sm:h-[300px] lg:h-[340px]">
        <div className="relative h-full w-full overflow-hidden rounded-2xl">
          {prev && (
            <PeekCard
              festival={prev}
              side="left"
              muted
              ctaLabel={isPast(prev) ? "View editorial" : undefined}
              href={isPast(prev) && prev.editorialSlug ? `/editorial/${prev.editorialSlug}` : undefined}
              onClick={() => setIndex(index - 1)}
            />
          )}

          {curr && (
            <MainCard
              festival={curr}
              isPast={isPast(curr)}
              isUpcoming={isUpcoming(curr)}
              // Entire card links to the festival page
              href={`/festivals/${curr.id}`}
            />
          )}

          {next && (
            <PeekCard
              festival={next}
              side="right"
              ctaLabel={isUpcoming(next) ? "Add to calendar" : undefined}
              href={isUpcoming(next) ? next.addToCalendarUrl || next.rsvpUrl || `/festivals/${next.id}` : undefined}
              onClick={() => setIndex(index + 1)}
            />
          )}
        </div>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {sorted.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to festival ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn("h-1.5 w-6 rounded-full transition-all", i === index ? "bg-[var(--text-primary)]/70" : "bg-[var(--text-tertiary)]/40")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function MainCard({
  festival,
  isPast,
  isUpcoming,
  href,
}: {
  festival: Festival;
  isPast: boolean;
  isUpcoming: boolean;
  href: string;
}) {
  const vitalityEnabled = featureFlags.festivalVitalityUI;
  const { rsvp, friends } = useVitalityData(festival.id, vitalityEnabled);

  return (
    <article className="absolute inset-0 z-10">
      <Link href={href} className="absolute inset-0 block focus:outline-none">
        <CardImage src={festival.heroImageUrl} priority />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/50 via-neutral-900/10 to-transparent" />
        <div className="absolute bottom-5 left-5 right-5 text-neutral-50">
          <h2 className="font-serif text-xl sm:text-2xl leading-tight drop-shadow">{festival.title}</h2>
          <p className="mt-0.5 text-xs sm:text-sm opacity-90">
            {festival.location} • {format(new Date(festival.startDate), "MMM d")} – {format(new Date(festival.endDate), "MMM d, yyyy")}
          </p>

          {/* Festival Vitality UI (feature-flagged) */}
          {vitalityEnabled && (
            <div className="mt-2.5 space-y-1.5" style={{ contain: 'content' }}>
              <FestivalCountdown
                startISO={festival.startDate}
                endISO={festival.endDate}
                highlightsUrl={festival.editorialSlug ? `/editorial/${festival.editorialSlug}` : undefined}
              />
              <div className="min-h-[24px]">
                <RSVPPresence data={rsvp} />
                <FriendsGoing data={friends} isMock />
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            {isPast && festival.editorialSlug && (
              <Link
                href={`/editorial/${festival.editorialSlug}`}
                className="rounded-full bg-surface-ground text-folio-text-primary px-3 py-1.5 text-xs shadow-sm hover:bg-surface-canvas transition"
                onClick={(e) => e.stopPropagation()}
              >
                View editorial
              </Link>
            )}
            {isUpcoming && (festival.addToCalendarUrl || festival.rsvpUrl) && (
              <Link
                href={festival.addToCalendarUrl || festival.rsvpUrl || '#'}
                className="rounded-full bg-surface-canvas/90 text-folio-text-primary px-3 py-1.5 text-xs shadow-sm hover:bg-surface-canvas transition"
                onClick={(e) => e.stopPropagation()}
              >
                Add to calendar
              </Link>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}

function PeekCard({ festival, side, muted = false, ctaLabel, href, onClick }: {
  festival: Festival; side: "left" | "right"; muted?: boolean; ctaLabel?: string; href?: string; onClick?: () => void;
}) {
  const isLeft = side === "left";
  return (
    <aside
      className={cn("absolute top-0 h-full w-[28%] sm:w-[25%] z-0", isLeft ? "left-0" : "right-0")}
      onClick={onClick}
      role="button"
      aria-label={isLeft ? "View previous festival" : "View next festival"}
    >
      <div className={cn("relative h-full rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)]", isLeft ? "ml-[-8%]" : "mr-[-8%]")}>
        <CardImage src={festival.heroImageUrl} />
        <div className={cn("absolute inset-0", muted ? "backdrop-blur-[1.5px] brightness-[0.8] saturate-[0.6]" : "bg-gradient-to-t from-neutral-900/40 via-transparent to-transparent")} />
        <div className="absolute bottom-3 left-3 right-3 text-neutral-50">
          <p className="text-[11px] opacity-90 line-clamp-1">{festival.title}</p>
          {ctaLabel && href && (
            <Link href={href} className="mt-1.5 inline-block rounded-full bg-surface-canvas/85 text-folio-text-primary px-2.5 py-1 text-[11px] shadow hover:bg-surface-canvas transition" onClick={(e)=> e.stopPropagation()}>
              {ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}

function CardImage({ src, priority = false }: { src: string; priority?: boolean }) {
  return (
    <Image
      src={src}
      alt=""
      fill
      priority={priority}
      sizes="(max-width: 1024px) 100vw, 1200px"
      className="object-cover will-change-transform scale-[1.02] transition-transform duration-500"
    />
  );
}