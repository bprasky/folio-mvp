export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/users/[id]/follow
 * Creates a follow relationship. Auto-upgrades to CONNECTION if mutual.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: followingId } = await params;
    const followerId = session.user.id;

    if (followerId === followingId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    // Check if already following
    const existing = await prisma.userRelationship.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (existing) {
      return NextResponse.json({ error: 'Already following' }, { status: 409 });
    }

    // Check if reverse relationship exists (they follow us)
    const reverse = await prisma.userRelationship.findUnique({
      where: { followerId_followingId: { followerId: followingId, followingId: followerId } },
    });

    const isMutual = !!reverse;
    const tier = isMutual ? 'CONNECTION' : 'FOLLOW';

    // Create the relationship
    const relationship = await prisma.userRelationship.create({
      data: {
        followerId,
        followingId,
        tier,
        isMutual,
        tierUpdatedAt: new Date(),
      },
    });

    // If mutual, upgrade the reverse relationship too
    if (reverse) {
      await prisma.userRelationship.update({
        where: { id: reverse.id },
        data: {
          isMutual: true,
          tier: 'CONNECTION',
          tierUpdatedAt: new Date(),
        },
      });
    }

    // Update denormalized counts
    await prisma.$transaction([
      prisma.user.update({
        where: { id: followerId },
        data: { following: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: followingId },
        data: { followers: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({
      relationship: {
        id: relationship.id,
        tier: relationship.tier,
        isMutual: relationship.isMutual,
      },
    });
  } catch (error) {
    console.error('[users/follow] POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id]/follow
 * Removes a follow relationship. Downgrades reverse to FOLLOW if it was mutual.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: followingId } = await params;
    const followerId = session.user.id;

    const existing = await prisma.userRelationship.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not following' }, { status: 404 });
    }

    // Delete the relationship
    await prisma.userRelationship.delete({
      where: { id: existing.id },
    });

    // If it was mutual, downgrade the reverse relationship
    if (existing.isMutual) {
      const reverse = await prisma.userRelationship.findUnique({
        where: { followerId_followingId: { followerId: followingId, followingId: followerId } },
      });

      if (reverse) {
        await prisma.userRelationship.update({
          where: { id: reverse.id },
          data: {
            isMutual: false,
            tier: 'FOLLOW',
            tierUpdatedAt: new Date(),
          },
        });
      }
    }

    // Update denormalized counts
    await prisma.$transaction([
      prisma.user.update({
        where: { id: followerId },
        data: { following: { decrement: 1 } },
      }),
      prisma.user.update({
        where: { id: followingId },
        data: { followers: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[users/follow] DELETE Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
