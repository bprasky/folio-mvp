export const dynamic = 'force-dynamic';

// NOTE (Individual-First Architecture):
// All users sign up as INDIVIDUAL with APPROVED status.
// They can browse, save products, and follow designers immediately.
// Designer/vendor capabilities are unlocked through org membership (Phase 2).
//
// Individual capabilities:
// - Create and manage personal boards
// - Save products/projects from tags
// - Browse and follow designers/orgs
// - Toggle board visibility on profile
//
// Individual restrictions:
// - Cannot upload projects
// - Cannot access designer tools
// - No org-level features until org membership exists

import { NextRequest, NextResponse } from 'next/server';
import { AccountStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp, RateLimitPresets } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  // Rate limiting: Check IP-level limit (prevents mass signup from single source)
  // This is generous to avoid false positives from corporate networks/VPNs
  const clientIp = getClientIp(request.headers);
  const ipRateLimit = checkRateLimit(clientIp, {
    ...RateLimitPresets.SIGNUP_PER_IP,
    keyGenerator: (ip) => `signup-ip:${ip}`,
  });

  if (!ipRateLimit.success) {
    return NextResponse.json(
      {
        error: 'Too many signup attempts from this network. Please try again later.',
        retryAfter: Math.ceil((ipRateLimit.reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(ipRateLimit.limit),
          'X-RateLimit-Remaining': String(ipRateLimit.remaining),
          'X-RateLimit-Reset': String(ipRateLimit.reset),
          'Retry-After': String(Math.ceil((ipRateLimit.reset - Date.now()) / 1000)),
        },
      }
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[Signup API] Request received');
  }

  try {
    const body = await request.json();
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Signup API] Request body:', { ...body, password: '[REDACTED]' });
    }
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password' },
        { status: 400 }
      );
    }

    // Check if user already exists (case-insensitive)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Signup API] Checking for existing user with email:', email);
    }

    let existingUser;
    try {
      existingUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: email.toLowerCase().trim(),
            mode: 'insensitive'
          }
        },
      });
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Signup API] findFirst completed, existingUser:', existingUser ? 'found' : 'not found');
      }
    } catch (dbError) {
      console.error('[Signup API] Database error checking existing user:', dbError);
      throw new Error(`Database error checking existing user: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

    if (existingUser) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Signup API] User already exists with email:', email);
      }
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Signup API] Hashing password...');
    }

    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, 12);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Signup API] Password hashed successfully');
      }
    } catch (hashError) {
      console.error('[Signup API] Error hashing password:', hashError);
      throw new Error(`Password hashing failed: ${hashError instanceof Error ? hashError.message : String(hashError)}`);
    }

    // Individual-First: All users start as INDIVIDUAL with APPROVED status
    // No admin approval needed - they can browse immediately
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Signup API] Creating user with status: APPROVED, role: INDIVIDUAL');
    }

    let user;
    try {
      user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          passwordHash: hashedPassword,
          role: 'INDIVIDUAL',
          accountStatus: AccountStatus.APPROVED,
        },
      });
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Signup API] User created successfully with ID:', user.id);
      }
    } catch (createError) {
      console.error('[Signup API] Database error creating user:', createError);
      throw new Error(`Database error creating user: ${createError instanceof Error ? createError.message : String(createError)}`);
    }

    // Redirect to home - individuals can browse immediately
    const redirectUrl = '/';

    // Return success response
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
