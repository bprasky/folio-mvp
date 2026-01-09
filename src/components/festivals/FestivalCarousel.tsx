import { prisma } from "@/lib/prisma";
import FestivalCarouselClient from "./FestivalCarouselClient";
import { EventType } from "@/lib/eventTypes";

function toISODate(d: Date | string) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
}

// Helper to generate slug from title or use id
function generateSlug(festival: { id: string; title: string }): string {
  // Create a simple slug from title, fallback to id
  const slug = festival.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || festival.id;
}

export default async function FestivalCarousel() {
  const festivals = await prisma.event.findMany({
    where: {
      eventTypes: {
        has: EventType.FESTIVAL
      },
      isApproved: true,
      isPublic: true,
    },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      title: true,
      location: true,
      startDate: true,
      endDate: true,
      imageUrl: true,
    },
  });

  const today = toISODate(new Date());

  const initialIndex = (() => {
    const idx = festivals.findIndex(f => toISODate(f.startDate) >= today);
    if (idx >= 0) return idx;              // first upcoming → primary center
    return Math.max(0, festivals.length - 1); // if all past, center the last
  })();

  // Add slug to each festival
  const festivalsWithSlugs = festivals.map(f => ({
    ...f,
    slug: generateSlug(f),
  }));

  return (
    <FestivalCarouselClient
      festivals={festivalsWithSlugs}
      initialIndex={initialIndex}
    />
  );
}



