import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { canAccessCheckIn } from "@/lib/events/checkInAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const eventId = params.id;
    const allowed = await canAccessCheckIn(
      session.user.id,
      session.user.role,
      eventId
    );
    if (!allowed)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = (await req.json()) as { userId?: string };
    if (!userId)
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const rsvp = await prisma.eventRSVP.findUnique({
      where: { userId_eventId: { userId, eventId } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            title: true,
            organizationUsers: {
              where: { isActive: true },
              include: { organization: { select: { name: true } } },
              take: 1,
            },
          },
        },
      },
    });

    if (!rsvp) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    if (rsvp.checkedInAt) {
      const orgUser = rsvp.user?.organizationUsers?.[0];
      return NextResponse.json({
        status: "already_checked_in",
        checkedInAt: rsvp.checkedInAt,
        attendee: {
          id: rsvp.user?.id,
          name: rsvp.user?.name,
          profileImage: rsvp.user?.profileImage,
          title: rsvp.user?.title,
          orgName: orgUser?.organization?.name ?? null,
        },
      });
    }

    const updated = await prisma.eventRSVP.update({
      where: { id: rsvp.id },
      data: {
        checkedInAt: new Date(),
        checkedInById: session.user.id,
        checkInMethod: "manual",
      },
    });

    const orgUser = rsvp.user?.organizationUsers?.[0];
    return NextResponse.json({
      status: "checked_in",
      checkedInAt: updated.checkedInAt,
      attendee: {
        id: rsvp.user?.id,
        name: rsvp.user?.name,
        profileImage: rsvp.user?.profileImage,
        title: rsvp.user?.title,
        orgName: orgUser?.organization?.name ?? null,
      },
    });
  } catch (e) {
    console.error("Manual check-in error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
