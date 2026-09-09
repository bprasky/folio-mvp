export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { canClaimExistingProducts } from '@/lib/vendor/claimAuthorization';
import { ClaimConflict } from '@/lib/vendor/reviewProductClaim';
import { canClaimOrganization } from '@/lib/vendor/domain-verification';
import { turnoverUnclaimedProducts } from '@/lib/vendor/claimTurnover';
import { mergeVendorShadow, mergeRepShadow } from '@/lib/intelligence/shadow-merge';
import { deliverPendingActions } from '@/lib/messaging/pending-actions';

/**
 * POST /api/vendor/claim
 *
 * Allows a rep to claim the vendor organization.
 * Does NOT activate the org — admin must do that separately.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    if (!await canClaimExistingProducts(session.user.id, organizationId)) {
      return NextResponse.json({ error: 'Active vendor membership and organization verification by Folio are required.' }, { status: 403 });
    }

    // Verify domain match
    const verification = await canClaimOrganization(
      session.user.email,
      organizationId
    );

    if (!verification.allowed) {
      return NextResponse.json(
        { error: verification.reason || 'Not authorized to claim this organization' },
        { status: 403 }
      );
    }

    // Consume the organization claim once; a lost race cannot replace the claimant.
    const vendorInvite = await prisma.$transaction(async tx => {
      if (!await canClaimExistingProducts(session.user.id, organizationId, tx)) throw new ClaimConflict('Vendor authorization changed.');
      const invite = await tx.vendorInvite.upsert({ where: { organizationId }, create: { organizationId }, update: {} });
      const claimed = await tx.vendorInvite.updateMany({
        where: { id: invite.id, claimedAt: null },
        data: { claimedAt: new Date(), claimedByUserId: session.user.id },
      });
      if (claimed.count !== 1) throw new ClaimConflict('Organization has already been claimed.');
      await tx.organization.updateMany({ where: { id: organizationId, status: 'UNCLAIMED' }, data: { status: 'CLAIMED' } });
      return invite;
    });

    // Phase 2 turnover: hand unclaimed products on this vendor's domain over to
    // the claiming user. Deterministic domain match only; tags are untouched so
    // attribution is preserved. Best-effort — never block the claim on it.
    let productsAssigned = 0;
    let productsToReview = 0;
    try {
      const turnover = await turnoverUnclaimedProducts(organizationId, session.user.id);
      productsAssigned = turnover.matched;
      productsToReview = turnover.candidates;
    } catch (e) {
      console.error('[vendor/claim] product turnover failed:', e);
    }

    // Snapshot product completeness BEFORE merge (Flywheel 5: Enrichment Tracking)
    const orgProducts = await prisma.product.findMany({
      where: { vendor: { organizationUsers: { some: { organizationId } } } },
      select: { id: true, imageUrl: true, description: true, brand: true, url: true, category: true },
    });
    const preClaimCompleteness = orgProducts.map(p => ({
      id: p.id,
      hasImage: !!p.imageUrl,
      hasDescription: !!p.description,
      hasBrand: !!p.brand,
      hasUrl: !!p.url,
      hasCategory: !!p.category,
    }));
    const preClaimScore = preClaimCompleteness.reduce((sum, p) =>
      sum + (p.hasImage ? 1 : 0) + (p.hasDescription ? 1 : 0) + (p.hasBrand ? 1 : 0) + (p.hasUrl ? 1 : 0) + (p.hasCategory ? 1 : 0)
    , 0);

    // Merge shadow profile data into live org
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    if (org) {
      mergeVendorShadow(organizationId, org.name).catch(async (err) => {
        console.error(err);
      });

      // Track enrichment after merge (fire-and-forget, delayed to let merge complete)
      setTimeout(async () => {
        try {
          const postProducts = await prisma.product.findMany({
            where: { vendor: { organizationUsers: { some: { organizationId } } } },
            select: { id: true, imageUrl: true, description: true, brand: true, url: true, category: true },
          });
          const postClaimScore = postProducts.reduce((sum, p) =>
            sum + (p.imageUrl ? 1 : 0) + (p.description ? 1 : 0) + (p.brand ? 1 : 0) + (p.url ? 1 : 0) + (p.category ? 1 : 0)
          , 0);

          await prisma.vendorInviteSignal.create({
            data: {
              vendorName: org.name,
              signalType: 'ENRICHMENT_TRACKED',
              metadata: {
                organizationId,
                productCount: orgProducts.length,
                preClaimScore,
                postClaimScore,
                enrichmentDelta: postClaimScore - preClaimScore,
                claimedBy: session.user.id,
              },
            },
          });
          console.log('[Enrichment] Tracked:', { org: org.name, delta: postClaimScore - preClaimScore });
        } catch (e) {
          console.error('[Enrichment] Tracking failed:', e);
        }
      }, 5000); // 5s delay to let merge complete
    }

    // Merge rep shadow profile for this user
    if (session.user.email) {
      mergeRepShadow(session.user.id, session.user.email).catch(console.error);
    }

    // Deliver any pending actions targeting this user's email
    if (session.user.email) {
      deliverPendingActions(session.user.email).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      vendorInviteId: vendorInvite.id,
      productsAssigned,
      productsToReview,
      message: 'Organization claimed successfully. An admin must activate to unlock full features.',
    });
  } catch (error) {
    if (error instanceof ClaimConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('[vendor/claim] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
