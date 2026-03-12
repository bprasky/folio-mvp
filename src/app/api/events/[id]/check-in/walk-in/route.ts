import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { canAccessCheckIn } from "@/lib/events/checkInAccess";
import { nanoid } from "nanoid";

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

    // Check if they already have an RSVP
    const existing = await prisma.eventRSVP.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "User already has an RSVP for this event" },
        { status: 409 }
      );
    }

    const rsvp = await prisma.eventRSVP.create({
      data: {
        userId,
        eventId,
        status: "ATTENDING",
        badgeToken: nanoid(12),
        checkedInAt: new Date(),
        checkedInById: session.user.id,
        checkInMethod: "walk_in",
      },
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

    const orgUser = rsvp.user?.organizationUsers?.[0];
    return NextResponse.json({
      status: "checked_in",
      checkedInAt: rsvp.checkedInAt,
      attendee: {
        id: rsvp.user?.id,
        name: rsvp.user?.name,
        profileImage: rsvp.user?.profileImage,
        title: rsvp.user?.title,
        orgName: orgUser?.organization?.name ?? null,
      },
    });
  } catch (e) {
    console.error("Walk-in check-in error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
