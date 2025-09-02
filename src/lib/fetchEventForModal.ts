import { prisma } from "@/lib/prisma";

export async function fetchEventForModal(eventId: string) {
  const row = await prisma.event.findFirst({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      startDate: true,
      endDate: true,
      location: true,
      description: true,
      isPublic: true,
      capacity: true,
      parentFestival: { select: { id: true, title: true } },
      _count: { select: { rsvps: true } },
    },
  });

  if (!row) return null;

  return {
    ...row,
    rsvpsCount: row._count?.rsvps ?? 0,
    // keep the shape identical for the modal body:
    metrics: null,
    eventProducts: [],
  };
}
