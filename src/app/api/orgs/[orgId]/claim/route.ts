export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/orgs/[orgId]/claim - Claim an unclaimed organization
 * User becomes OWNER and can submit verification
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

    // Get the organization
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        users: {
          where: { role: 'OWNER', isActive: true },
        },
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Only unclaimed orgs can be claimed
    if (org.status !== 'UNCLAIMED') {
      return NextResponse.json(
        { error: 'This organization has already been claimed' },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const existingMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId,
        },
      },
    });

    const body = await request.json();
    const { verificationInfo } = body; // Optional initial verification info

    // Transaction: claim the org
    await prisma.$transaction(async (tx) => {
      // If user is already a member, promote to OWNER
      if (existingMembership) {
        await tx.organizationUser.update({
          where: { id: existingMembership.id },
          data: { role: 'OWNER' },
        });
      } else {
        // Create new OWNER membership
        await tx.organizationUser.create({
          data: {
            userId: session.user.id,
            organizationId: orgId,
            role: 'OWNER',
          },
        });
      }

      // Demote any existing owners to ADMIN (they were placeholders)
      if (org.users.length > 0) {
        await tx.organizationUser.updateMany({
          where: {
            organizationId: orgId,
            role: 'OWNER',
            userId: { not: session.user.id },
          },
          data: { role: 'ADMIN' },
        });
      }

      // Update org status to CLAIMED
      await tx.organization.update({
        where: { id: orgId },
        data: {
          status: 'CLAIMED',
          verifiedAt: new Date(),
          // If verification info provided, store it
          ...(verificationInfo?.businessLicense && {
            businessLicense: verificationInfo.businessLicense,
          }),
        },
      });
    });

    // Fetch updated org
    const updatedOrg = await prisma.organization.findUnique({
      where: { id: orgId },
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
      message: 'Organization claimed successfully',
      organization: updatedOrg,
    });
  } catch (error) {
    console.error('Error claiming organization:', error);
    return NextResponse.json(
      { error: 'Failed to claim organization' },
      { status: 500 }
    );
  }
}
