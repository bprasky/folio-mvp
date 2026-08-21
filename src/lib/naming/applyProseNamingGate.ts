/**
 * The Product Naming Gate, as a function any writer of final prose can call.
 *
 * Spec 20 calls this "the single deterministic chokepoint over final prose" — a
 * product name reaches a published article only if its vendor is subscribed, an
 * approved boost covers it, or the posting account is ENTERPRISE. Otherwise the
 * name is replaced with a brand-free descriptor.
 *
 * It lived inside generateEditorialDraft, reachable only from a full generation.
 * That made it a chokepoint over ONE path rather than over final prose: section
 * regenerate wrote a freshly-written body straight to the database and never
 * passed through it, so a single button press put a gated name back into a
 * published article with nothing downstream to catch it.
 *
 * A commercial gate that one writer can walk around is not a gate. It lives here
 * now, and every path that writes prose calls this — see
 * scripts/check-naming-gate-coverage.ts, which fails if a new one doesn't.
 */

import { BlocksSchema, type Blocks } from '@/lib/posting/schemas';
import { resolveProductNaming } from './resolveProductNaming';
import { scrubProseNaming, type DescriptorHint } from './scrubProse';

export interface NamingGateContext {
  /** Every product tagged on the project — not just the section being written. */
  productIds: Array<string | null | undefined>;
  projectId: string | null;
  postingUserId: string | null;
  /** Correlation id for the log line. */
  cid: string;
  /** Label for the log line, so the two call sites are distinguishable. */
  source: 'generate' | 'section-regenerate';
}

export async function applyProseNamingGate(
  blocks: Blocks,
  ctx: NamingGateContext,
): Promise<Blocks> {
  const ids = ctx.productIds.filter((id): id is string => typeof id === 'string');
  if (ids.length === 0) return blocks;

  const naming = await resolveProductNaming(ids, {
    mode: 'prose',
    projectId: ctx.projectId,
    postingUserId: ctx.postingUserId,
  });

  // Descriptor hints (source 1): the model emits a brand-free descriptor per
  // materials-ledger item in its `finish` field. Match each ledger item back to
  // a product — by productId if the model echoed one, otherwise by exact name
  // (the prompt requires exact product names) — and feed it as the emitted
  // descriptor. The deterministic category+finish assembly (source 2) still
  // applies for anything unmatched.
  const nameToProductId = new Map<string, string>();
  for (const n of Array.from(naming.values())) {
    if (n.name) nameToProductId.set(n.name.trim().toLowerCase(), n.productId);
  }
  const hints = new Map<string, DescriptorHint>();
  for (const item of blocks.materialsLedger?.items ?? []) {
    const emitted = typeof item.finish === 'string' ? item.finish.trim() : '';
    if (!emitted) continue;
    const pid = item.productId ?? (item.name ? nameToProductId.get(item.name.trim().toLowerCase()) : undefined);
    if (pid) hints.set(pid, { emitted });
  }

  const { blocks: scrubbed, replacements } = scrubProseNaming(blocks, naming, hints);
  const gated = Array.from(naming.values()).filter((n) => !n.named).length;
  console.info('[naming] product_naming_gate', {
    cid: ctx.cid, source: ctx.source, products: naming.size, gated, replacements,
  });

  // Re-validate as a guard. The scrub is a structure-preserving string transform,
  // but swapping a short name for a longer descriptor can push a field past a
  // soft length cap (e.g. lead.kicker max 120). That is not a reason to fail
  // generation or — worse — to fall back to un-scrubbed prose, so on a validation
  // miss we keep the scrubbed (leak-free) blocks and log rather than throw.
  const revalidated = BlocksSchema.safeParse(scrubbed);
  if (!revalidated.success) {
    console.warn('[naming] product_naming_gate_revalidation', {
      cid: ctx.cid, source: ctx.source, issues: revalidated.error.issues.slice(0, 3),
    });
    return scrubbed;
  }
  return revalidated.data;
}
