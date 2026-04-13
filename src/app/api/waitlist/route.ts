// @idor-allow: public-read reason="Waitlist signup is anonymous by design"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, type } = body;

    if (!email || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: email, type' },
        { status: 400 }
      );
    }

    // Validate type
    if (type !== 'VENDOR' && type !== 'INDIVIDUAL') {
      return NextResponse.json(
        { error: 'Invalid type. Must be VENDOR or INDIVIDUAL' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create waitlist signup (upsert to handle duplicates gracefully)
    // Don't reveal if email already exists for privacy
    await prisma.waitlistSignup.upsert({
      where: {
        email_type: {
          email,
          type,
        },
      },
      update: {}, // Do nothing if already exists
      create: {
        email,
        type,
      },
    });

    return NextResponse.json({
      success: true,
      message: "You're on the list.",
    });
  } catch (error) {
    console.error('Error adding to waitlist:', error);
    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    );
  }
}
