import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import FestivalMosaicAdapter from "@/components/festivals/FestivalMosaicAdapter";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export const runtime = "nodejs";

// A row is a festival if eventTypes array includes "FESTIVAL"
const isFestival = (row: any) =>
  Array.isArray(row?.eventTypes) && row.eventTypes.includes("FESTIVAL");

export default async function FestivalPage({ params }: { params: { festivalId: string } }) {
  const { festivalId } = params;
  
  // Get session to check admin status
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'ADMIN';
  
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
      <FestivalMosaicAdapter 
        subevents={festival.subevents || []} 
        festivalId={festival.id} 
        canEdit={isAdmin}
      />
    </div>
  );
}
