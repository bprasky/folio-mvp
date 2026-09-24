import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Retired direct enrollment: membership now requires the shared access flow. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.mode === 'join' && typeof body.organizationId === 'string') {
    const membership = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id, organizationId: body.organizationId, isActive: true },
      select: { id: true },
    });
    if (!membership) return NextResponse.json({ error: 'Request access to this firm first.', nextPath: '/auth/org-setup' }, { status: 403 });
  }
  return NextResponse.json({ error: 'Firm setup has moved.', nextPath: '/auth/org-setup' }, { status: 410 });
}
