import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
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
    } else {
      console.log('Not creating organization. accountType:', accountType, 'organizationName:', organizationName);
    }

    // Set session cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      message: 'Account created successfully',
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