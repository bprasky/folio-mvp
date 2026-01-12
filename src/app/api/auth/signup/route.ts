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
import { prisma } from '@/lib/prisma';
import { createEmptyDesignerBrandProfile } from '@/lib/server/designerBrandProfile';

export async function POST(request: NextRequest) {
  console.log('[Signup API] Request received');
  try {
    const body = await request.json();
    console.log('[Signup API] Request body:', { ...body, password: '[REDACTED]' });
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
    console.log('[Signup API] Checking for existing user with email:', email);
    let existingUser;
    try {
      existingUser = await prisma.user.findUnique({
        where: { email },
      });
      console.log('[Signup API] findUnique completed, existingUser:', existingUser ? 'found' : 'not found');
    } catch (dbError) {
      console.error('[Signup API] Database error checking existing user:', dbError);
      throw new Error(`Database error checking existing user: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

    if (existingUser) {
      console.log('[Signup API] User already exists with email:', email);
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    console.log('[Signup API] Hashing password...');
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, 12);
      console.log('[Signup API] Password hashed successfully');
    } catch (hashError) {
      console.error('[Signup API] Error hashing password:', hashError);
      throw new Error(`Password hashing failed: ${hashError instanceof Error ? hashError.message : String(hashError)}`);
    }

    // Designers start with PENDING status and need admin approval
    const accountStatus = AccountStatus.PENDING;
    console.log('[Signup API] Creating user with status:', accountStatus);

    // Create user (always personal account in Phase 1)
    let user;
    try {
      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: hashedPassword,
          role: 'DESIGNER',
          accountStatus,
        },
      });
      console.log('[Signup API] User created successfully with ID:', user.id);
    } catch (createError) {
      console.error('[Signup API] Database error creating user:', createError);
      throw new Error(`Database error creating user: ${createError instanceof Error ? createError.message : String(createError)}`);
    }

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
    console.error('[Signup API] Error signing up:', error);
    console.error('[Signup API] Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('[Signup API] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[Signup API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Return more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? `Failed to create account: ${error.message}`
      : 'Failed to create account';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
