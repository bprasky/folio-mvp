"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import useCountdown from "@/hooks/useCountdown";

type FestivalCardProps = {
  festival: {
    id: string;
    title: string;
    location: string | null;
    startDate: Date | string;
    endDate: Date | string;
    imageUrl: string | null;
    slug?: string;
  };
  isPast: boolean;
  isNext: boolean;
};

export default function FestivalCard({ festival, isPast, isNext }: FestivalCardProps) {
  const startDate = new Date(festival.startDate);
  const endDate = new Date(festival.endDate);
  const { days, hours, minutes } = useCountdown(startDate.toISOString());
  const [rsvpCount] = useState(Math.floor(400 + Math.random() * 400));
  const [userRsvped, setUserRsvped] = useState(false);

  const href = `/festivals/${festival.slug ?? festival.id}`;
  const imageSrc = festival.imageUrl || "/images/event-placeholder.jpg";

  return (
    <div
      className={clsx(
        "relative shrink-0 rounded-[20px] overflow-hidden shadow-sm aspect-[16/9] transition-all group",
        isPast ? "grayscale opacity-85 hover:opacity-90" : "hover:shadow-md"
      )}
    >
      {/* Background image - no link wrapper */}
      <Image
        src={imageSrc}
        alt={festival.title}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 880px"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(30,30,30,0.65)] via-[rgba(30,30,30,0.15)] to-transparent z-10" />

      {/* Clickable link overlay - behind content */}
      <Link href={href} className="absolute inset-0 z-20 block" aria-label={festival.title} />

      {/* Text overlay - above link */}
      <div className="absolute left-6 bottom-6 right-[160px] text-white z-30 pointer-events-none">
        <h3 className="font-serif text-2xl md:text-3xl leading-tight">{festival.title}</h3>
        <p className="text-sm opacity-90 mt-1">{festival.location || ""}</p>
        <p className="text-xs opacity-75 mt-0.5">
          {startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
          {endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Countdown + RSVP (top-right) - above link */}
      {!isPast && (
        <div className="absolute right-5 top-5 flex flex-col items-end gap-2 text-white z-30">
          <div className="rounded-xl bg-[rgba(30,30,30,0.7)] backdrop-blur px-3 py-2 text-right pointer-events-none">
            <div className="text-[var(--type-eyebrow)] uppercase tracking-wide opacity-90">Starts in</div>
            <div className="text-lg font-medium tabular-nums">
              {days}d {hours}h {minutes}m
            </div>
          </div>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setUserRsvped(!userRsvped);
            }}
            className={clsx(
              "rounded-xl px-3 py-1 text-sm transition-colors pointer-events-auto",
              userRsvped ? "bg-white text-[rgb(30,30,30)]" : "bg-[rgba(30,30,30,0.7)] text-white hover:bg-[rgba(30,30,30,0.8)]"
            )}
          >
            {userRsvped ? "RSVP'd" : "RSVP"} • {rsvpCount.toLocaleString()}
          </button>
        </div>
      )}

      {/* Past badge - above link */}
      {isPast && (
        <div className="absolute right-4 top-4 rounded-full bg-[rgba(30,30,30,0.7)] px-3 py-1 text-[var(--type-meta)] uppercase tracking-wide text-white z-30 pointer-events-none">
          Past event
        </div>
      )}
    </div>
  );
}

