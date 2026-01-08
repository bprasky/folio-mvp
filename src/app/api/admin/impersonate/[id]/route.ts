import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

const IMPERSONATION_COOKIE = 'folio-impersonation';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is admin
    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    if (adminUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: targetUserId } = params;

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, name: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cannot impersonate other admins
    if (targetUser.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot impersonate admin users' },
        { status: 400 }
      );
    }

    // Create impersonation log
    await prisma.impersonationLog.create({
      data: {
        adminId: session.user.id,
        targetUserId: targetUserId,
      },
    });

    // Store impersonation data in a secure cookie
    const impersonationData = JSON.stringify({
      originalAdminId: session.user.id,
      originalAdminEmail: adminUser.email,
      targetUserId: targetUserId,
      targetUserName: targetUser.name,
      targetUserEmail: targetUser.email,
      startedAt: new Date().toISOString(),
    });

    const response = NextResponse.json({
      success: true,
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    });

    // Set the impersonation cookie
    response.cookies.set(IMPERSONATION_COOKIE, impersonationData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 4, // 4 hours max
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error starting impersonation:', error);
    return NextResponse.json(
      { error: 'Failed to start impersonation' },
      { status: 500 }
    );
  }
}
