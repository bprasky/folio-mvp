import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import type { ImportSourceType } from '@prisma/client';

/**
 * POST /api/import/session
 * Create a new import session
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sourceType, projectId } = body;

    // Validate source type
    const validSourceTypes: ImportSourceType[] = ['PRESENTATION', 'WEBSITE', 'BULK_IMAGES'];
    if (!validSourceTypes.includes(sourceType)) {
      return NextResponse.json(
        { error: 'Invalid source type. Must be PRESENTATION, WEBSITE, or BULK_IMAGES' },
        { status: 400 }
      );
    }

    // If projectId provided, verify user owns the project
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { ownerId: userId },
            { designerId: userId },
          ],
        },
      });

      if (!project) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 404 }
        );
      }
    }

    const importSession = await prisma.importSession.create({
      data: {
        userId,
        sourceType,
        projectId: projectId || null,
        status: 'PROCESSING',
      },
    });

    return NextResponse.json({ sessionId: importSession.id }, { status: 201 });
  } catch (error) {
    console.error('Error creating import session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'Unknown';
    return NextResponse.json(
      {
        error: 'Failed to create import session',
        details: errorMessage,
        type: errorName,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/import/session
 * List import sessions for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where: { userId: string; status?: string } = { userId };
    if (status) {
      where.status = status;
    }

    const [sessions, total] = await Promise.all([
      prisma.importSession.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { pendingTags: true },
          },
        },
      }),
      prisma.importSession.count({ where }),
    ]);

    return NextResponse.json({ sessions, total, limit, offset });
  } catch (error) {
    console.error('Error fetching import sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import sessions' },
      { status: 500 }
    );
  }
}
