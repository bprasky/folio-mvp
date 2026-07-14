/**
 * Product Naming Gate (spec 20) — the single resolver chokepoint.
 *
 * Naming eligibility is derived from paid state on the row. Prompts and
 * components never decide this. Two rules, three signals, one resolver:
 *
 *   - Interview-question naming (mode 'subscription'): a product may be named
 *     and spotlighted iff its vendor org is subscribed. (A boost targets a
 *     specific post and enterprise is the designer's tier — neither is knowable
 *     at interview time, so subscription is the only signal that applies.)
 *
 *   - Prose naming (mode 'prose'): a product name survives into article prose
 *     iff the vendor is subscribed OR an approved boost exists for this product
 *     on this post OR the posting account is ENTERPRISE.
 *
 * Fail-safe: a product with no row, no vendor, or an unsubscribed vendor
 * resolves to NOT named. Over-suppression is the correct error (same posture as
 * the image provenance gate, spec 17).
 *
 * The credits block and the materials ledger are NEVER gated — they are the
 * designer's attribution and are composed from the tag set directly.
 */

import { prisma } from '@/lib/prisma';
import { decideNaming, type NamingMode, type NamingSignals, type ProductNaming } from './namingRules';

export type { NamingMode, NamingReason, NamingSignals, ProductNaming } from './namingRules';
export { decideNaming } from './namingRules';

export interface NamingContext {
  mode: NamingMode;
  /**
   * The project whose ProjectPost carries any boosts (prose mode). Used to
   * resolve the post for the (productId, projectPostId) boost lookup.
   */
  projectId?: string | null;
  /** The posting account, checked for the ENTERPRISE tier (prose mode). */
  postingUserId?: string | null;
}

/**
 * Resolve naming eligibility for a set of products. Reads the three paid
 * signals and returns a per-product decision plus the product identity fields
 * (name/brand/category) a caller needs to police prose or build a descriptor.
 */
export async function resolveProductNaming(
  productIds: Array<string | null | undefined>,
  ctx: NamingContext
): Promise<Map<string, ProductNaming>> {
  const ids = Array.from(new Set(productIds.filter((id): id is string => !!id)));
  const result = new Map<string, ProductNaming>();
  if (ids.length === 0) return result;

  // Products + the vendor-org subscription path:
  // Product.vendor (User) -> organizationUsers -> Organization.vendorSubscription
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      brand: true,
      category: true,
      vendor: {
        select: {
          name: true,
          companyName: true,
          organizationUsers: {
            select: {
              organization: {
                select: { vendorSubscription: { select: { status: true } } },
              },
            },
          },
        },
      },
    },
  });

  // Enterprise tier of the posting account (prose mode only) — one lookup,
  // applies to every product on the piece.
  let enterprise = false;
  if (ctx.mode === 'prose' && ctx.postingUserId) {
    const poster = await prisma.user.findUnique({
      where: { id: ctx.postingUserId },
      select: { subscriptionTier: true },
    });
    enterprise = poster?.subscriptionTier === 'ENTERPRISE';
  }

  // Approved boosts for these products on this post (prose mode only).
  const boostedProductIds = new Set<string>();
  if (ctx.mode === 'prose' && ctx.projectId) {
    const post = await prisma.projectPost.findUnique({
      where: { projectId: ctx.projectId },
      select: { id: true },
    });
    if (post) {
      const boosts = await prisma.inContextBoost.findMany({
        where: {
          productId: { in: ids },
          projectPostId: post.id,
          status: 'APPROVED',
        },
        select: { productId: true },
      });
      for (const b of boosts) boostedProductIds.add(b.productId);
    }
  }

  for (const p of products) {
    const vendorSubscribed = (p.vendor?.organizationUsers ?? []).some(
      (ou) => ou.organization?.vendorSubscription?.status === 'ACTIVE'
    );
    const signals: NamingSignals = {
      vendorSubscribed,
      boostApproved: boostedProductIds.has(p.id),
      enterprise,
    };
    const decision = decideNaming(signals, ctx.mode);
    result.set(p.id, {
      productId: p.id,
      named: decision.named,
      reason: decision.reason,
      name: p.name ?? null,
      brand: p.brand ?? null,
      vendorName: p.vendor?.name ?? p.vendor?.companyName ?? null,
      category: p.category ?? null,
    });
  }

  // Any requested id without a backing Product row: fail safe to not-named.
  for (const id of ids) {
    if (!result.has(id)) {
      result.set(id, {
        productId: id,
        named: false,
        reason: 'no_product',
        name: null,
        brand: null,
        vendorName: null,
        category: null,
      });
    }
  }

  return result;
}
