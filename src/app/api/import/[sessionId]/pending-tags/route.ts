import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import type { PendingTagStatus } from '@prisma/client';

/**
 * GET /api/import/[sessionId]/pending-tags
 * Get pending product tags for verification
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const url = new URL(req.url);

    const status = url.searchParams.get('status') as PendingTagStatus | null;
    const confidence = url.searchParams.get('confidence');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Verify session ownership
    const importSession = await prisma.importSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!importSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const where: {
      importSessionId: string;
      status?: PendingTagStatus;
      attributionConfidence?: string;
    } = {
      importSessionId: sessionId,
    };

    if (status) {
      where.status = status;
    }

    if (confidence) {
      where.attributionConfidence = confidence;
    }

    const [pendingTags, total] = await Promise.all([
      prisma.pendingProductTag.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [
          { attributionConfidence: 'desc' }, // High confidence first
          { createdAt: 'asc' },
        ],
      }),
      prisma.pendingProductTag.count({ where }),
    ]);

    // Get confidence breakdown
    const confidenceBreakdown = await prisma.pendingProductTag.groupBy({
      by: ['attributionConfidence'],
      where: {
        importSessionId: sessionId,
        status: 'UNREVIEWED',
      },
      _count: true,
    });

    return NextResponse.json({
      pendingTags,
      total,
      limit,
      offset,
      confidenceBreakdown: confidenceBreakdown.reduce((acc, item) => {
        if (item.attributionConfidence) {
          acc[item.attributionConfidence] = item._count;
        }
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Error fetching pending tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending tags' },
      { status: 500 }
    );
  }
}
