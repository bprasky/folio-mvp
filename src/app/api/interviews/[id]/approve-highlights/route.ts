export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ApproveHighlightsSchema = z.object({
  highlightIds: z.array(z.string()).min(1),
  rejectIds: z.array(z.string()).optional().default([]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const interviewId = params.id;

    // Verify interview session exists and user owns it
    const interviewSession = await prisma.interviewSession.findUnique({
      where: { id: interviewId },
      select: { createdByUserId: true, status: true },
    });

    if (!interviewSession) {
      return NextResponse.json({ error: "Interview session not found" }, { status: 404 });
    }

    if (interviewSession.createdByUserId !== userId) {
      return NextResponse.json({ error: "Forbidden: not interview owner" }, { status: 403 });
    }

    if (interviewSession.status !== "EXTRACTED" && interviewSession.status !== "READY") {
      return NextResponse.json(
        { error: `Cannot approve: interview is in ${interviewSession.status} status` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = ApproveHighlightsSchema.parse(body);

    // Approve highlights
    await prisma.quoteHighlight.updateMany({
      where: {
        id: { in: parsed.highlightIds },
        interviewSessionId: interviewId,
      },
      data: {
        approvedByDesigner: true,
        approvedAt: new Date(),
      },
    });

    // Delete rejected highlights
    if (parsed.rejectIds && parsed.rejectIds.length > 0) {
      await prisma.quoteHighlight.deleteMany({
        where: {
          id: { in: parsed.rejectIds },
          interviewSessionId: interviewId,
        },
      });
    }

    // Check if we have any approved highlights
    const approvedCount = await prisma.quoteHighlight.count({
      where: {
        interviewSessionId: interviewId,
        approvedByDesigner: true,
      },
    });

    // Update interview session status to READY if we have approved highlights
    const updated = await prisma.interviewSession.update({
      where: { id: interviewId },
      data: {
        status: approvedCount > 0 ? "READY" : interviewSession.status,
      },
      select: {
        id: true,
        status: true,
      },
    });

    return NextResponse.json({
      ok: true,
      approvedCount: parsed.highlightIds.length,
      rejectedCount: parsed.rejectIds?.length || 0,
      interviewSession: updated,
    });
  } catch (error) {
    console.error("[interviews/approve-highlights] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



