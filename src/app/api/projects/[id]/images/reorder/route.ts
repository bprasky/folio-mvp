/**
 * API route to reorder project images
 * PATCH /api/projects/[id]/images/reorder
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { z } from 'zod';

const ReorderSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const projectId = params.id;

    // Verify project access
    await assertProjectView(userId, projectId);

    // Parse request body
    const body = await request.json();
    const { imageIds } = ReorderSchema.parse(body);

    // Verify all images belong to this project
    const images = await prisma.projectImage.findMany({
      where: {
        id: { in: imageIds },
        projectId,
      },
      select: { id: true },
    });

    if (images.length !== imageIds.length) {
      return NextResponse.json(
        { error: 'Some images not found or do not belong to this project' },
        { status: 400 }
      );
    }

    // Update displayOrder for each image
    await prisma.$transaction(
      imageIds.map((imageId, index) =>
        prisma.projectImage.update({
          where: { id: imageId },
          data: { displayOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request', issues: error.issues },
        { status: 400 }
      );
    }

    if (error.message === 'Forbidden' || error.message === 'NotFound') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error('[reorder-images] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reorder images' },
      { status: 500 }
    );
  }
}

