"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import GlassTile from "@/components/ui/GlassTile";
import Link from "next/link";

type Props = {
  title: string;
  vendorName?: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
  location?: string | null; // e.g., "The Refinery at Domino, Brooklyn"
  inviteCopy?: "invited" | "join";
  festival?: { id: string; title: string; slug?: string | null } | null;
  onRsvp?: React.ReactNode;        // slot for RSVP control
  onAddToCal?: React.ReactNode;    // slot for Add-to-Calendar
  hostLinkHref?: string | null;
};

export default function InvitationHeader({
  title,
  vendorName,
  startAt,
  endAt,
  location,
  inviteCopy = "invited",
  festival,
  onRsvp,
  onAddToCal,
  hostLinkHref
}: Props) {
  const dateLine = useMemo(() => {
    if (!startAt) return null;
    try {
      const s = format(new Date(startAt), "EEEE, MMM d, yyyy");
      const t1 = format(new Date(startAt), "p");
      const t2 = endAt ? ` – ${format(new Date(endAt), "p")}` : "";
      return `${s} · ${t1}${t2}`;
    } catch {
      return null;
    }
  }, [startAt, endAt]);

  const prefix = inviteCopy === "join" ? "Join us at" : "You are invited to";

  return (
    <GlassTile className="p-6 md:p-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm md:text-base tracking-wide uppercase opacity-90">{prefix}:</p>
        <h1 className="text-2xl md:text-4xl font-semibold leading-tight">{title}</h1>
        <div className="text-sm md:text-base text-white/90">
          {vendorName ? (
            <div className="flex items-center gap-2">
              <span>Hosted by</span>
              {hostLinkHref ? (
                <Link href={hostLinkHref} className="underline hover:opacity-90">{vendorName}</Link>
              ) : (
                <span className="font-medium">{vendorName}</span>
              )}
            </div>
          ) : null}
          {festival ? (
            <div className="mt-1">
              Part of{" "}
              <Link
                href={festival.slug ? `/festivals/${festival.slug}` : `/festivals/${festival.id}`}
                className="underline hover:opacity-90"
              >
                {festival.title}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm md:text-base">
          {dateLine ? (
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {dateLine}
            </span>
          ) : null}
          {location ? <span className="opacity-90">• {location}</span> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {/* Slots render your existing RSVP and Add-to-Calendar buttons */}
          {onRsvp}
          {onAddToCal}
        </div>
      </div>
    </GlassTile>
  );
}
