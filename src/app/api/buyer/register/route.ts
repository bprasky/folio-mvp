// @idor-allow: public-read reason="Buyer registration is the entry point to the consultation flow, anonymous by design"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/buyer/register
 *
 * Registers or retrieves a consultation buyer with lightweight session auth.
 * This enables buyers to participate in consultations without full account creation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, phone } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Missing required fields: email, name" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if buyer already exists
    let buyer = await prisma.consultationBuyer.findUnique({
      where: { email },
    });

    const sessionToken = generateSessionToken();
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    if (buyer) {
      // Update existing buyer with new session
      buyer = await prisma.consultationBuyer.update({
        where: { id: buyer.id },
        data: {
          name,
          phone,
          sessionToken,
          sessionExpiresAt,
        },
      });
    } else {
      // Create new buyer
      buyer = await prisma.consultationBuyer.create({
        data: {
          email,
          name,
          phone,
          sessionToken,
          sessionExpiresAt,
        },
      });
    }

    // Get buyer's consultation history
    const consultations = await prisma.consultation.findMany({
      where: { buyerId: buyer.id },
      include: {
        development: {
          select: {
            id: true,
            name: true,
            slug: true,
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
      take: 10,
    });

    return NextResponse.json({
      buyer: {
        id: buyer.id,
        email: buyer.email,
        name: buyer.name,
        phone: buyer.phone,
      },
      sessionToken: buyer.sessionToken,
      sessionExpiresAt: buyer.sessionExpiresAt,
      consultations,
    });

  } catch (error: any) {
    console.error("Error registering buyer:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to register buyer" },
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
