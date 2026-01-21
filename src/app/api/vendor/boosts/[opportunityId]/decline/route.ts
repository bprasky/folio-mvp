import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the opportunity
    const opportunity = await prisma.boostOpportunity.findUnique({
      where: { id: params.opportunityId },
    });

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    // Verify user has access to this vendor org
    const userOrg = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: opportunity.vendorId,
        role: { in: ['OWNER', 'ADMIN'] },
        isActive: true,
      },
    });

    if (!userOrg) {
      return NextResponse.json(
        { error: 'You do not have permission to decline for this vendor' },
        { status: 403 }
      );
    }

    // Check if already responded
    if (opportunity.status === 'BOOSTED' || opportunity.status === 'DECLINED') {
      return NextResponse.json(
        { error: 'This opportunity has already been responded to' },
        { status: 409 }
      );
    }

    // Decline the opportunity
    await prisma.boostOpportunity.update({
      where: { id: params.opportunityId },
      data: {
        status: 'DECLINED',
        respondedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[decline/route] Error:', error);
    return NextResponse.json(
      { error: 'Failed to decline opportunity' },
      { status: 500 }
    );
  }
}
