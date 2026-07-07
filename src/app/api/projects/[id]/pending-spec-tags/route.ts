/**
 * GET /api/projects/[id]/pending-spec-tags
 *
 * List the project's unplaced finish-schedule products — PendingProductTag rows
 * (source = SPEC) that are still UNREVIEWED and not yet anchored to a photo. The
 * tagging surface renders these as a "place them on a photo" tray.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { assertProjectWrite } from '@/lib/authz/access';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch {
      return NextResponse.json({ error: 'Project not found or not permitted' }, { status: 403 });
    }

    const tags = await prisma.pendingProductTag.findMany({
      where: {
        source: 'SPEC',
        status: 'UNREVIEWED',
        projectImageId: null,
        importSession: { projectId },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        description: true,
        category: true,
        roomType: true,
        extractedVendor: true,
        extractedPrice: true,
        extractedSku: true,
        extractedDimensions: true,
        extractedMaterial: true,
        extractedProductUrl: true,
      },
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('[pending-spec-tags] error:', error);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}
