"use client";
import Link from "next/link";
import { eventHref } from "@/lib/paths";

export default function EventCard({ event }: { event: any }) {
  return (
    <div className="relative group rounded-xl border border-[var(--ridge-outer)] overflow-hidden bg-[var(--bg-base)]">
      {event.imageUrl && (
        <img src={event.imageUrl} alt={event.title} className="h-48 w-full object-cover" />
      )}
      <div className="p-4">
        <h3 className="font-semibold text-[var(--text-primary)]">{event.title}</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          {event.location}
        </p>
        {event.startDate && (
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            {new Date(event.startDate).toLocaleDateString()}
          </p>
        )}
      </div>
      <Link href={eventHref(event)} className="absolute inset-0" />
    </div>
  );
} 