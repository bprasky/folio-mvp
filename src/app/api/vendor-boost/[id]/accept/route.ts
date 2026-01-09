export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
    const requestId = params.id;

    // Fetch the boost request
    const boostRequest = await prisma.vendorBoostRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        requestedDesignerId: true,
        vendorId: true,
        productId: true,
        projectId: true,
        expiresAt: true,
      },
    });

    if (!boostRequest) {
      return NextResponse.json({ error: "Vendor boost request not found" }, { status: 404 });
    }

    // Verify user is the requested designer
    if (boostRequest.requestedDesignerId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: not the requested designer" },
        { status: 403 }
      );
    }

    // Check request is still valid
    if (boostRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: `Request is ${boostRequest.status}, cannot accept` },
        { status: 400 }
      );
    }

    if (boostRequest.expiresAt && boostRequest.expiresAt < new Date()) {
      // Auto-expire
      await prisma.vendorBoostRequest.update({
        where: { id: requestId },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Request has expired" },
        { status: 400 }
      );
    }

    // Create InterviewSession for the product interview
    const interviewSession = await prisma.interviewSession.create({
      data: {
        createdByUserId: userId,
        productId: boostRequest.productId,
        vendorId: boostRequest.vendorId,
        vendorBoostRequestId: requestId,
        mode: "AUDIO",
        status: "DRAFT",
        recordedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    // Update boost request to ACCEPTED and link interview session
    const updated = await prisma.vendorBoostRequest.update({
      where: { id: requestId },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        interviewSessionId: interviewSession.id,
      },
      select: {
        id: true,
        status: true,
        interviewSessionId: true,
        acceptedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      vendorBoostRequest: updated,
      interviewSession,
    });
  } catch (error) {
    console.error("[vendor-boost/accept] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

