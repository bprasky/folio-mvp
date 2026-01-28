/**
 * GET /api/contributions/[topicId]
 * Get user's contribution for specific topic (if exists)
 *
 * POST /api/contributions/[topicId]
 * Submit contribution
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getUserContribution,
  submitContribution,
  matchUserToTopic,
  type ContributionType,
} from '@/lib/contributions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const { topicId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const contribution = await getUserContribution(session.user.id, topicId);

    return NextResponse.json({
      contribution,
      hasContributed: !!contribution,
    });
  } catch (error) {
    console.error('[GET /api/contributions/[topicId]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contribution' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const { topicId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content, type, audioUrl, productId, projectId } = body;

    // Validate required fields
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (!type || !isValidContributionType(type)) {
      return NextResponse.json(
        { error: 'Valid contribution type is required' },
        { status: 400 }
      );
    }

    // Check if user matches topic criteria
    const matchResult = await matchUserToTopic(session.user.id, topicId);
    if (!matchResult.matches) {
      return NextResponse.json(
        { error: matchResult.reason || 'You are not eligible for this topic' },
        { status: 403 }
      );
    }

    // Submit the contribution
    const result = await submitContribution({
      userId: session.user.id,
      articleTopicId: topicId,
      content,
      type,
      audioUrl,
      productId,
      projectId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to submit contribution' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      contribution: result.contribution,
      thresholdMet: result.thresholdMet,
      message: 'Your voice has been added. We\'ll notify you when it\'s published.',
    });
  } catch (error) {
    console.error('[POST /api/contributions/[topicId]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit contribution' },
      { status: 500 }
    );
  }
}

function isValidContributionType(type: string): type is ContributionType {
  return [
    'QUICK_TAKE',
    'EXPERTISE',
    'PREDICTION',
    'REFLECTION',
    'ENDORSEMENT',
    'CONSUMER_VOICE',
  ].includes(type);
}
