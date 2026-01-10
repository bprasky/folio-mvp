export const dynamic = 'force-dynamic';

// NOTE (designer onboarding):
// This file contains the logic that creates a Designer account for the first time.
// New designers are created with PENDING status and redirected to /pending-approval.
// After admin approval and onboarding completion, they can access the designer dashboard.
//
// Phase 1 (Designer Publishing Wedge): Only designers can sign up through this endpoint.
// Vendors and Individuals are directed to the waitlist instead.

import { NextRequest, NextResponse } from 'next/server';
import { AccountStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createEmptyDesignerBrandProfile } from '@/lib/server/designerBrandProfile';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      password,
      role,
    } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password, role' },
        { status: 400 }
      );
    }

    // Phase 1: Only allow DESIGNER signups
    if (role !== 'DESIGNER') {
      return NextResponse.json(
        { error: 'Only designer accounts are currently available. Please join the waitlist for other account types.' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Designers start with PENDING status and need admin approval
    const accountStatus = AccountStatus.PENDING;

    // Create user (always personal account in Phase 1)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role: 'DESIGNER',
        accountStatus,
      },
    });

    // Create brand profile and redirect to pending-approval
    let redirectUrl: string = '/pending-approval';
    try {
      await createEmptyDesignerBrandProfile(user.id);
    } catch (error) {
      console.error('Error creating brand profile:', error);
      // Continue even if brand profile creation fails
    }

    // Return success response (no folio-session cookie - only NextAuth session is used)
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
      },
      message: 'Account created successfully',
      redirectUrl,
    });
  } catch (error) {
    console.error('Error signing up:', error);

    // Handle specific Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: { target?: string[] } };

      // Unique constraint violation (e.g., email already exists)
      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        );
      }

      // Database connection error
      if (prismaError.code === 'P1001' || prismaError.code === 'P1002') {
        return NextResponse.json(
          { error: 'Unable to connect to database. Please try again later.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
