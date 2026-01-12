export const dynamic = 'force-dynamic';

// NOTE (individual-first architecture):
// This file creates new user accounts with the INDIVIDUAL role by default.
// Users can later create or join organizations to gain DESIGNER or VENDOR roles.
//
// Legacy DESIGNER accounts (from phase 1) still go through approval workflow.
// New INDIVIDUAL accounts are auto-approved and go straight to onboarding.

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, AccountStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createEmptyDesignerBrandProfile } from '@/lib/server/designerBrandProfile';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      password,
      role = 'INDIVIDUAL', // Default to INDIVIDUAL if not specified
    } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password' },
        { status: 400 }
      );
    }

    // Validate role is one of the allowed values
    const allowedRoles = ['INDIVIDUAL', 'DESIGNER', 'VENDOR'];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role specified' },
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

    // Individual users are auto-approved, legacy designers need approval
    const accountStatus = role === 'INDIVIDUAL'
      ? AccountStatus.APPROVED
      : AccountStatus.PENDING;

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role,
        accountStatus,
      },
    });

    // Only create DesignerBrandProfile for DESIGNER role (legacy phase 1 flow)
    let redirectUrl: string = '/onboarding';
    if (role === 'DESIGNER') {
      redirectUrl = '/pending-approval';
      try {
        await createEmptyDesignerBrandProfile(user.id);
      } catch (error) {
        console.error('Error creating brand profile:', error);
        // Continue even if brand profile creation fails
      }
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
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
