import FlowMosaic from "@/components/feed/FlowMosaic";

type EventCard = {
  id: string;
  title: string;
  vendor: {
    id: string;
    name: string;
    logoUrl?: string | null;
  };
  type?: string | null;
  weight?: string | null;
  sponsorshipTier?: string | null;
  sizeToken: "XL" | "L" | "M" | "S";
  coverImageUrl?: string | null;
  startAt: Date;
  endAt: Date;
  windowStart?: Date | null;
  windowEnd?: Date | null;
  location: string;
  featuredProducts: Array<{
    id: string;
    name: string;
    imageUrl?: string | null;
    price?: string | null;
    url?: string | null;
  }>;
  metrics: {
    impressions: number;
    clicks: number;
    saves: number;
    rsvps: number;
    bookings: number;
  };
  cta: {
    kind: "RSVP" | "BOOK" | "VIEW";
    label: string;
  };
};

type MosaicFeedProps = {
  cards: EventCard[];
};

export default function MosaicFeed({ cards }: MosaicFeedProps) {
  // Transform EventCard to UIEvent format expected by FlowMosaic
  const events = cards.map(card => ({
    id: card.id,
    title: card.title,
    imageUrl: card.coverImageUrl,
    heroImageUrl: card.coverImageUrl,
    coverImageUrl: card.coverImageUrl,
    rsvpCount: card.metrics.rsvps,
    viewCount: card.metrics.impressions,
    isSponsored: card.sponsorshipTier === 'SPONSORED' || card.sponsorshipTier === 'PREMIUM',
    eventTypes: card.type ? [card.type] : [],
    startsAt: typeof card.startAt === 'string' ? card.startAt : card.startAt.toISOString(),
    startDate: typeof card.startAt === 'string' ? card.startAt : card.startAt.toISOString(),
    href: `/events/${card.id}`, // Add href for proper routing
    // Add flexible flag for UI display
    isFlexible: card.weight === 'FLEX' && !card.startAt && card.windowStart,
    ctaLabel: card.cta.label,
  }));

  return <FlowMosaic events={events} canEdit={false} />;
}
