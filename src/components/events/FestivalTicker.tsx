"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import CoverImage from "@/components/ui/CoverImage";
import { cn } from "@/lib/utils";

type Festival = {
  id: string;
  title: string;
  imageUrl?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
};

type Props = {
  festivals: Festival[];
  className?: string;
};

function formatRange(s?: Date | string | null, e?: Date | string | null) {
  if (!s) return "";
  const start = new Date(s);
  const end = e ? new Date(e) : null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return end ? `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}` : start.toLocaleDateString(undefined, opts);
}

export default function FestivalTicker({ festivals, className }: Props) {
  // Use festivals directly, no duplication needed for static display

  return (
    <div className={cn("relative", className)}>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xl font-semibold">Featured Festivals</h2>
        <ChevronRight className="h-4 w-4 opacity-60" />
      </div>

      <div className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {/* scroller */}
        <div
          className="
            flex w-max gap-4 p-4 overflow-x-auto
          "
        >
          {festivals.map((f) => {
            const href = `/festivals/${f.id}`;
            return (
              <div
                key={f.id}
                className="w-[320px] shrink-0 rounded-xl border border-neutral-200/70 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <Link href={href} className="block">
                  <CoverImage src={f.imageUrl ?? null} alt={f.title} ratio="4/3" className="rounded-b-none rounded-t-xl" />
                </Link>
                <div className="p-3">
                  <Link href={href} className="line-clamp-2 font-medium leading-snug hover:underline">
                    {f.title}
                  </Link>
                  <div className="mt-1 text-sm text-neutral-600">{formatRange(f.startDate, f.endDate)}</div>

                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href={`${href}?intent=rsvp`}
                      className="rounded-md bg-[#5B8DEF] px-3 py-1.5 text-sm font-medium text-white hover:brightness-105"
                    >
                      RSVP
                    </Link>
                    <Link
                      href={href}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* fade masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white" />
      </div>


    </div>
  );
}
