"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EventType } from "@/lib/eventTypes";
import FlowMosaic from "@/components/feed/FlowMosaic";

type Subevent = {
  id: string;
  title: string;
  imageUrl?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  location?: string | null;
  eventTypes?: EventType[];
};

// Get all event types from Prisma enum
const allEventTypes = Object.values(EventType) as string[];

export default function FestivalMosaicAdapter({
  subevents,
  festivalId,
  canEdit = false,
  selectedEventType,
  festivalTitle,
}: {
  subevents: Subevent[];
  festivalId: string;
  canEdit?: boolean;
  selectedEventType?: string;
  festivalTitle?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleEventTypeChange = (eventType: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (eventType && eventType !== "") {
      params.set("eventType", eventType);
    } else {
      params.delete("eventType");
    }
    const queryString = params.toString();
    router.replace(`/festivals/${festivalId}${queryString ? `?${queryString}` : ''}`, { scroll: false });
  };

  const items = (subevents || []).map((s) => ({
    id: s.id,
    title: s.title,
    imageUrl: s.imageUrl ?? null,
    heroImageUrl: s.imageUrl ?? null,
    coverImageUrl: s.imageUrl ?? null,
    rsvpCount: 0, // Default values for missing fields
    viewCount: 0,
    isSponsored: false,
    eventTypes: s.eventTypes || [],
    startsAt: s.startDate ? new Date(s.startDate as any).toISOString() : null,
    startDate: s.startDate ? new Date(s.startDate as any).toISOString() : null,
    location: s.location ?? null,
    // IMPORTANT: nested, deep-linkable subevent path
    href: `/festivals/${festivalId}/subevents/${s.id}`,
  }));

  return (
    <div className="space-y-4">
      {/* Event Type Filter Dropdown */}
      <header className="flex justify-between items-end w-full px-2 sm:px-3 mb-2">
        <div>
          {festivalTitle && (
            <h1 className="text-2xl font-serif text-folio-text-primary tracking-tight">
              {festivalTitle}
            </h1>
          )}
          <p className="text-sm text-folio-text-secondary mt-1">
            {selectedEventType 
              ? `Showing ${subevents.length} ${selectedEventType.replace(/_/g, ' ').toLowerCase()} events`
              : `Showing all ${subevents.length} events`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="event-type-filter" className="text-sm font-medium text-folio-text-primary">
            Filter by type:
          </label>
          <select
            id="event-type-filter"
            value={selectedEventType || ""}
            onChange={(e) => handleEventTypeChange(e.target.value)}
            className="px-3 py-2 border border-folio-border-subtle rounded-md bg-surface-canvas text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
          >
            <option value="">All Events</option>
            {allEventTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* FlowMosaic Component */}
      <FlowMosaic events={items} canEdit={canEdit} />
    </div>
  );
}
