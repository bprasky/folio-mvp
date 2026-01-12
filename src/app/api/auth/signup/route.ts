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
import { PrismaClient, AccountStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password' },
        { status: 400 }
      );
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: email.toLowerCase().trim(),
          mode: 'insensitive'
        }
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Individual-First: All users start as INDIVIDUAL with APPROVED status
    // No admin approval needed - they can browse immediately
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash: hashedPassword,
        role: 'INDIVIDUAL',
        accountStatus: AccountStatus.APPROVED,
      },
    });

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
    console.error('Error signing up:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
