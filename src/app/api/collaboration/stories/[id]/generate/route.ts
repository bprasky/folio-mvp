export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertCollaborationStoryEdit } from '@/lib/collaboration/auth';
import {
  getRound1Questions,
  Round1Response,
} from '@/lib/collaboration/questions/round1';
import { Round2Question } from '@/lib/collaboration/questions/generateRound2';
import { Round3Question } from '@/lib/collaboration/questions/generateRound3';
import {
  assembleCollaborationStory,
  InterviewData,
} from '@/lib/collaboration/narrative/assembleStory';

type RoundData = {
  responses?: Round1Response[];
  questions?: (Round2Question | Round3Question)[];
  completedAt?: string;
};

/**
 * POST /api/collaboration/stories/[id]/generate
 * Trigger AI narrative generation after all rounds are complete
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storyId = params.id;

    // Check access
    try {
      await assertCollaborationStoryEdit(session.user.id, storyId);
    } catch (error: any) {
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      throw error;
    }

    // Get the story with all data
    const story = await prisma.collaborationStory.findUnique({
      where: { id: storyId },
      include: {
        vendorOrg: {
          select: { id: true, name: true },
        },
        designer: {
          select: { id: true, name: true },
        },
      },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Verify all rounds are complete
    if (story.status !== 'ROUND3_COMPLETE') {
      return NextResponse.json(
        {
          error: 'All interview rounds must be completed before generating',
          currentStatus: story.status,
        },
        { status: 400 }
      );
    }

    // Update status to GENERATING
    await prisma.collaborationStory.update({
      where: { id: storyId },
      data: { status: 'GENERATING' },
    });

    try {
      // Prepare interview data
      const vendorRound1 = story.vendorRound1 as RoundData | null;
      const vendorRound2 = story.vendorRound2 as RoundData | null;
      const vendorRound3 = story.vendorRound3 as RoundData | null;
      const designerRound1 = story.designerRound1 as RoundData | null;
      const designerRound2 = story.designerRound2 as RoundData | null;
      const designerRound3 = story.designerRound3 as RoundData | null;

      const interviewData: InterviewData = {
        vendorOrgName: story.vendorOrg.name,
        designerName: story.designer.name,
        vendorRound1: {
          questions: getRound1Questions('VENDOR'),
          responses: vendorRound1?.responses || [],
        },
        vendorRound2: {
          questions: (vendorRound2?.questions || []) as Round2Question[],
          responses: vendorRound2?.responses || [],
        },
        vendorRound3: {
          questions: (vendorRound3?.questions || []) as Round3Question[],
          responses: vendorRound3?.responses || [],
        },
        designerRound1: {
          questions: getRound1Questions('DESIGNER'),
          responses: designerRound1?.responses || [],
        },
        designerRound2: {
          questions: (designerRound2?.questions || []) as Round2Question[],
          responses: designerRound2?.responses || [],
        },
        designerRound3: {
          questions: (designerRound3?.questions || []) as Round3Question[],
          responses: designerRound3?.responses || [],
        },
      };

      // Generate the narrative
      const { narrative, blocks } = await assembleCollaborationStory(interviewData);

      // Update story with generated content
      const updatedStory = await prisma.collaborationStory.update({
        where: { id: storyId },
        data: {
          status: 'REVIEW',
          generatedNarrative: narrative as any,
          finalContent: blocks as any,
          title: narrative.title,
          excerpt: narrative.excerpt,
        },
        include: {
          vendorOrg: { select: { id: true, name: true, logo: true } },
          designer: { select: { id: true, name: true, profileImage: true } },
        },
      });

      // TODO: Notify both parties that story is ready for review
      // await sendStoryReadyForReviewNotification(storyId);

      console.log('[collaboration/stories/generate] Success:', {
        storyId,
        title: narrative.title,
        sectionCount: narrative.sections.length,
      });

      return NextResponse.json({
        success: true,
        status: 'REVIEW',
        title: narrative.title,
        excerpt: narrative.excerpt,
        blockCount: blocks.length,
      });
    } catch (genError) {
      // Revert status on failure
      await prisma.collaborationStory.update({
        where: { id: storyId },
        data: { status: 'ROUND3_COMPLETE' },
      });

      console.error('[collaboration/stories/generate] Generation failed:', genError);
      return NextResponse.json(
        { error: 'Failed to generate narrative' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[collaboration/stories/generate] POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate story' },
      { status: 500 }
    );
  }
}
