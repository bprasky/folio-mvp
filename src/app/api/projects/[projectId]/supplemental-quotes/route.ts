export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  addSupplementalQuote,
  getPostSupplementalQuotes,
  getProjectEngagement,
} from '@/lib/intelligence/quotes';

/**
 * GET /api/projects/[projectId]/supplemental-quotes
 *
 * Get supplemental quotes for a project post
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;

    // Find the project post
    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Project post not found' },
        { status: 404 }
      );
    }

    const quotes = await getPostSupplementalQuotes(post.id);

    return NextResponse.json({ quotes });
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/supplemental-quotes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get supplemental quotes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[projectId]/supplemental-quotes
 *
 * Add a supplemental quote to a project post
 *
 * Body:
 *   question: string
 *   answer: string
 *   source: 'welcome_back' | 'trend_interview' | 'user_question'
 *   productTagId?: string
 *   pinned?: boolean
 *   displayLocation?: 'near_product' | 'sidebar' | 'end_of_post'
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user owns or has access to this project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        designerId: true,
        ownerId: true,
        post: { select: { id: true } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const isOwner =
      project.designerId === session.user.id ||
      project.ownerId === session.user.id;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (!project.post) {
      return NextResponse.json(
        { error: 'Project post not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { question, answer, source, productTagId, pinned, displayLocation } = body;

    if (!question || !answer || !source) {
      return NextResponse.json(
        { error: 'question, answer, and source are required' },
        { status: 400 }
      );
    }

    if (!['welcome_back', 'trend_interview', 'user_question'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source' },
        { status: 400 }
      );
    }

    const quote = await addSupplementalQuote({
      projectPostId: project.post.id,
      productTagId,
      question,
      answer,
      source,
      pinned,
      displayLocation,
    });

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('[POST /api/projects/[projectId]/supplemental-quotes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add supplemental quote' },
      { status: 500 }
    );
  }
}
