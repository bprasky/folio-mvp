import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/demo/switch-role
 * Allows demo@folio.com to switch between INDIVIDUAL, DESIGNER, and VENDOR roles
 * ONLY works for demo@folio.com - no other users can use this endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // STRICT: Only allow demo@folio.com or admin users
    const userEmail = session.user.email?.toLowerCase();
    const userRole = session.user.role?.toUpperCase();
    const isDemoUser = userEmail === 'demo@folio.com';
    const isAdmin = userRole === 'ADMIN';
    
    if (!isDemoUser && !isAdmin) {
      return NextResponse.json(
        { error: 'This feature is only available for demo@folio.com or admin users' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role } = body;

    // Validate role
    const allowedRoles = ['INDIVIDUAL', 'DESIGNER', 'VENDOR'];
    if (!role || !allowedRoles.includes(role.toUpperCase())) {
      return NextResponse.json(
        { error: 'Invalid role. Must be INDIVIDUAL, DESIGNER, or VENDOR' },
        { status: 400 }
      );
    }

    const newRole = role.toUpperCase();

    // Update user role in database
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: `Role switched to ${newRole}`,
    });
  } catch (error: any) {
    console.error('[demo/switch-role] Error:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to switch role', details: error.message },
      { status: 500 }
    );
  }
}

