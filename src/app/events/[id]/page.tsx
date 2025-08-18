import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import EventInvitationLayout from "@/components/events/EventInvitationLayout";
import RsvpControl from "@/components/events/RsvpControl";
import AddToCalendar from "@/components/events/AddToCalendar";

export const runtime = "nodejs";

const isFestival = (row: any) =>
  Array.isArray(row?.eventTypes) && row.eventTypes.includes("FESTIVAL");

export default async function EventPage({ params }: { params: { id: string } }) {
  const key = params.id;

  const event = await prisma.event.findFirst({
    where: { id: key },
  });

  if (!event) return notFound();

  if (isFestival(event)) {
    redirect(`/festivals/${event.id}`);
  }

  // map fields your Invitation layout expects
  return (
    <EventInvitationLayout
      event={{
        id: event.id,
        title: event.title,
        heroImageUrl: (event as any).imageUrl ?? null,
        startAt: (event as any).startDate ?? null,
        endAt: (event as any).endDate ?? null,
        venue: (event as any).location ?? null,
        city: null,
        country: null,
        vendor: null,
        festival: null,
      }}
      rsvpControl={<RsvpControl eventId={event.id} />}
      addToCalendarControl={<AddToCalendar event={event} />}
    />
  );
} 