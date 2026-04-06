"use client";
import Link from "next/link";
import { eventHref } from "@/lib/paths";

export default function EventCard({ event }: { event: any }) {
  return (
    <div className="relative group rounded-xl border border-folio-border-subtle overflow-hidden bg-surface-canvas">
      {event.imageUrl && (
        <img src={event.imageUrl} alt={event.title} className="h-48 w-full object-cover" />
      )}
      <div className="p-4">
        <h3 className="font-semibold text-folio-text-primary">{event.title}</h3>
        <p className="text-sm text-folio-text-secondary">
          {event.location}
        </p>
        {event.startDate && (
          <p className="text-sm text-folio-text-tertiary mt-1">
            {new Date(event.startDate).toLocaleDateString()}
          </p>
        )}
      </div>
      <Link href={eventHref(event)} className="absolute inset-0" />
    </div>
  );
} 