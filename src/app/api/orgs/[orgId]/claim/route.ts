export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/orgs/[orgId]/claim - Claim an unclaimed organization
 *
 * This allows a legitimate business owner to claim an org that was
 * created by someone else (e.g., a salesperson or another user).
 *
 * The claimer becomes the OWNER, and existing members stay as members.
 *
 * Body: { verificationNote?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;
    const body = await request.json().catch(() => ({}));
    const { verificationNote } = body;

    // Get the org
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        users: {
          where: { role: 'OWNER' }
        }
      }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Can only claim unclaimed orgs
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
          organizationId: orgId
        }
      }
    });

    if (!existingMembership?.isActive || !['OWNER', 'ADMIN'].includes(existingMembership.role)) {
      return NextResponse.json({ error: 'An active firm owner or admin must confirm this page. Request access or use your setup invitation.' }, { status: 403 });
    }

    // Perform the claim in a transaction
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.organization.updateMany({ where: { id: orgId, status: 'UNCLAIMED' }, data: { status: 'CLAIMED' } });
      if (claimed.count !== 1) throw new Error('Organization already claimed');
      // If there's an existing owner, demote them to admin
      for (const owner of org.users) {
        await tx.organizationUser.update({
          where: { id: owner.id },
          data: { role: 'ADMIN' }
        });
      }

      if (existingMembership) {
        // Upgrade existing membership to OWNER
        await tx.organizationUser.update({
          where: { id: existingMembership.id },
          data: { role: 'OWNER' }
        });
      } else {
        // Create new OWNER membership
        await tx.organizationUser.create({
          data: {
            userId: session.user.id,
            organizationId: orgId,
            role: 'OWNER',
            isActive: true,
            showOnProfile: true,
          }
        });
      }

      // Update org status to CLAIMED
      await tx.organization.update({
        where: { id: orgId },
        data: {
          status: 'CLAIMED',
          salesNotes: verificationNote
            ? `${org.salesNotes || ''}\n\nCLAIM NOTE: ${verificationNote}`.trim()
            : org.salesNotes,
        }
      });
    });

    return NextResponse.json({
      message: 'Organization claimed successfully. You are now the owner.',
    });
  } catch (error) {
    console.error('[POST /api/orgs/[orgId]/claim] Error:', error);
    return NextResponse.json(
      { error: 'Failed to claim organization' },
      { status: 500 }
    );
  }
}
