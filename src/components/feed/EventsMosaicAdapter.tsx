import React from "react";
import FlowMosaic from "@/components/feed/FlowMosaic";

type EventLite = {
  id: string;
  title: string;
  imageUrl?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  location?: string | null;
  isSponsored?: boolean | null;
  eventTypes?: string[] | null;
  rsvpCount?: number | null;
  viewCount?: number | null;
};

export default function EventsMosaicAdapter({
  events,
}: {
  events: EventLite[];
}) {
  const items = (events || []).map((e) => {
    const startIso = e.startDate ? new Date(e.startDate as any).toISOString() : null;

    return {
      id: e.id,
      title: e.title,
      imageUrl: e.imageUrl ?? null,
      heroImageUrl: e.imageUrl ?? null,
      coverImageUrl: e.imageUrl ?? null,
      rsvpCount: e.rsvpCount ?? 0,
      viewCount: e.viewCount ?? 0,
      isSponsored: !!e.isSponsored,
      eventTypes: e.eventTypes ?? [],
      startsAt: startIso,
      startDate: startIso,
      location: e.location ?? null,
      href: `/events/preview/${e.id}`,
    };
  });

  return <FlowMosaic events={items} canEdit={false} />;
}
