import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Schema for vendor submission (mini-interview answers)
const submitContributionSchema = z.object({
  interviewAnswers: z.object({
    // Mini-interview questions for sponsors/boosters
    productHighlight: z.string().optional(),
    collaborationStory: z.string().optional(),
    designerFeedback: z.string().optional(),
    behindTheScenes: z.string().optional(),
    // Any additional custom fields
  }).passthrough(),
  decline: z.boolean().optional(),
  declineReason: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string; vendorId: string }>;
}

/**
 * GET /api/features/[id]/contributions/[vendorId]/submit
 * Get the current contribution state for a vendor
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, vendorId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a member of the vendor organization
    const membership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: vendorId,
        isActive: true,
      },
    });

    const isAdmin = session.user.role === 'ADMIN';

    if (!membership && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to view this contribution' },
        { status: 403 }
      );
    }

    const contribution = await prisma.featureVendorContribution.findUnique({
      where: {
        featureId_vendorOrgId: {
          featureId: id,
          vendorOrgId: vendorId,
        },
      },
      include: {
        feature: {
          select: {
            id: true,
            title: true,
            status: true,
            primaryAuthor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        vendorOrg: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
    });

    if (!contribution) {
      return NextResponse.json(
        { error: 'Contribution not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(contribution);
  } catch (error) {
    console.error(
      'GET /api/features/[id]/contributions/[vendorId]/submit error:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/features/[id]/contributions/[vendorId]/submit
 * Submit or decline a vendor contribution
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, vendorId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a member of the vendor organization
    const membership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: vendorId,
        isActive: true,
      },
    });

    const isAdmin = session.user.role === 'ADMIN';

    if (!membership && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to submit for this vendor' },
        { status: 403 }
      );
    }

    const contribution = await prisma.featureVendorContribution.findUnique({
      where: {
        featureId_vendorOrgId: {
          featureId: id,
          vendorOrgId: vendorId,
        },
      },
      include: {
        feature: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!contribution) {
      return NextResponse.json(
        { error: 'Contribution invitation not found' },
        { status: 404 }
      );
    }

    // Check if contribution can be submitted
    if (!['INVITED', 'SUBMITTED'].includes(contribution.status)) {
      return NextResponse.json(
        { error: `Cannot submit contribution with status: ${contribution.status}` },
        { status: 400 }
      );
    }

    // Check if feature is still accepting contributions
    if (['PUBLISHED', 'ABOVE_FOLD', 'ARCHIVED'].includes(contribution.feature.status)) {
      return NextResponse.json(
        { error: 'Feature is no longer accepting contributions' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = submitContributionSchema.parse(body);

    // Handle decline
    if (data.decline) {
      const declined = await prisma.featureVendorContribution.update({
        where: {
          featureId_vendorOrgId: {
            featureId: id,
            vendorOrgId: vendorId,
          },
        },
        data: {
          status: 'DECLINED',
          rejectionReason: data.declineReason,
        },
      });

      return NextResponse.json({
        success: true,
        status: 'DECLINED',
        contribution: declined,
      });
    }

    // Submit contribution
    const updated = await prisma.featureVendorContribution.update({
      where: {
        featureId_vendorOrgId: {
          featureId: id,
          vendorOrgId: vendorId,
        },
      },
      data: {
        interviewAnswers: data.interviewAnswers,
        status: 'SUBMITTED',
      },
      include: {
        vendorOrg: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      status: 'SUBMITTED',
      contribution: updated,
    });
  } catch (error) {
    console.error(
      'POST /api/features/[id]/contributions/[vendorId]/submit error:',
      error
    );

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
