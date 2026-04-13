// @idor-allow: token-access reason="Buyer sessionToken is the bearer credential; all queries scope to the buyer resolved from the token"
// @idor-allow: IDOR004 reason="Updates operate on buyer.id derived from a prior sessionToken-scoped findFirst"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/buyer/auth
 *
 * Validates a buyer session token and returns buyer info.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: "Missing token parameter" },
        { status: 400 }
      );
    }

    const buyer = await prisma.consultationBuyer.findFirst({
      where: {
        sessionToken: token,
        sessionExpiresAt: { gt: new Date() },
      },
    });

    if (!buyer) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Get active consultations
    const activeConsultations = await prisma.consultation.findMany({
      where: {
        buyerId: buyer.id,
        status: { in: ['DRAFT', 'IN_PROGRESS', 'AWAITING_REVIEW'] },
      },
      include: {
        development: {
          select: {
            id: true,
            name: true,
            slug: true,
            heroImageUrl: true,
          },
        },
        unitType: {
          select: {
            id: true,
            name: true,
          },
        },
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      buyer: {
        id: buyer.id,
        email: buyer.email,
        name: buyer.name,
        phone: buyer.phone,
      },
      sessionExpiresAt: buyer.sessionExpiresAt,
      activeConsultations,
    });

  } catch (error: any) {
    console.error("Error validating buyer session:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to validate session" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/buyer/auth
 *
 * Refreshes a buyer session token (extends expiration).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );
    }

    const buyer = await prisma.consultationBuyer.findFirst({
      where: {
        sessionToken: token,
        sessionExpiresAt: { gt: new Date() },
      },
    });

    if (!buyer) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Generate new token and extend expiration
    const newToken = generateSessionToken();
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const updated = await prisma.consultationBuyer.update({
      where: { id: buyer.id },
      data: {
        sessionToken: newToken,
        sessionExpiresAt,
      },
    });

    return NextResponse.json({
      buyer: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone,
      },
      sessionToken: updated.sessionToken,
      sessionExpiresAt: updated.sessionExpiresAt,
    });

  } catch (error: any) {
    console.error("Error refreshing buyer session:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to refresh session" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/buyer/auth
 *
 * Logs out a buyer (invalidates session token).
 */
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: "Missing token parameter" },
        { status: 400 }
      );
    }

    const buyer = await prisma.consultationBuyer.findFirst({
      where: { sessionToken: token },
    });

    if (!buyer) {
      return NextResponse.json({ success: true, message: "Already logged out" });
    }

    // Clear session token
    await prisma.consultationBuyer.update({
      where: { id: buyer.id },
      data: {
        sessionToken: null,
        sessionExpiresAt: null,
      },
    });

    return NextResponse.json({ success: true, message: "Logged out successfully" });

  } catch (error: any) {
    console.error("Error logging out buyer:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to log out" },
      { status: 500 }
    );
  }
}

/**
 * Generate a secure session token.
 */
function generateSessionToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
