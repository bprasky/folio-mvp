export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

// GET pinned items for current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [projects, media, recognition, collaborations] = await Promise.all([
    prisma.project.findMany({
      where: { designerId: session.user.id, pinnedAt: { not: null } },
      orderBy: { pinOrder: 'asc' },
      include: {
        images: { take: 1, orderBy: { displayOrder: 'asc' } },
      },
    }),
    prisma.media.findMany({
      where: { userId: session.user.id, pinnedAt: { not: null } },
      orderBy: { pinOrder: 'asc' },
    }),
    prisma.recognition.findMany({
      where: { userId: session.user.id, pinnedAt: { not: null } },
      orderBy: { pinOrder: 'asc' },
    }),
    prisma.collaboration.findMany({
      where: { userId: session.user.id, pinnedAt: { not: null } },
      orderBy: { pinOrder: 'asc' },
      include: {
        vendor: { select: { name: true, logo: true } },
        partner: { select: { name: true, profileImage: true } },
      },
    }),
  ]);

  const pinned = [
    ...projects.map(p => ({
      id: p.id,
      type: 'project',
      data: {
        ...p,
        imageUrl: p.images?.[0]?.url,
        saveCount: p.saves || 0,
      },
      pinOrder: p.pinOrder,
    })),
    ...media.map(m => ({
      id: m.id,
      type: 'media',
      data: m,
      pinOrder: m.pinOrder,
    })),
    ...recognition.map(r => ({
      id: r.id,
      type: 'recognition',
      data: r,
      pinOrder: r.pinOrder,
    })),
    ...collaborations.map(c => ({
      id: c.id,
      type: 'collaboration',
      data: {
        ...c,
        partnerName: c.partnerName || c.partner?.name || c.vendor?.name,
        partnerLogo: c.partnerLogoUrl || c.partner?.profileImage || c.vendor?.logo,
      },
      pinOrder: c.pinOrder,
    })),
  ].sort((a, b) => (a.pinOrder || 0) - (b.pinOrder || 0));

  return NextResponse.json({ pinned });
}

// POST to pin/unpin item
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { itemId, itemType, action, pinOrder } = await request.json();

  // Validate ownership based on item type
  const ownershipChecks: Record<string, () => Promise<boolean>> = {
    project: async () => {
      const project = await prisma.project.findUnique({
        where: { id: itemId },
        select: { designerId: true },
      });
      return project?.designerId === session.user.id;
    },
    media: async () => {
      const media = await prisma.media.findUnique({
        where: { id: itemId },
        select: { userId: true },
      });
      return media?.userId === session.user.id;
    },
    recognition: async () => {
      const recognition = await prisma.recognition.findUnique({
        where: { id: itemId },
        select: { userId: true },
      });
      return recognition?.userId === session.user.id;
    },
    collaboration: async () => {
      const collaboration = await prisma.collaboration.findUnique({
        where: { id: itemId },
        select: { userId: true },
      });
      return collaboration?.userId === session.user.id;
    },
  };

  const checkOwnership = ownershipChecks[itemType];
  if (!checkOwnership) {
    return NextResponse.json({ error: 'Invalid item type' }, { status: 400 });
  }

  const isOwner = await checkOwnership();
  if (!isOwner) {
    return NextResponse.json({ error: 'Not authorized to modify this item' }, { status: 403 });
  }

  // Perform the action
  const updateData =
    action === 'pin'
      ? { pinnedAt: new Date(), pinOrder: pinOrder || 0 }
      : action === 'unpin'
        ? { pinnedAt: null, pinOrder: null }
        : action === 'reorder'
          ? { pinOrder }
          : null;

  if (!updateData) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // Update the item based on type
  switch (itemType) {
    case 'project':
      await prisma.project.update({
        where: { id: itemId },
        data: updateData,
      });
      break;
    case 'media':
      await prisma.media.update({
        where: { id: itemId },
        data: updateData,
      });
      break;
    case 'recognition':
      await prisma.recognition.update({
        where: { id: itemId },
        data: updateData,
      });
      break;
    case 'collaboration':
      await prisma.collaboration.update({
        where: { id: itemId },
        data: updateData,
      });
      break;
  }

  return NextResponse.json({ success: true });
}
