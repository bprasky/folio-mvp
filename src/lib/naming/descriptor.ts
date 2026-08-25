/**
 * Product Naming Gate (spec 20) — descriptor builder.
 *
 * A descriptor is the product rendered without its proprietary identity: form,
 * material, finish, and scale — but never brand or collection name. It is the
 * swap text used when a product is not eligible to be named in prose or in an
 * interview question.
 *
 * V1 descriptor source, in priority order (per spec):
 *   1. A descriptor the generator emitted alongside the named mention (handled
 *      at the call site; passed in as `emitted`).
 *   2. Otherwise, a deterministic assembly from category + finish.
 *
 * The descriptor is NEVER empty; a bare category ("a pendant") is the floor,
 * and "the piece" is the absolute floor when nothing is known.
 *
 * Finish extraction is a small self-contained keyword pass. It mirrors the
 * corpus digest's `materialClassOf` intent but is deliberately NOT coupled to
 * `src/lib/editorial-queue/signals.ts` — the gate must not depend on the
 * queue's internals.
 *
 * Note the two lists are not the same kind of thing, which is why this one keeps
 * its own name. `MATERIAL_CLASSES` over there holds material CLASSES (marble,
 * oak, brass); FINISH_FAMILIES here also carries finishes and colours (matte
 * black, brushed steel, white) because a descriptor's job is to describe the
 * object, not to classify its material.
 */

// Finish-family keywords, checked in order against colorFinish then name.
// "unlacquered brass" and "brushed brass" both normalize to "brass".
const FINISH_FAMILIES = [
  'brass', 'bronze', 'nickel', 'chrome', 'copper', 'gold', 'brushed steel',
  'stainless', 'steel', 'iron', 'matte black', 'black', 'white', 'walnut',
  'white oak', 'oak', 'ash', 'teak', 'marble', 'travertine', 'terrazzo',
  'concrete', 'linen', 'velvet', 'boucle', 'leather', 'rattan', 'cane',
  'lacquer', 'ceramic', 'glass',
] as const;

function finishOf(colorFinish: string | null | undefined, name: string | null | undefined): string | null {
  const haystack = `${colorFinish ?? ''} ${name ?? ''}`.toLowerCase();
  for (const family of FINISH_FAMILIES) {
    if (haystack.includes(family)) return family;
  }
  return null;
}

// Reduce a raw category ("Pendant Lighting", "SEATING") to a lowercase noun a
// descriptor can lead with. Keeps it a single, readable phrase.
function normalizeCategory(category: string | null | undefined): string | null {
  if (!category) return null;
  const trimmed = category.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export interface DescriptorInput {
  category?: string | null;
  colorFinish?: string | null;
  name?: string | null;
  /** A descriptor emitted by the generator alongside the named mention (source 1). */
  emitted?: string | null;
}

/**
 * Build a non-empty descriptor for a product. Prefers a generator-emitted
 * descriptor, then a deterministic category + finish assembly.
 */
export function buildDescriptor(input: DescriptorInput): string {
  const emitted = input.emitted?.trim();
  if (emitted) return emitted;

  const finish = finishOf(input.colorFinish, input.name);
  const category = normalizeCategory(input.category);

  if (finish && category) return `a ${finish} ${category}`;
  if (category) return `a ${category}`;
  if (finish) return `a ${finish} piece`;
  return 'the piece';
}
