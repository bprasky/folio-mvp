export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgOwner } from '@/lib/permissions';

/**
 * POST /api/orgs/[orgId]/upgrade - Upgrade organization to Professional tier
 *
 * Requires:
 * - User must be org OWNER
 * - Org must be at least CLAIMED status
 * - Business license document
 * - Bank account information (for affiliate payouts)
 *
 * Body: { businessLicense: string, bankAccountInfo: { ... } }
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

    // Check if user is owner
    const memberships = await getUserOrgMemberships(session.user.id);
    if (!isOrgOwner(memberships, orgId)) {
      return NextResponse.json(
        { error: 'Only the organization owner can upgrade to Professional' },
        { status: 403 }
      );
    }

    // Get the org
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, status: true, name: true }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Can't upgrade if already professional
    if (org.status === 'PROFESSIONAL') {
      return NextResponse.json(
        { error: 'Organization is already on the Professional tier' },
        { status: 400 }
      );
    }

    // Must be at least claimed to upgrade
    if (org.status === 'UNCLAIMED') {
      return NextResponse.json(
        { error: 'Organization must be claimed before upgrading to Professional. Use the claim endpoint first.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { businessLicense, bankAccountInfo } = body;

    // Validate required fields
    if (!businessLicense) {
      return NextResponse.json(
        { error: 'Business license document is required for Professional tier' },
        { status: 400 }
      );
    }

    if (!bankAccountInfo || typeof bankAccountInfo !== 'object') {
      return NextResponse.json(
        { error: 'Bank account information is required for Professional tier (for affiliate payouts)' },
        { status: 400 }
      );
    }

    // Validate bank account info has required fields
    const requiredBankFields = ['accountType', 'routingNumber', 'accountNumber', 'accountHolderName'];
    const missingFields = requiredBankFields.filter(f => !bankAccountInfo[f]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing bank account fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Update org to professional
    // NOTE: In production, this would go through a verification queue
    // For now, we're auto-approving for development
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        status: 'PROFESSIONAL',
        businessLicense,
        bankAccountInfo,
        verifiedAt: new Date(),
        verifiedBy: 'AUTO', // In production, this would be an admin user ID
      }
    });

    return NextResponse.json({
      message: 'Organization upgraded to Professional tier successfully',
      features: {
        affiliateTags: true,
        imageGeneration: true,
        clientConnections: true,
        premiumTools: true,
      }
    });
  } catch (error) {
    console.error('[POST /api/orgs/[orgId]/upgrade] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade organization' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgId]/upgrade - Get upgrade status and requirements
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Get the org
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        status: true,
        businessLicense: true,
        verifiedAt: true,
      }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const tiers = {
      UNCLAIMED: {
        name: 'Unclaimed',
        canUpgrade: true,
        nextTier: 'CLAIMED',
        requirements: ['Claim ownership of the organization'],
        features: ['Directory listing'],
      },
      CLAIMED: {
        name: 'Claimed (Free)',
        canUpgrade: true,
        nextTier: 'PROFESSIONAL',
        requirements: [
          'Business license document',
          'Bank account information for payouts'
        ],
        features: ['Directory listing', 'Verified badge'],
      },
      PROFESSIONAL: {
        name: 'Professional',
        canUpgrade: false,
        nextTier: null,
        requirements: [],
        features: [
          'Affiliate tags',
          'Image generation',
          'Client connections',
          'Premium tools',
          'Priority support'
        ],
      }
    };

    const currentTier = tiers[org.status as keyof typeof tiers];

    return NextResponse.json({
      currentStatus: org.status,
      tier: currentTier,
      hasBusinessLicense: !!org.businessLicense,
      verifiedAt: org.verifiedAt,
    });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/upgrade] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get upgrade status' },
      { status: 500 }
    );
  }
}
