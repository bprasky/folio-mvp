import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  try {
    // Check maintenance token
    const maintenanceToken = request.headers.get('x-maintenance-token');
    const expectedToken = process.env.MAINTENANCE_TOKEN;
    
    if (!maintenanceToken || maintenanceToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    if (!['ADMIN', 'VENDOR', 'DESIGNER'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be ADMIN, VENDOR, or DESIGNER' }, { status: 400 });
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        name: true
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: `Role elevated to ${role} for ${email}`
    });

  } catch (error) {
    console.error('Error in elevate-role:', error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'Failed to elevate role' },
      { status: 500 }
    );
  }
} 