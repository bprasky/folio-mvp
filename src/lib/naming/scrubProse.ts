/**
 * Product Naming Gate (spec 20) — the prose scrub. This is the guarantee.
 *
 * A deterministic pass over final article prose: for every tagged product that
 * is NOT eligible to be named, replace occurrences of its brand/product name
 * with its descriptor. Eligible products are left named. This catches names
 * from the designer's own answer, not just the model's framing — prompt
 * guidance reduces leaks; this pass eliminates them.
 *
 * NEVER scrubbed: the credits block and the materials ledger. Those are the
 * designer's attribution and the product credits — composed from the tag set
 * directly, always named/tagged/linked (spec 20 invariant).
 *
 * Pure and synchronous: eligibility (the three signals) is resolved upstream by
 * `resolveProductNaming`; this function only applies the resulting map, so it is
 * deterministic and unit-testable without a database.
 */

import type { Blocks } from '@/lib/posting/schemas';
import { buildDescriptor } from './descriptor';
import type { ProductNaming } from './namingRules';

/** Per-product descriptor inputs a caller may supply to sharpen the swap text. */
export interface DescriptorHint {
  colorFinish?: string | null;
  /** A descriptor the generator emitted alongside the named mention (source 1). */
  emitted?: string | null;
}

export interface ScrubResult {
  blocks: Blocks;
  /** Number of name/brand occurrences replaced. Useful for tests and logging. */
  replacements: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Replacer {
  target: string;
  re: RegExp;
  descriptor: string;
}

/**
 * Scrub non-eligible product names/brands from article prose, replacing each
 * with the product's descriptor.
 */
export function scrubProseNaming(
  blocks: Blocks,
  naming: Map<string, ProductNaming>,
  hints?: Map<string, DescriptorHint>
): ScrubResult {
  const values = Array.from(naming.values());

  // A name/brand that ANY eligible product also uses cannot be attributed to the
  // ineligible product alone in free prose, so it is never scrubbed. The shared
  // string is a legitimately paid-for name (the eligible product's), so keeping
  // it avoids corrupting a paid mention — the rare collision biases to the
  // eligible product, not to a leak of a genuinely unpaid-only name.
  const eligibleNames = new Set(
    values.filter((n) => n.named && n.name).map((n) => n.name!.trim().toLowerCase())
  );
  // Brand-like aliases (Product.brand and the vendor display name) that any
  // eligible product uses — never scrubbed, since a shared brand can't be
  // attributed to the ineligible product alone in free prose.
  const eligibleBrands = new Set<string>();
  for (const n of values) {
    if (!n.named) continue;
    if (n.brand) eligibleBrands.add(n.brand.trim().toLowerCase());
    if (n.vendorName) eligibleBrands.add(n.vendorName.trim().toLowerCase());
  }

  const replacers: Replacer[] = [];
  const seen = new Set<string>();
  const addReplacer = (target: string | null | undefined, descriptor: string) => {
    if (!target) return;
    const t = target.trim();
    if (t.length < 2) return; // never scrub a single character
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    // Word-boundary lookarounds so "Atwell" doesn't match inside "Atwellington".
    // Optionally swallow a preceding article so "The Atwell Pendant" becomes
    // "a clear glass pendant", not "The a clear glass pendant".
    replacers.push({
      target: t,
      re: new RegExp(`(?<!\\w)((?:the|a|an)\\s+)?${escapeRegExp(t)}(?!\\w)`, 'gi'),
      descriptor,
    });
  };

  for (const n of values) {
    if (n.named) continue;
    const hint = hints?.get(n.productId);
    const descriptor = buildDescriptor({
      category: n.category,
      colorFinish: hint?.colorFinish,
      name: n.name,
      emitted: hint?.emitted,
    });

    const name = n.name?.trim() || null;
    const nameSafe = !!name && !eligibleNames.has(name.toLowerCase());

    // Brand-like aliases the generator may have used for this product: its brand
    // and the vendor display name it was fed. Dedup; skip any shared by an
    // eligible product.
    const aliases: string[] = [];
    for (const raw of [n.brand, n.vendorName]) {
      const a = raw?.trim();
      if (!a) continue;
      if (eligibleBrands.has(a.toLowerCase())) continue;
      if (!aliases.some((x) => x.toLowerCase() === a.toLowerCase())) aliases.push(a);
    }

    // Combined phrases first (longest), then the bare name, then bare aliases.
    for (const alias of aliases) {
      if (nameSafe) {
        addReplacer(`${name} by ${alias}`, descriptor);
        addReplacer(`${alias} ${name}`, descriptor);
      }
    }
    if (nameSafe) addReplacer(name, descriptor);
    for (const alias of aliases) addReplacer(alias, descriptor);
  }

  // Longest target first so a combined "Name by Brand" phrase is replaced before
  // its component "Name" or "Brand" can match.
  replacers.sort((a, b) => b.target.length - a.target.length);

  let replacements = 0;
  const scrub = (s: string): string => {
    if (s.length === 0) return s;
    let out = s;
    for (const r of replacers) {
      out = out.replace(r.re, (_match, article: string | undefined) => {
        replacements++;
        // Preserve sentence-start capitalization when we consumed a capitalized
        // article (e.g. "The Atwell Pendant" → "A clear glass pendant").
        if (article && /^[A-Z]/.test(article)) {
          return r.descriptor.charAt(0).toUpperCase() + r.descriptor.slice(1);
        }
        return r.descriptor;
      });
    }
    return out;
  };
  const scrubOpt = (s: string | null | undefined): string | undefined =>
    typeof s === 'string' ? scrub(s) : undefined;

  // Nothing to do — return the original blocks untouched.
  if (replacers.length === 0) return { blocks, replacements: 0 };

  const next: Blocks = { ...blocks };

  if (blocks.lead) {
    next.lead = {
      ...blocks.lead,
      title: scrubOpt(blocks.lead.title),
      kicker: scrubOpt(blocks.lead.kicker),
      deck: scrubOpt(blocks.lead.deck),
    };
  }

  if (blocks.introduction) {
    next.introduction = blocks.introduction.map((p) => scrub(p));
  }

  if (blocks.galleryChapters) {
    next.galleryChapters = blocks.galleryChapters.map((ch) => ({
      ...ch,
      title: scrubOpt(ch.title),
      body: ch.body?.map((p) => scrub(p)),
      pullQuote: scrubPullQuote(ch.pullQuote, scrub),
    }));
  }

  if (blocks.pullQuotes) {
    next.pullQuotes = blocks.pullQuotes.map((q) =>
      typeof q === 'string' ? scrub(q) : { ...q, text: scrub(q.text) }
    );
  }

  if (blocks.hookQuote) {
    next.hookQuote = { ...blocks.hookQuote, text: scrub(blocks.hookQuote.text) };
  }

  if (blocks.method) {
    next.method = blocks.method.map((m) => scrub(m));
  }

  if (blocks.qa) {
    next.qa = blocks.qa.map((item) => ({ ...item, q: scrub(item.q), a: scrub(item.a) }));
  }

  // credits, materialsLedger, data, mode: NEVER scrubbed — passthrough untouched.

  return { blocks: next, replacements };
}

// A chapter pullQuote is either a plain string, a { selected, alternatives }
// selection object, or null. Scrub every prose string it carries.
function scrubPullQuote(
  pq: NonNullable<Blocks['galleryChapters']>[number]['pullQuote'],
  scrub: (s: string) => string
): NonNullable<Blocks['galleryChapters']>[number]['pullQuote'] {
  if (pq == null) return pq;
  if (typeof pq === 'string') return scrub(pq);
  return {
    ...pq,
    selected: pq.selected ? { ...pq.selected, text: scrub(pq.selected.text) } : pq.selected,
    alternatives: pq.alternatives.map((alt) => ({ ...alt, text: scrub(alt.text) })),
  };
}
