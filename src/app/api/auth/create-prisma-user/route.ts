import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userId,
      name, 
      email, 
      role, 
      accountType, 
      organizationName, 
      organizationDescription 
    } = body;

    if (!userId || !name || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, name, email, role' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        id: userId, // Use Supabase auth user ID
        name,
        email,
        role,
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
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      message: 'Prisma user created successfully',
    });
  } catch (error) {
    console.error('Error creating Prisma user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
} 