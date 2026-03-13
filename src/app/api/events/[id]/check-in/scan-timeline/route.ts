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

    const scans = await prisma.eventProductScan.findMany({
      where: { eventId },
      select: { scannedAt: true },
      orderBy: { scannedAt: "asc" },
    });

    // Group by 15-minute intervals
    const buckets: Record<string, number> = {};
    for (const scan of scans) {
      const d = new Date(scan.scannedAt);
      const minutes = Math.floor(d.getMinutes() / 15) * 15;
      d.setMinutes(minutes, 0, 0);
      const key = d.toISOString();
      buckets[key] = (buckets[key] || 0) + 1;
    }

    const timeline = Object.entries(buckets)
      .map(([time, count]) => ({
        time,
        label: new Date(time).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        count,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    return NextResponse.json({ timeline });
  } catch (e) {
    console.error("Scan timeline error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
