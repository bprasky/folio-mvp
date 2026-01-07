import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CONCEPT_IMAGE_MARKER } from '@/lib/approvals-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roomId = params.id;
  const userId = session.user.id;

  // Get room and verify access
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      project: {
        select: { id: true, ownerId: true, designerId: true, title: true },
      },
    },
  });

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const project = room.project;
  if (project.ownerId !== userId && project.designerId !== userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    // DEMO HEURISTIC: Check if concept image already exists for this room (idempotent)
    // We identify concept images by the naming convention — see CONCEPT_IMAGE_MARKER
    const existingImage = await prisma.projectImage.findFirst({
      where: {
        projectId: project.id,
        room: room.name,
        name: { contains: CONCEPT_IMAGE_MARKER },
      },
    });

    if (existingImage) {
      return NextResponse.json({
        generated: false,
        message: 'Concept image already exists for this room',
        imageId: existingImage.id,
      });
    }

    // For demo: Create a placeholder image entry
    // In production, this would call the nano banana API or similar
    // and upload the generated image to storage
    
    // Create a placeholder concept image
    // DEMO HEURISTIC: Name includes CONCEPT_IMAGE_MARKER for detection
    const placeholderUrl = `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(room.name + ' Concept')}`;
    
    const image = await prisma.projectImage.create({
      data: {
        projectId: project.id,
        url: placeholderUrl,
        name: `${room.name} - ${CONCEPT_IMAGE_MARKER}`,
        room: room.name,
      },
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[generate-concept-image] Created:', {
        roomId,
        roomName: room.name,
        imageId: image.id,
      });
    }

    return NextResponse.json({
      generated: true,
      message: `Concept image generated for ${room.name}`,
      imageId: image.id,
      imageUrl: image.url,
    });
  } catch (error) {
    console.error('[generate-concept-image] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate concept image' },
      { status: 500 }
    );
  }
}

