export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orgs/[orgId]/prompts
 * Returns curated editorial prompts for this vendor org.
 * Mix of org-specific (triggered by boosts/products) and global templates.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const orgId = resolvedParams.orgId;

    // Fetch org-specific + global prompts
    let prompts: any[] = [];
    try {
      prompts = await prisma.vendorPrompt.findMany({
        where: {
          OR: [
            { organizationId: orgId, status: 'ACTIVE' },
            { organizationId: null, status: 'ACTIVE' }, // Global templates
          ],
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      });
    } catch {
      // VendorPrompt table may not exist yet
    }

    // If no prompts exist, return sensible defaults
    if (prompts.length === 0) {
      // Get org's top product for context
      const orgUsers = await prisma.organizationUser.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { userId: true },
      });
      const vendorUserIds = orgUsers.map(u => u.userId);

      const topProduct = await prisma.product.findFirst({
        where: { vendorId: { in: vendorUserIds }, imageUrl: { not: null } },
        select: { name: true, category: true },
        orderBy: { createdAt: 'desc' },
      });

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, specialties: true },
      });

      // Generate contextual default prompts
      const defaults = [
        {
          id: 'default-story',
          title: `The story behind ${org?.name || 'your brand'}`,
          question: `What inspired you to start ${org?.name || 'your company'}? What gap in the market were you trying to fill?`,
          category: 'general',
          status: 'ACTIVE',
        },
        ...(topProduct ? [{
          id: 'default-product',
          title: `What makes ${topProduct.name} special?`,
          question: `Tell us about the design process behind ${topProduct.name}. What materials, techniques, or inspirations drove its creation?`,
          category: 'product',
          status: 'ACTIVE',
        }] : []),
        {
          id: 'default-designers',
          title: 'Working with designers',
          question: 'How do interior designers typically discover and specify your products? What does an ideal designer collaboration look like?',
          category: 'general',
          status: 'ACTIVE',
        },
      ];

      return NextResponse.json({ prompts: defaults });
    }

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error('[orgs/[orgId]/prompts] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 });
  }
}
