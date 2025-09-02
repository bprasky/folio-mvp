"use client";

import Image from "next/image";
import { CalendarDays, MapPin } from "lucide-react";

import RsvpControl from "@/components/events/RsvpControl";
import AddToCalendar from "@/components/events/AddToCalendar";
import FomoBar from "@/components/events/modal/FomoBar";
import FeaturedPlaceholder from "@/components/events/modal/FeaturedPlaceholder";
import AvatarRow from "@/components/events/modal/AvatarRow";

type EventModalData = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  location?: string | null;
  isPublic?: boolean | null;
  capacity?: number | null;
  parentFestival?: { id: string; title: string } | null;
  rsvpsCount?: number | null;
  eventProducts?: Array<any> | null; // we'll treat as empty for now
  metrics?: any | null;               // unused for now
};

function toDate(v?: string | Date | null) {
  return v ? new Date(v as any) : null;
}

export default function EventModalBodyClient({ data }: { data: EventModalData }) {
  const start = toDate(data.startDate);
  const end = toDate(data.endDate);

  return (
    <div className="relative min-h-[80svh] w-full text-white">
      {/* Hero background */}
      <div className="absolute inset-0 -z-10">
        {data.imageUrl ? (
          <Image src={data.imageUrl} alt={data.title} fill className="object-cover" priority />
        ) : (
          <div className="h-full w-full bg-neutral-800" />
        )}
        <div className="absolute inset-0 bg-black/40" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/50 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Content wrapper */}
      <div className="mx-auto w-full max-w-[960px] px-5 sm:px-6 md:px-8">
        {/* Hero section */}
        <div className="pt-12 md:pt-16">
          <p className="text-sm md:text-base tracking-wide opacity-90">Please join us at:</p>
          <h1 className="mt-2 text-3xl md:text-5xl font-semibold leading-[1.1]">{data.title}</h1>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm md:text-base opacity-95">
            {start ? (
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {start.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" · "}
                {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                {end
                  ? ` – ${end.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                  : ""}
              </span>
            ) : null}
            {data.location ? (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {data.location}
              </span>
            ) : null}
          </div>

          {/* CTA row */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <RsvpControl eventId={data.id} />
            <AddToCalendar
              event={{
                id: data.id,
                title: data.title,
                startDate: start ?? undefined,
                endDate: end ?? undefined,
                location: data.location ?? undefined,
              } as any}
            />
            {/* Remove the "Open full page" Link/button */}
          </div>

          {/* FOMO */}
          <FomoBar
            rsvpCount={data.rsvpsCount ?? 0}
            capacity={typeof data.capacity === "number" ? data.capacity : null}
            startAtISO={start ? start.toISOString() : null}
          />

          {/* Optional line, like subevent modal */}
          {data.parentFestival?.title ? (
            <p className="mt-2 text-sm opacity-90">
              Join top designers attending {data.parentFestival.title}.
            </p>
          ) : null}

          <div className="mt-3">
            <AvatarRow names={[]} count={data.rsvpsCount ?? 0} />
          </div>
        </div>

        {/* Featured products */}
        <div className="mt-10 md:mt-12">
          <h3 className="text-base md:text-lg font-medium tracking-tight mb-3">
            See these at the event
          </h3>
          <FeaturedPlaceholder />
        </div>

        {/* About section */}
        {data.description ? (
          <div className="mt-10 pb-10 md:pb-14">
            <h2 className="text-xl font-semibold">About this event</h2>
            <p className="mt-2 text-white/90">{data.description}</p>
          </div>
        ) : null}

        {/* Parent festival chip (optional) */}
        {data.parentFestival ? (
          <div className="mb-8">
            <a href={`/festivals/${data.parentFestival.id}`} className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15">
              View all events in {data.parentFestival.title}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
