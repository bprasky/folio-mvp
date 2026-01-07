export type UIEvent = {
  id: string;
  title: string;
  imageUrl: string;
  href: string;
  startsAt: string | null;
  endsAt: string | null;
  eventTypes: string[];
  rsvpCount?: number;
  viewCount?: number;
  promotionTier?: number;
};

export function normalizeEvent(e: any): UIEvent {
  const title = String(e?.title ?? e?.name ?? "");
  const imageUrl = e?.heroImageUrl || e?.coverImageUrl || e?.imageUrl || "";
  const startsAt = typeof e?.startsAt === "string"
    ? e.startsAt
    : e?.startDate ? new Date(e.startDate).toISOString() : null;
  const endsAt = typeof e?.endsAt === "string"
    ? e.endsAt
    : e?.endDate ? new Date(e.endDate).toISOString() : null;
  const eventTypes = Array.isArray(e?.eventTypes) ? e.eventTypes.map(String) : [];
  return {
    id: e.id,
    title,
    imageUrl,
    href: `/events/${e.id}`,
    startsAt,
    endsAt,
    eventTypes,
    rsvpCount: e?.rsvps?.length ?? e?.rsvpCount ?? 0,
    viewCount: e?.viewCount ?? 0,
    promotionTier: e?.promotionTier ?? 0,
  };
} 