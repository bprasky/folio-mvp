import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: NextRequest) {
  // Only allow in non-production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: 'Forbidden in production' }, { status: 403 });
  }

  // Require maintenance token header
  const maintenanceToken = request.headers.get('x-maintenance-token');
  if (maintenanceToken !== process.env.MAINTENANCE_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Hash password with bcrypt (10 rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upsert user with role "ADMIN"
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: hashedPassword,
        role: 'ADMIN',
      },
      create: {
        email,
        passwordHash: hashedPassword,
        role: 'ADMIN',
        name: email.split('@')[0], // Use email prefix as name
      },
    });

    // Return user data (excluding password)
    return NextResponse.json({
      id: user.id,
      email: user.email,
      role: user.role,
    });

  } catch (error) {
    console.error('Error upserting admin user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 