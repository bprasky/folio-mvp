export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView, assertProjectWrite } from '@/lib/authz/access';
import { prisma } from '@/lib/prisma';
import {
  addSupplementalQuote,
  getPostSupplementalQuotes,
  QuoteSource,
  DisplayLocation,
} from '@/lib/intelligence/quotes';

/**
 * GET /api/projects/[id]/supplemental-quotes
 *
 * Get all supplemental quotes for a project's posts
 *
 * Query params:
 *   postId?: string - Filter by specific post (optional)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertProjectView(session.user.id, projectId);

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    // Get project with posts
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        posts: {
          select: { id: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get quotes for specific post or all posts
    if (postId) {
      const quotes = await getPostSupplementalQuotes(postId);
      return NextResponse.json({ quotes });
    }

    // Get quotes for all posts
    const allQuotes = await Promise.all(
      project.posts.map(post => getPostSupplementalQuotes(post.id))
    );

    return NextResponse.json({
      quotes: allQuotes.flat(),
    });
  } catch (error) {
    console.error('[GET /api/projects/[id]/supplemental-quotes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get supplemental quotes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/supplemental-quotes
 *
 * Add a supplemental quote to a project post
 *
 * Body:
 *   postId: string - The project post to add quote to
 *   productTagId?: string - Optional product tag the quote is about
 *   question: string - The question being answered
 *   answer: string - The designer's answer
 *   source: 'welcome_back' | 'trend_interview' | 'user_question'
 *   pinned?: boolean - Whether to pin the quote
 *   displayLocation?: 'near_product' | 'sidebar' | 'end_of_post'
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    await assertProjectWrite(session.user.id, projectId);

    // Verify user owns the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        userId: true,
        posts: { select: { id: true } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Not authorized to add quotes to this project' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { postId, productTagId, question, answer, source, pinned, displayLocation } = body;

    // Validate required fields
    if (!postId || !question || !answer || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: postId, question, answer, source' },
        { status: 400 }
      );
    }

    // Validate source
    const validSources: QuoteSource[] = ['welcome_back', 'trend_interview', 'user_question'];
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate displayLocation if provided
    if (displayLocation) {
      const validLocations: DisplayLocation[] = ['near_product', 'sidebar', 'end_of_post'];
      if (!validLocations.includes(displayLocation)) {
        return NextResponse.json(
          { error: `Invalid displayLocation. Must be one of: ${validLocations.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Verify post belongs to project
    if (!project.posts.some(p => p.id === postId)) {
      return NextResponse.json(
        { error: 'Post does not belong to this project' },
        { status: 400 }
      );
    }

    const quote = await addSupplementalQuote({
      projectPostId: postId,
      productTagId,
      question,
      answer,
      source,
      pinned,
      displayLocation,
    });

    return NextResponse.json({
      success: true,
      quote,
    });
  } catch (error) {
    console.error('[POST /api/projects/[id]/supplemental-quotes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add supplemental quote' },
      { status: 500 }
    );
  }
}
