"use client";

import { Users } from "lucide-react";
import Countdown from "./Countdown";
import AvatarRow from "./AvatarRow";

export default function FomoBar({
  rsvpCount,
  capacity,
  startAtISO,
}: {
  rsvpCount: number;
  capacity: number | null;
  startAtISO: string | null;
}) {
  const spotsLeft =
    typeof capacity === "number" && capacity > 0
      ? Math.max(capacity - (rsvpCount || 0), 0)
      : null;

  const fauxNames =
    rsvpCount > 0
      ? Array.from({ length: Math.min(rsvpCount, 20) }).map((_, i) => `Designer ${i + 1}`)
      : [];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs md:text-sm opacity-95">
      <span className="inline-flex items-center gap-1.5">
        <Users className="h-4 w-4" />
        {rsvpCount} attending
      </span>

      {typeof spotsLeft === "number" && spotsLeft > 0 ? (
        <span className="rounded-full bg-white/12 px-2.5 py-1">{spotsLeft} spots left</span>
      ) : null}

      <Countdown startAt={startAtISO} />

      <div className="ml-auto hidden sm:block">
        <AvatarRow names={fauxNames} count={rsvpCount} />
      </div>
    </div>
  );
}
