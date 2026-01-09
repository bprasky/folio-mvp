export const dynamic = 'force-dynamic';

// NOTE (designer onboarding):
// This file contains the logic that creates a Designer account for the first time.
// New designers are created with PENDING status and redirected to /pending-approval.
// After admin approval and onboarding completion, they can access the designer dashboard.
//
// Phase 1 (Designer Publishing Wedge): Only designers can sign up through this endpoint.
// Vendors and Individuals are directed to the waitlist instead.

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
      role,
      accountType,
      organizationName,
      organizationDescription,
      website
    } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password, role' },
        { status: 400 }
      );
    }

    // Website is required for designers (for admin approval)
    if (role === 'DESIGNER' && !website) {
      return NextResponse.json(
        { error: 'Website URL is required for designer accounts' },
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
        role,
        website: role === 'DESIGNER' ? website : undefined,
      },
    });

    // If organization account, create organization and link user
    if (accountType === 'organization' && organizationName) {
      console.log('Creating organization with:', {
        name: organizationName,
        description: organizationDescription,
        type: role === 'VENDOR' ? 'VENDOR' : 'DESIGN_FIRM',
        userId: user.id
      });
      
      const organization = await prisma.organization.create({
        data: {
          name: organizationName,
          description: organizationDescription,
          type: role === 'VENDOR' ? 'VENDOR' : 'DESIGN_FIRM',
          users: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });
      
      console.log('Created organization:', organization);
    } else {
      console.log('Not creating organization. accountType:', accountType, 'organizationName:', organizationName);
    }

    // For designers: create empty brand profile (can be configured later in profile settings)
    if (role === 'DESIGNER') {
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
