export const dynamic = 'force-dynamic';

// NOTE (designer onboarding):
// This file contains the logic that creates a Designer account for the first time.
// New designers are created with PENDING status and redirected to /pending-approval.
// After admin approval and onboarding completion, they can access the designer dashboard.

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
      organizationDescription 
    } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password, role' },
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

    // Determine account status: PENDING for designers, APPROVED for others
    const accountStatus = role === 'DESIGNER' ? AccountStatus.PENDING : AccountStatus.APPROVED;

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role,
        accountStatus,
        // Set approvedAt for non-designers since they're auto-approved
        ...(role !== 'DESIGNER' && { approvedAt: new Date() }),
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

    // For designers: create brand profile and redirect to pending-approval
    // The actual onboarding will happen after admin approval
    let redirectUrl: string | undefined;
    if (role === 'DESIGNER') {
      try {
        await createEmptyDesignerBrandProfile(user.id);
        // Redirect to pending approval page - they need admin approval first
        redirectUrl = '/pending-approval';
      } catch (error) {
        console.error('Error creating brand profile:', error);
        // Continue even if brand profile creation fails
        redirectUrl = '/pending-approval';
      }
    }

    // Set session cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
      },
      message: 'Account created successfully',
      redirectUrl, // Include redirect URL for designers (pending-approval)
    });

    response.cookies.set('folio-session', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Error signing up:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
} 