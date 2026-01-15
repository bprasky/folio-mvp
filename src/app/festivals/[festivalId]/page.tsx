/**
 * FestivalPage - Main festival display page
 * Folio Design System: Uses bg-[var(--bg-base)] for background
 */
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import FestivalMosaicAdapter from "@/components/festivals/FestivalMosaicAdapter";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { EventType } from "@/lib/eventTypes";

export const runtime = "nodejs";

// A row is a festival if eventTypes array includes "FESTIVAL"
const isFestival = (row: any) =>
  Array.isArray(row?.eventTypes) && row.eventTypes.includes("FESTIVAL");

// Helper to generate slug from title (matches carousel)
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function FestivalPage({ 
  params, 
  searchParams 
}: { 
  params: { festivalId: string };
  searchParams?: { eventType?: string };
}) {
  const { festivalId } = params;
  const selectedEventType = searchParams?.eventType;
  
  // Get session to check admin status
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'ADMIN';
  
  // Try to find by id first, then by slug (title-based)
  let festival = await prisma.event.findFirst({
    where: { id: festivalId },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      startDate: true,
      endDate: true,
      imageUrl: true,
      eventTypes: true,
      subevents: {
        orderBy: [{ startDate: "asc" }],
        select: { id: true, title: true, imageUrl: true, startDate: true, endDate: true, location: true, eventTypes: true },
      },
    },
  });
  
  // If not found by id, try finding by slug (generated from title)
  if (!festival || !isFestival(festival)) {
    // Fetch all festivals and find by slug match
    const allFestivals = await prisma.event.findMany({
      where: {
        eventTypes: { has: EventType.FESTIVAL },
        isApproved: true,
      },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        startDate: true,
        endDate: true,
        imageUrl: true,
        eventTypes: true,
        subevents: {
          orderBy: [{ startDate: "asc" }],
          select: { id: true, title: true, imageUrl: true, startDate: true, endDate: true, location: true, eventTypes: true },
        },
      },
    });
    
    const matchingFestival = allFestivals.find(f => {
      const slug = generateSlug(f.title);
      return slug === festivalId || f.id === festivalId;
    });
    
    if (!matchingFestival || !isFestival(matchingFestival)) return notFound();
    festival = matchingFestival;
  }
  
  if (!isFestival(festival)) return notFound();

  // Filter subevents by event type if specified
  const filteredSubevents = selectedEventType && Object.values(EventType).includes(selectedEventType as EventType)
    ? festival.subevents?.filter(event => 
        Array.isArray(event.eventTypes) && event.eventTypes.includes(selectedEventType as EventType)
      ) || []
    : festival.subevents || [];

  return (
    <div className="w-full max-w-[100vw] overflow-hidden px-0 sm:px-0 lg:px-0 pb-6 bg-[var(--bg-base)]">
      <FestivalMosaicAdapter
        subevents={filteredSubevents}
        festivalId={festival.id}
        canEdit={isAdmin}
        selectedEventType={selectedEventType}
        festivalTitle={festival.title}
      />
    </div>
  );
}
