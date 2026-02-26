export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { publishEditorial } from '@/app/actions/projects';

/**
 * POST /api/projects/[id]/approvals/publish-editorial
 * Publishes an existing editorial draft
 * Explicit publish action - separate from draft creation
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
    // Publish the editorial (explicit action)
    const result = await publishEditorial({ projectId });

    if (result.ok) {
      return NextResponse.json({
        success: true,
        message: result.message,
        projectPostId: result.projectPostId,
        slug: result.slug,
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to publish. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[publish-editorial] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to publish. Please try again.' },
      { status: 500 }
    );
  }
}





