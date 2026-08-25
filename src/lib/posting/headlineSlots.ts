/**
 * Slot resolution for the headline frame library.
 *
 * Frames and eligibility are declared in `@/lib/interview/prompts/headlineFrames`,
 * which is pure by design — every file under `src/lib/interview/prompts/` is free
 * of Prisma, the AI SDKs and `next/*`, and that purity is what lets any route
 * import a prompt without dragging the database in. Reading rows to FILL a slot is
 * therefore done here, beside the rest of the headline machinery (`headline.ts`,
 * `headlineEditor.ts`, `loadInterviewAnswers.ts`).
 *
 * ── What counts as a material value ───────────────────────────────────────────
 *
 * Only a finish a HUMAN stated. `ProductTag.finishConfirmed` is true exactly when
 * the designer typed or edited the finish on the tag (AdvancedTagProducts,
 * ProductTagPicker, tag-product-to-image); the auto-tagger and the room image
 * generator both write proposed finishes with `finishConfirmed: false`. The schema
 * says why the column exists: it "is the only thing separating an observed finish
 * from a suggested one".
 *
 * A headline is the one line a stranger reads, so it takes the observed value or
 * none. Two sources are deliberately refused:
 *
 *   - A material named in interview PROSE. The interview is where the frame's tail
 *     comes from, but a noun the model found in a paragraph is not a structured
 *     value and cannot be traced to a row.
 *   - A material INFERRED from a product name or category. `buildDescriptor` in the
 *     naming gate will happily turn "Antolini Calacatta slab" into "a marble" —
 *     correct for a swap-in descriptor, not evidence the designer specified marble.
 *
 * ── Why no brand can reach a headline ─────────────────────────────────────────
 *
 * `docs/20` gates product and brand names out of published prose unless the
 * exposure is paid for, and calls the sentence "Folio's most valuable editorial
 * real estate". A headline is the most valuable sentence there is. The structural
 * protection is that this resolver can only ever return a FINISH value — it never
 * reads `Product.name` or `Product.brand` into a slot — so a gated name has no path
 * in and the frame needs no gate of its own.
 *
 * The one hole in that argument is a designer typing a brand into the finish field
 * ("Calacatta Gold by Antolini"). `docs/20` is explicit that the gate is
 * deterministic and never trusts a prompt, so that case is checked here rather than
 * asked for: a finish containing its own product's name or brand is refused.
 */

import { prisma } from '@/lib/prisma';
import type { ResolvedSlot } from '@/lib/interview/prompts/headlineFrames';

/** A confirmed finish, with the evidence that made it usable. */
export interface MaterialCandidate {
  /** The designer's own wording, e.g. "unlacquered brass". */
  value: string;
  /** How many tags across the project carry it. */
  tagCount: number;
  /** Distinct images it appears on — a material in three rooms is the project's. */
  imageCount: number;
}

/** Normalize for comparison only. The designer's wording is what ships. */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Does this finish carry the brand or product name it belongs to?
 *
 * Token-based rather than substring, so "brass" inside "Brasserie" cannot trip it
 * while "Antolini" inside "Calacatta Gold by Antolini" does. Short tokens are
 * skipped: a product called "Ash" would otherwise disqualify the finish "ash",
 * which is the material noun we want.
 */
function carriesProprietaryName(finish: string, productName?: string | null, brand?: string | null): boolean {
  const haystack = norm(finish);
  for (const source of [productName, brand]) {
    if (!source) continue;
    const tokens = norm(source).split(' ').filter((t) => t.length > 3);
    if (tokens.length === 0) continue;
    if (tokens.every((t) => haystack.includes(t))) return true;
  }
  return false;
}

/**
 * Every designer-confirmed material on a project, most-specified first.
 *
 * Ranked by images rather than by tags: five tags of the same brass on one
 * photograph is one decision photographed five times, while the same brass in
 * three rooms is the project answering to it. Ties break on tag count and then
 * alphabetically, so a batch is reproducible across presses.
 */
export async function resolveMaterialCandidates(projectId: string): Promise<MaterialCandidate[]> {
  const tags = await prisma.productTag.findMany({
    where: {
      finishConfirmed: true,
      image: { projectId },
    },
    select: {
      imageId: true,
      finishRaw: true,
      finishCanonical: true,
      product: { select: { name: true, brand: true } },
    },
  });

  const byValue = new Map<string, { value: string; tagCount: number; images: Set<string> }>();
  for (const tag of tags) {
    // finishRaw is the designer's wording and is what a headline should say.
    // finishCanonical is the grouping column and is only a fallback.
    const raw = (tag.finishRaw ?? tag.finishCanonical ?? '').trim();
    if (!raw) continue;
    if (carriesProprietaryName(raw, tag.product?.name, tag.product?.brand)) continue;

    const key = norm(raw);
    const prev = byValue.get(key) ?? { value: raw, tagCount: 0, images: new Set<string>() };
    prev.tagCount += 1;
    prev.images.add(tag.imageId);
    byValue.set(key, prev);
  }

  return Array.from(byValue.values())
    .map((v) => ({ value: v.value, tagCount: v.tagCount, imageCount: v.images.size }))
    .sort(
      (a, b) =>
        b.imageCount - a.imageCount ||
        b.tagCount - a.tagCount ||
        a.value.localeCompare(b.value),
    );
}

export interface ResolvedHeadlineSlots {
  slots: ResolvedSlot[];
  /** Every confirmed material, for logging and for the prompt's context block. */
  materials: MaterialCandidate[];
}

/**
 * Resolve every slot the frame library can fill for this project.
 *
 * Returns verified values only. An unverified value is not returned as an
 * unverified slot, because `eligibleFrames` would then have to decide what to do
 * with it — and a frame that fires on a proposed finish is the fabrication the
 * whole design exists to prevent. Absent is the correct representation of
 * "nobody stated this".
 */
export async function resolveHeadlineSlots(projectId: string): Promise<ResolvedHeadlineSlots> {
  const materials = await resolveMaterialCandidates(projectId);
  const slots: ResolvedSlot[] = [];

  if (materials.length > 0) {
    slots.push({
      name: 'material',
      value: materials[0].value,
      source: `ProductTag.finishRaw across ${materials[0].imageCount} image(s)`,
      verified: true,
    });
  }

  return { slots, materials };
}
