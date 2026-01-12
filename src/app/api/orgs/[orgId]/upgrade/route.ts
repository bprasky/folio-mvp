export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/orgs/[orgId]/upgrade - Upgrade to professional tier
 * Requires business license and bank info
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    // Check if user is owner of this org
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId,
        },
      },
    });

    if (!membership || membership.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only org owners can upgrade to professional tier' },
        { status: 403 }
      );
    }

    // Get the organization
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Already professional?
    if (org.status === 'PROFESSIONAL') {
      return NextResponse.json(
        { error: 'Organization is already on professional tier' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { businessLicense, bankAccount } = body;

    // Validate required fields for professional upgrade
    if (!businessLicense) {
      return NextResponse.json(
        { error: 'Business license is required for professional tier' },
        { status: 400 }
      );
    }

    if (!bankAccount) {
      return NextResponse.json(
        { error: 'Bank account information is required for professional tier' },
        { status: 400 }
      );
    }

    // Update org to professional tier
    // Note: In production, this would trigger a verification/payment flow
    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: {
        status: 'PROFESSIONAL',
        businessLicense,
        bankAccount, // Should be encrypted in production
        verifiedAt: new Date(),
      },
      include: {
        users: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Organization upgraded to professional tier',
      organization: updatedOrg,
    });
  } catch (error) {
    console.error('Error upgrading organization:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade organization' },
      { status: 500 }
    );
  }
}
