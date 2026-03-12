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
      select: {
        checkedInAt: true,
        checkInMethod: true,
        status: true,
      },
    });

    const totalRsvps = rsvps.filter(
      (r) => r.status?.toUpperCase() === "ATTENDING"
    ).length;
    const checkedIn = rsvps.filter((r) => r.checkedInAt).length;
    const walkIns = rsvps.filter(
      (r) => r.checkInMethod === "walk_in"
    ).length;
    const notYet = totalRsvps - checkedIn;
    const lastScan = rsvps
      .filter((r) => r.checkedInAt)
      .sort(
        (a, b) =>
          new Date(b.checkedInAt!).getTime() -
          new Date(a.checkedInAt!).getTime()
      )[0]?.checkedInAt;

    // Product scan stats
    const productScanCount = await prisma.eventProductScan.count({
      where: { eventId },
    });
    const uniqueScanners = await prisma.eventProductScan
      .groupBy({ by: ["userId"], where: { eventId } })
      .then((g) => g.length);

    return NextResponse.json({
      totalRsvps,
      checkedIn,
      walkIns,
      notYet: Math.max(0, notYet),
      lastScan: lastScan ?? null,
      productScans: productScanCount,
      avgScansPerPerson:
        uniqueScanners > 0
          ? Math.round((productScanCount / uniqueScanners) * 10) / 10
          : 0,
    });
  } catch (e) {
    console.error("Check-in stats error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
