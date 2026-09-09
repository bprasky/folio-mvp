export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getVendorContext } from '@/lib/auth/vendorContext';
import { canClaimExistingProducts } from '@/lib/vendor/claimAuthorization';
import { ClaimConflict, reviewProductClaim } from '@/lib/vendor/reviewProductClaim';
import { turnoverUnclaimedProducts } from '@/lib/vendor/claimTurnover';

/**
 * Vendor review queue (Product Tag Lifecycle Phase 3).
 *
 * GET  — PENDING brand-only claim candidates for the caller's vendor org, each
 *        with product fields and tag-usage attribution (how many tags, how many
 *        distinct designers). Tag data is read-only here.
 * POST  { candidateId, action: 'confirm' | 'reject' }
 *       { action: 'discover' } discovers candidates through the same claim policy.
 *        confirm → assign the product to the vendor (set vendorId) and mark the
 *        candidate CONFIRMED. reject → mark REJECTED; the product stays unclaimed
 *        and won't resurface.
 */
export async function GET() {
  const ctx = await getVendorContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Not a vendor' }, { status: 403 });
  }

  const candidates = await prisma.productClaimCandidate.findMany({
    where: { organizationId: ctx.vendorOrgId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          brand: true,
          category: true,
          price: true,
          imageUrl: true,
          url: true,
          description: true,
        },
      },
    },
  });

  // Tag-usage attribution: count tags and distinct designers (project owners)
  // per product. Read-only — never mutate tag rows.
  const items = await Promise.all(
    candidates.map(async (c) => {
      const tags = await prisma.projectProductTag.findMany({
        where: { productId: c.productId },
        select: { projects: { select: { ownerId: true } } },
      });
      const designerIds = new Set(tags.map((t) => t.projects?.ownerId).filter(Boolean));
      return {
        candidateId: c.id,
        matchType: c.matchType,
        product: c.product,
        usage: { tagCount: tags.length, designerCount: designerIds.size },
      };
    }),
  );

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const ctx = await getVendorContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Not a vendor' }, { status: 403 });
  }

  if (!await canClaimExistingProducts(session.user.id, ctx.vendorOrgId)) {
    return NextResponse.json({ error: 'Active vendor membership and organization verification by Folio are required.' }, { status: 403 });
  }
  const { candidateId, action } = await request.json().catch(() => ({}));
  if (action === 'discover') {
    try {
      return NextResponse.json(await turnoverUnclaimedProducts(ctx.vendorOrgId, session.user.id));
    } catch {
      return NextResponse.json({ error: 'Product discovery could not finish. Please retry.' }, { status: 500 });
    }
  }
  if (!candidateId || (action !== 'confirm' && action !== 'reject')) {
    return NextResponse.json({ error: 'candidateId and action (confirm|reject) required' }, { status: 400 });
  }

  // Authorize: the candidate must belong to the caller's vendor org.
  const candidate = await prisma.productClaimCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, productId: true, organizationId: true, status: true },
  });
  if (!candidate || candidate.organizationId !== ctx.vendorOrgId) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }

  try {
    const status = await reviewProductClaim(candidate.id, ctx.vendorOrgId, session.user.id, action);
    return NextResponse.json({ success: true, status });
  } catch (error) {
    if (error instanceof ClaimConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('[vendor/review-queue] Claim failed');
    return NextResponse.json({ error: 'Claim could not be saved.' }, { status: 500 });
  }
}
