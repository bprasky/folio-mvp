import React from "react";
import FlowMosaic from "@/components/feed/FlowMosaic";

type Subevent = {
  id: string;
  title: string;
  imageUrl?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  location?: string | null;
};

export default function FestivalMosaicAdapter({
  subevents,
  festivalId,
}: {
  subevents: Subevent[];
  festivalId: string;
}) {
  const items = (subevents || []).map((s) => ({
    id: s.id,
    title: s.title,
    imageUrl: s.imageUrl ?? null,
    heroImageUrl: s.imageUrl ?? null,
    coverImageUrl: s.imageUrl ?? null,
    rsvpCount: 0, // Default values for missing fields
    viewCount: 0,
    isSponsored: false,
    eventTypes: [],
    startsAt: s.startDate ? new Date(s.startDate as any).toISOString() : null,
    startDate: s.startDate ? new Date(s.startDate as any).toISOString() : null,
    location: s.location ?? null,
    // IMPORTANT: nested, deep-linkable subevent path
    href: `/festivals/${festivalId}/subevents/${s.id}`,
  }));

  // Render your existing FlowMosaic component with these items
  return <FlowMosaic events={items} canEdit={false} />;
}
