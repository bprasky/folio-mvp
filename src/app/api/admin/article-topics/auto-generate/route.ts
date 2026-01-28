/**
 * GET /api/admin/article-topics/auto-generate
 * Preview what topics would be auto-generated
 *
 * POST /api/admin/article-topics/auto-generate
 * Trigger auto-generation of topics from trend signals
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  checkAndGenerateTopics,
  getEligibleSignalCount,
  previewAutoGeneration,
} from '@/lib/article-topics';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get preview of what would be generated
    const preview = await previewAutoGeneration();
    const eligibleCount = await getEligibleSignalCount();

    return NextResponse.json({
      eligibleSignalCount: eligibleCount,
      previews: preview,
    });
  } catch (error) {
    console.error('[GET /api/admin/article-topics/auto-generate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to preview auto-generation' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Run auto-generation
    const generated = await checkAndGenerateTopics();

    return NextResponse.json({
      success: true,
      generatedCount: generated.length,
      topics: generated,
      message: generated.length > 0
        ? `Generated ${generated.length} new topic(s) from trend signals`
        : 'No new topics generated (no qualifying signals or all on cooldown)',
    });
  } catch (error) {
    console.error('[POST /api/admin/article-topics/auto-generate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-generate topics' },
      { status: 500 }
    );
  }
}
