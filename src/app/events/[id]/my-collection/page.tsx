import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import CollectionClient from "@/components/events/collection/CollectionClient";

export default async function MyCollectionPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/events/${params.id}/my-collection`);
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: { id: true, title: true },
  });

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Event not found.</p>
      </div>
    );
  }

  // Check if user has any scans for this event
  const scanCount = await prisma.eventProductScan.count({
    where: { eventId: event.id, userId: session.user.id },
  });

  if (scanCount === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[var(--text-primary,#1c1917)] mb-2">
            No Products Scanned
          </h1>
          <p className="text-[var(--text-secondary,#78716c)]">
            You haven&apos;t scanned any products at {event.title} yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CollectionClient
      event={{ id: event.id, title: event.title }}
    />
  );
}
