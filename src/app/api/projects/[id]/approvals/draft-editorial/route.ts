import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createEditorialDraft } from '@/app/actions/projects';

/**
 * POST /api/projects/[id]/approvals/draft-editorial
 * Creates an editorial DRAFT (does NOT publish)
 * User should then be navigated to PublishWorkflow for review
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;

  try {
    // Create draft (NOT publish)
    const result = await createEditorialDraft({ projectId });

    if (result.ok) {
      return NextResponse.json({
        success: true,
        message: result.message,
        projectPostId: result.projectPostId,
        slug: result.slug,
        status: result.status, // Should be 'DRAFT'
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to create editorial draft' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[draft-editorial] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create editorial draft' },
      { status: 500 }
    );
  }
}

