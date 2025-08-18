import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import FestivalMosaicAdapter from "@/components/festivals/FestivalMosaicAdapter";

export const runtime = "nodejs";

// A row is a festival if eventTypes array includes "FESTIVAL"
const isFestival = (row: any) =>
  Array.isArray(row?.eventTypes) && row.eventTypes.includes("FESTIVAL");

export default async function FestivalPage({ params }: { params: { festivalId: string } }) {
  const { festivalId } = params;
  const festival = await prisma.event.findFirst({
    where: { id: festivalId },
    include: {
      subevents: {
        orderBy: [{ startDate: "asc" }],
        select: { id: true, title: true, imageUrl: true, startDate: true, endDate: true, location: true },
      },
    },
  });
  if (!festival || !isFestival(festival)) return notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <FestivalMosaicAdapter subevents={festival.subevents || []} festivalId={festival.id} />
    </div>
  );
}
