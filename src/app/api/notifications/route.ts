export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * In-app notifications for the signed-in user (the bell dropdown).
 *
 * GET   → { items, unreadCount } — most recent notifications, unread first.
 * PATCH { id } | { all: true } → mark one or all of the user's notifications read.
 *
 * Surfaces the previously-dead Notification model; writes already exist across
 * the app (TAG_REVIEW_READY, PRODUCT_NEEDS_DETAILS, REP_HELP_NEEDED, …).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ items: [], unreadCount: 0 });
  }

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
  ]);

  return NextResponse.json({ items, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, all } = await request.json();

  if (all === true) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true, readAt: new Date() },
    });
    return NextResponse.json({ success: true });
  }

  if (!id) {
    return NextResponse.json({ error: 'id or all required' }, { status: 400 });
  }

  // Scope to owner so a user can only mark their own notifications read.
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true, readAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
