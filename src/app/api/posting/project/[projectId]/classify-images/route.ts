export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectEdit } from '@/lib/authz/access';
import { indexMoment } from '@/lib/search/indexMoment';

/**
 * POST /api/posting/project/[projectId]/classify-images
 *
 * Triggers AI classification on all unclassified images in the project.
 * Called from the interview preparation modal as an on-demand gate.
 *
 * This is the same pipeline that runs at upload time (indexMoment),
 * but catches images that were uploaded before classification existed
 * or where the initial classification silently failed.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;
    await assertProjectEdit(session.user.id, projectId);

    // Find images that haven't been classified yet
    const unclassified = await prisma.projectImage.findMany({
      where: {
        projectId,
        aiClassification: null,
      },
      select: { id: true },
    });

    if (unclassified.length === 0) {
      return NextResponse.json({ classified: 0, total: 0 });
    }

    // Classify each image (sequentially to avoid API rate limits)
    let classified = 0;
    for (const image of unclassified) {
      try {
        await indexMoment(image.id);
        classified++;
      } catch (err) {
        console.error(`[classify-images] Failed to classify ${image.id}:`, err);
        // Continue with remaining images
      }
    }

    return NextResponse.json({
      classified,
      total: unclassified.length,
    });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[classify-images] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
