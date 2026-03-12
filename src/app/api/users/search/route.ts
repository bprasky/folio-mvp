export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/users/search?q=searchterm&orgId=xxx&limit=5
 * Search for Folio users by name or email
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const orgId = searchParams.get('orgId');
    const role = searchParams.get('role')?.toUpperCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

    if (!q || q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const isEmailSearch = q.includes('@');

    // Get users to exclude (current user + existing org members + pending invitees)
    let excludeUserIds: string[] = [session.user.id];
    if (orgId) {
      const members = await prisma.organizationUser.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { userId: true },
      });
      excludeUserIds.push(...members.map((m) => m.userId));

      try {
        const pendingInvites = await prisma.teamMemberInvite.findMany({
          where: { organizationId: orgId, status: 'PENDING' },
          select: { email: true },
        });
        if (pendingInvites.length > 0) {
          const invitedUsers = await prisma.user.findMany({
            where: { email: { in: pendingInvites.map((i) => i.email) } },
            select: { id: true },
          });
          excludeUserIds.push(...invitedUsers.map((u) => u.id));
        }
      } catch {
        // TeamMemberInvite model might not exist
      }
    }

    // Build where clause
    const whereClause: any = {
      id: { notIn: excludeUserIds },
    };

    if (isEmailSearch) {
      whereClause.email = q;
    } else {
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { studio: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (role && ['ADMIN', 'VENDOR', 'DESIGNER', 'HOMEOWNER', 'GUEST'].includes(role)) {
      whereClause.role = role;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profileImage: true,
        studio: true,
      },
      take: limit,
      orderBy: { name: 'asc' },
    });

    // For name searches, mask emails for privacy
    const result = users.map((u) => ({
      ...u,
      email: isEmailSearch ? u.email : maskEmail(u.email),
    }));

    return NextResponse.json({ users: result });
  } catch (error) {
    console.error('[GET /api/users/search] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = local.charAt(0) + '***';
  return `${masked}@${domain}`;
}
