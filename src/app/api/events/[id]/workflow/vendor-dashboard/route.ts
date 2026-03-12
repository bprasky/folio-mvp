export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { canAccessCheckIn } from "@/lib/events/checkInAccess";
import { nanoid } from "nanoid";

/**
 * POST /api/events/[id]/workflow/vendor-dashboard
 * Compute and store check-in based vendor analytics.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = params.id;
    const allowed = await canAccessCheckIn(
      session.user.id,
      session.user.role,
      eventId
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Create workflow job
    const job = await prisma.eventWorkflowJob.create({
      data: {
        id: nanoid(12),
        eventId,
        jobType: "update_vendor_dashboard",
        status: "running",
        startedAt: new Date(),
      },
    });

    // Compute check-in metrics
    const rsvps = await prisma.eventRSVP.findMany({
      where: { eventId },
      include: { user: { select: { role: true } } },
    });

    const attending = rsvps.filter(
      (r) => r.status?.toUpperCase() === "ATTENDING"
    );
    const checkedIn = rsvps.filter((r) => r.checkedInAt);
    const walkIns = rsvps.filter((r) => r.checkInMethod === "walk_in");
    const noShows = attending.filter((r) => !r.checkedInAt);

    const designerRsvps = attending.filter(
      (r) => r.user?.role === "DESIGNER"
    );
    const designerCheckedIn = designerRsvps.filter((r) => r.checkedInAt);

    const methods: Record<string, number> = {};
    for (const r of checkedIn) {
      const m = r.checkInMethod || "unknown";
      methods[m] = (methods[m] || 0) + 1;
    }

    const analytics = {
      eventTitle: event.title,
      attendanceRate:
        attending.length > 0 ? checkedIn.length / attending.length : 0,
      totalRsvps: attending.length,
      checkedIn: checkedIn.length,
      noShows: noShows.length,
      walkIns: walkIns.length,
      designerAttendance: {
        checkedIn: designerCheckedIn.length,
        total: designerRsvps.length,
      },
      checkInMethods: methods,
    };

    // Update job
    await prisma.eventWorkflowJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        result: analytics,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      analytics,
      message: "Vendor dashboard updated with check-in analytics",
    });
  } catch (error: any) {
    console.error("Error updating vendor dashboards:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
