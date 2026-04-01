export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/directory/bookmarks
 * Returns the current user's bookmarked professional IDs
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookmarks = await prisma.directoryBookmark.findMany({
      where: { userId: session.user.id },
      select: { professionalId: true },
    });

    return NextResponse.json({
      bookmarkedIds: bookmarks.map(b => b.professionalId),
    });
  } catch (error) {
    console.error('[API] /api/directory/bookmarks GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch bookmarks' }, { status: 500 });
  }
}

/**
 * POST /api/directory/bookmarks
 * Create a bookmark. Body: { professionalId }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { professionalId } = await request.json();

    if (!professionalId || typeof professionalId !== 'string') {
      return NextResponse.json({ error: 'professionalId is required' }, { status: 400 });
    }

    // Prevent self-bookmarking
    if (professionalId === session.user.id) {
      return NextResponse.json({ error: 'Cannot bookmark yourself' }, { status: 400 });
    }

    const bookmark = await prisma.directoryBookmark.upsert({
      where: {
        userId_professionalId: {
          userId: session.user.id,
          professionalId,
        },
      },
      create: {
        userId: session.user.id,
        professionalId,
      },
      update: {}, // No-op if already exists
    });

    return NextResponse.json({ bookmark });
  } catch (error) {
    console.error('[API] /api/directory/bookmarks POST error:', error);
    return NextResponse.json({ error: 'Failed to create bookmark' }, { status: 500 });
  }
}

/**
 * DELETE /api/directory/bookmarks
 * Remove a bookmark. Body: { professionalId }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { professionalId } = await request.json();

    if (!professionalId || typeof professionalId !== 'string') {
      return NextResponse.json({ error: 'professionalId is required' }, { status: 400 });
    }

    await prisma.directoryBookmark.deleteMany({
      where: {
        userId: session.user.id,
        professionalId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] /api/directory/bookmarks DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove bookmark' }, { status: 500 });
  }
}
