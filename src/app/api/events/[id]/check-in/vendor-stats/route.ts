import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { canAccessCheckIn } from "@/lib/events/checkInAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
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

    const rsvps = await prisma.eventRSVP.findMany({
      where: { eventId },
      include: {
        user: { select: { role: true } },
      },
    });

    const attending = rsvps.filter(
      (r) => r.status?.toUpperCase() === "ATTENDING"
    );
    const checkedIn = rsvps.filter((r) => r.checkedInAt);
    const walkIns = rsvps.filter((r) => r.checkInMethod === "walk_in");
    const noShows = attending.filter((r) => !r.checkedInAt);

    // Designer breakdown
    const designerRsvps = attending.filter(
      (r) => r.user?.role === "DESIGNER"
    );
    const designerCheckedIn = designerRsvps.filter((r) => r.checkedInAt);

    // Check-in method breakdown
    const methods: Record<string, number> = {};
    for (const r of checkedIn) {
      const m = r.checkInMethod || "unknown";
      methods[m] = (methods[m] || 0) + 1;
    }

    const totalRsvps = attending.length;

    return NextResponse.json({
      attendanceRate: totalRsvps > 0 ? checkedIn.length / totalRsvps : 0,
      totalRsvps,
      checkedIn: checkedIn.length,
      noShows: noShows.length,
      walkIns: walkIns.length,
      designerAttendance: {
        checkedIn: designerCheckedIn.length,
        total: designerRsvps.length,
      },
      checkInMethods: methods,
    });
  } catch (e) {
    console.error("Vendor stats error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
