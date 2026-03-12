import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { canAccessCheckIn } from "@/lib/events/checkInAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatAttendee(rsvp: any) {
  const user = rsvp.user;
  const orgUser = user?.organizationUsers?.[0];
  return {
    id: user?.id,
    name: user?.name,
    profileImage: user?.profileImage,
    title: user?.title,
    orgName: orgUser?.organization?.name ?? null,
  };
}

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

    const { badgeToken } = (await req.json()) as { badgeToken?: string };
    if (!badgeToken)
      return NextResponse.json(
        { error: "Missing badgeToken" },
        { status: 400 }
      );

    const rsvp = await prisma.eventRSVP.findUnique({
      where: { badgeToken },
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

    if (rsvp.eventId !== eventId) {
      return NextResponse.json({ status: "wrong_event" }, { status: 400 });
    }

    if (rsvp.checkedInAt) {
      return NextResponse.json({
        status: "already_checked_in",
        checkedInAt: rsvp.checkedInAt,
        attendee: formatAttendee(rsvp),
      });
    }

    const updated = await prisma.eventRSVP.update({
      where: { id: rsvp.id },
      data: {
        checkedInAt: new Date(),
        checkedInById: session.user.id,
        checkInMethod: "badge_scan",
      },
    });

    return NextResponse.json({
      status: "checked_in",
      checkedInAt: updated.checkedInAt,
      attendee: formatAttendee(rsvp),
    });
  } catch (e) {
    console.error("Check-in scan error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
