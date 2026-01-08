"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EventType } from "@prisma/client";
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
      {/* Festival Title Treatment - Centered below FOLIO masthead, matching search results style */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        <div className="text-center">
          {/* Festival Title - Italic serif, centered, elegant spacing */}
          {festivalTitle && (
            <h1 className="font-serif italic text-3xl md:text-4xl lg:text-5xl text-neutral-900 mb-6">
              {festivalTitle}
            </h1>
          )}

          {/* Metadata Line - Event count and filter, muted styling */}
          <div className="flex items-center justify-center gap-3 text-sm text-neutral-500 flex-wrap">
            <span className="font-sans">
              {selectedEventType
                ? `${subevents.length} ${selectedEventType.replace(/_/g, ' ').toLowerCase()} ${subevents.length === 1 ? 'event' : 'events'}`
                : `${subevents.length} ${subevents.length === 1 ? 'event' : 'events'}`
              }
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="event-type-filter" className="text-sm text-neutral-500">
                Filter by type:
              </label>
              <select
                id="event-type-filter"
                value={selectedEventType || ""}
                onChange={(e) => handleEventTypeChange(e.target.value)}
                className="px-3 py-1.5 border border-neutral-200 rounded-md bg-white text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              >
                <option value="">All Events</option>
                {allEventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* FlowMosaic Component */}
      <FlowMosaic events={items} canEdit={canEdit} />
    </div>
  );
}
