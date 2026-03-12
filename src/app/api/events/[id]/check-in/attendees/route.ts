import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { canAccessCheckIn } from "@/lib/events/checkInAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
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

    const search = req.nextUrl.searchParams.get("search") ?? "";
    const filter = req.nextUrl.searchParams.get("filter") ?? "all";

    const where: any = { eventId };

    // Apply filter
    if (filter === "checked_in") {
      where.checkedInAt = { not: null };
    } else if (filter === "not_yet") {
      where.checkedInAt = null;
      where.checkInMethod = null; // Exclude walk-ins that haven't been created yet
    } else if (filter === "walk_in") {
      where.checkInMethod = "walk_in";
    }

    const rsvps = await prisma.eventRSVP.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            title: true,
            role: true,
            organizationUsers: {
              where: { isActive: true },
              include: { organization: { select: { name: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    let filtered = rsvps;
    if (search) {
      const lower = search.toLowerCase();
      filtered = rsvps.filter((r) => {
        const name = r.user?.name?.toLowerCase() ?? "";
        const orgName =
          r.user?.organizationUsers?.[0]?.organization?.name?.toLowerCase() ??
          "";
        return name.includes(lower) || orgName.includes(lower);
      });
    }

    const attendees = filtered.map((r) => {
      const orgUser = r.user?.organizationUsers?.[0];
      return {
        rsvpId: r.id,
        userId: r.user?.id,
        name: r.user?.name,
        profileImage: r.user?.profileImage,
        title: r.user?.title,
        role: r.user?.role,
        orgName: orgUser?.organization?.name ?? null,
        status: r.status,
        checkedInAt: r.checkedInAt,
        checkInMethod: r.checkInMethod,
      };
    });

    return NextResponse.json({ attendees });
  } catch (e) {
    console.error("Check-in attendees error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
