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

    // Check if already on waitlist
    const existing = await prisma.waitlistSignup.findUnique({
      where: {
        email_type: {
          email,
          type,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        message: "You're already on the waitlist! We'll be in touch soon.",
        alreadyExists: true,
      });
    }

    // Create waitlist signup
    await prisma.waitlistSignup.create({
      data: {
        email,
        type,
      },
    });

    return NextResponse.json({
      message: "Thanks for your interest! We'll notify you when we're ready.",
      success: true,
    });
  } catch (error) {
    console.error('Error adding to waitlist:', error);
    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    );
  }
}
