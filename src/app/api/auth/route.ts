import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, role } = body;

    // Simple user creation/authentication for testing
    const user = await prisma.user.upsert({
      where: { email: email || 'test@example.com' },
      update: {},
      create: {
        email: email || 'test@example.com',
        name: name || 'Test User',
        role: role || 'DESIGNER',
        passwordHash: 'temp-password-hash', // Required field
        location: 'New York, NY'
      }
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Return current user info (simplified for testing)
    return NextResponse.json({
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get user info' },
      { status: 500 }
    );
  }
} 