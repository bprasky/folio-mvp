export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { canAccessCheckIn } from "@/lib/events/checkInAccess";
import { sendEmail } from "@/lib/email/sendEmail";
import {
  thankYouEmailHtml,
  missedYouEmailHtml,
  walkInFollowUpEmailHtml,
} from "@/lib/email/templates/event-recap";
import { nanoid } from "nanoid";

type RecapType = "thank_you" | "no_show" | "walk_in_followup";

/**
 * POST /api/events/[id]/workflow/recap
 * Send post-event emails based on check-in data.
 * Body: { type: 'thank_you' | 'no_show' | 'walk_in_followup' }
 */
export async function POST(
  request: NextRequest,
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

    const body = await request.json();
    const type: RecapType = body.type || "thank_you";

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Build RSVP query based on type
    const whereClause: any = { eventId };
    let jobType: string;
    let emailSubject: string;

    switch (type) {
      case "thank_you":
        whereClause.checkedInAt = { not: null };
        jobType = "thank_you_email";
        emailSubject = `Thanks for attending ${event.title}!`;
        break;
      case "no_show":
        whereClause.status = { in: ["ATTENDING", "attending"] };
        whereClause.checkedInAt = null;
        whereClause.checkInMethod = null;
        jobType = "no_show_email";
        emailSubject = `We missed you at ${event.title}`;
        break;
      case "walk_in_followup":
        whereClause.checkInMethod = "walk_in";
        jobType = "walk_in_followup_email";
        emailSubject = `Great meeting you at ${event.title}!`;
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const rsvps = await prisma.eventRSVP.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    // Create workflow job
    const job = await prisma.eventWorkflowJob.create({
      data: {
        id: nanoid(12),
        eventId,
        jobType,
        status: "running",
        startedAt: new Date(),
        jobData: { type, recipientCount: rsvps.length },
      },
    });

    // Send emails
    let sent = 0;
    let failed = 0;

    for (const rsvp of rsvps) {
      if (!rsvp.user?.email) {
        failed++;
        continue;
      }

      let html: string;
      const name = rsvp.user.name || "there";

      switch (type) {
        case "thank_you":
          html = thankYouEmailHtml(
            name,
            event.title,
            rsvp.checkedInAt!.toISOString()
          );
          break;
        case "no_show":
          html = missedYouEmailHtml(name, event.title);
          break;
        case "walk_in_followup":
          html = walkInFollowUpEmailHtml(name, event.title);
          break;
      }

      const result = await sendEmail({
        to: rsvp.user.email,
        subject: emailSubject,
        html,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    // Update job
    await prisma.eventWorkflowJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        result: { emailsSent: sent, emailsFailed: failed },
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      emailsSent: sent,
      emailsFailed: failed,
      message: `${sent} ${type.replace(/_/g, " ")} emails sent`,
    });
  } catch (error: any) {
    console.error("Error sending recap emails:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
