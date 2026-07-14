/**
 * Product Naming Gate (spec 20) — the pure gate rules.
 *
 * This module holds the naming decision and its types with NO I/O, so the two
 * rules are deterministic and unit-testable without a database. The resolver
 * (`resolveProductNaming`) reads the three signals from Prisma and delegates the
 * decision here; the scrub consumes the resulting `ProductNaming` records.
 */

export type NamingMode = 'subscription' | 'prose';

export type NamingReason =
  | 'vendor_subscribed'
  | 'boost_approved'
  | 'enterprise'
  | 'not_subscribed' // subscription mode: vendor not subscribed
  | 'not_eligible' // prose mode: none of the three signals
  | 'no_product'; // productId had no backing Product row

export interface NamingSignals {
  vendorSubscribed: boolean;
  boostApproved: boolean;
  enterprise: boolean;
}

export interface ProductNaming {
  productId: string;
  named: boolean;
  reason: NamingReason;
  name: string | null;
  brand: string | null;
  /**
   * The vendor's display name (the User the product hangs off). This is the
   * label the generator is actually fed for attribution, so it must be policed
   * alongside `brand` — the two can differ.
   */
  vendorName: string | null;
  category: string | null;
}

/**
 * The two gate rules, isolated from I/O.
 *
 *   - subscription (interview questions): named iff the vendor is subscribed.
 *     A boost targets a specific post and enterprise is the designer's tier —
 *     neither is knowable at interview time, so subscription is the only signal.
 *   - prose (published article): named iff subscribed OR an approved boost on
 *     this post OR the posting account is ENTERPRISE.
 */
export function decideNaming(
  signals: NamingSignals,
  mode: NamingMode
): { named: boolean; reason: NamingReason } {
  if (mode === 'subscription') {
    return signals.vendorSubscribed
      ? { named: true, reason: 'vendor_subscribed' }
      : { named: false, reason: 'not_subscribed' };
  }

  // prose: subscribed OR boosted OR enterprise
  if (signals.vendorSubscribed) return { named: true, reason: 'vendor_subscribed' };
  if (signals.boostApproved) return { named: true, reason: 'boost_approved' };
  if (signals.enterprise) return { named: true, reason: 'enterprise' };
  return { named: false, reason: 'not_eligible' };
}
