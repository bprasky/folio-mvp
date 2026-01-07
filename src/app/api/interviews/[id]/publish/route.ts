import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

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
      select: {
        createdByUserId: true,
        status: true,
        highlights: {
          where: { approvedByDesigner: true },
          select: { id: true },
        },
      },
    });

    if (!interviewSession) {
      return NextResponse.json({ error: "Interview session not found" }, { status: 404 });
    }

    if (interviewSession.createdByUserId !== userId) {
      return NextResponse.json({ error: "Forbidden: not interview owner" }, { status: 403 });
    }

    if (interviewSession.status !== "READY") {
      return NextResponse.json(
        { error: `Cannot publish: interview is in ${interviewSession.status} status. Must be READY.` },
        { status: 400 }
      );
    }

    if (interviewSession.highlights.length === 0) {
      return NextResponse.json(
        { error: "Cannot publish: no approved highlights" },
        { status: 400 }
      );
    }

    // Update interview session to PUBLISHED
    const updated = await prisma.interviewSession.update({
      where: { id: interviewId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        publishedAt: true,
      },
    });

    // If this is a vendor boost request, mark it as completed
    const interviewWithRequest = await prisma.interviewSession.findUnique({
      where: { id: interviewId },
      select: { vendorBoostRequestId: true },
    });

    if (interviewWithRequest?.vendorBoostRequestId) {
      await prisma.vendorBoostRequest.update({
        where: { id: interviewWithRequest.vendorBoostRequestId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      interviewSession: updated,
    });
  } catch (error) {
    console.error("[interviews/publish] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



