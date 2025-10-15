import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: { productId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { projectId, sourceEventId, sourceSubEventId, notes } = body as {
    projectId?: string;
    sourceEventId?: string;
    sourceSubEventId?: string;
    notes?: string;
  };

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  // Ensure project belongs to the designer
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Validate product
  const product = await prisma.product.findUnique({ where: { id: params.productId } });
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Optional: default "Unsorted" room
  let roomId: string | null = null;
  try {
    const existing = await prisma.room.findFirst({
      where: { projectId: project.id, name: 'Unsorted' },
      select: { id: true },
    });
    const room =
      existing ??
      (await prisma.room.create({
        data: { name: 'Unsorted', projectId: project.id },
        select: { id: true },
      }));
    roomId = room.id;
  } catch {
    // If you don't use rooms, ignore
  }

  const selection = await prisma.selection.create({
    data: {
      projectId: project.id,
      productId: product.id,
      roomId: roomId ?? undefined,
      sourceEventId: sourceEventId ?? null,
      sourceSubEventId: sourceSubEventId ?? null,
      notes: notes ?? null,
    },
  });

  // Optional: engagement metric
  try {
    await prisma.engagementEvent.create({
      data: {
        userId: session.user.id,
        eventId: sourceEventId ?? '',
        productId: product.id,
        verb: 'SAVE_PRODUCT',
        meta: { sourceEventId, sourceSubEventId },
      },
    });
  } catch {}

  return NextResponse.json({ ok: true, selectionId: selection.id });
} 