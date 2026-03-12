import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { canAccessCheckIn } from "@/lib/events/checkInAccess";
import { redirect } from "next/navigation";
import CheckInPageClient from "@/components/events/check-in/CheckInPageClient";

export default async function CheckInPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/auth/login?callbackUrl=/events/${params.id}/check-in`);
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, startDate: true, endDate: true },
  });

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Event not found.</p>
      </div>
    );
  }

  const allowed = await canAccessCheckIn(
    session.user.id,
    session.user.role,
    event.id
  );

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">
          You don&apos;t have permission to check in attendees for this event.
        </p>
      </div>
    );
  }

  return (
    <CheckInPageClient
      event={{
        id: event.id,
        title: event.title,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
      }}
    />
  );
}
