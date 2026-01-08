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
        { error: `Request is ${boostRequest.status}, cannot decline` },
        { status: 400 }
      );
    }

    // Update boost request to DECLINED
    const updated = await prisma.vendorBoostRequest.update({
      where: { id: requestId },
      data: {
        status: "DECLINED",
        declinedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        declinedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      vendorBoostRequest: updated,
    });
  } catch (error) {
    console.error("[vendor-boost/decline] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

