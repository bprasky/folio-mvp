/**
 * Product Record rules (spec 22_PRODUCT_RECORD).
 *
 * Pure functions only — no Prisma, no I/O. The maturity ladder, the testimony
 * gate, the coverage sentence, and the evidentiary ordering all live here so
 * they can be reasoned about and tested without a database, and so there is one
 * place to look when someone asks why a record is or is not an Article.
 *
 * The gate is applied in the server query (`getProductRecord`), never in a
 * component — same doctrine as `imageProvenance.ts`. A component that receives
 * testimony it should not render has already lost, because the payload is in the
 * RSC stream whether or not the JSX draws it.
 */

import type {
  ProductRecordTier,
  TestimonyClass,
  VendorRecordState,
} from '@prisma/client';

// ─── Audiences ──────────────────────────────────────────────────────────────

/**
 * Who is looking at the record.
 *
 * - `DESIGNER` — an authenticated Folio designer. They wrote this corpus;
 *   knowing what peers said before specifying is the intelligence product they
 *   subscribe for.
 * - `VENDOR_OWNER` — a member of the vendor organization whose product this is.
 * - `PUBLIC` — everyone else, authenticated or not.
 */
export type RecordAudience = 'PUBLIC' | 'DESIGNER' | 'VENDOR_OWNER';

/**
 * Whether one piece of testimony may be rendered to this audience.
 *
 * The counts are never gated — only the content. Locked testimony with visible
 * counts is what drives designer signup and what shows the vendor exactly how
 * much is circulating among specifiers that they cannot read.
 *
 * `VENDOR_OWNER` and `PUBLIC` resolve identically on volunteer content, and that
 * is not an oversight: claiming is free, and the moment a vendor claims,
 * volunteer quotes go public. The two branches are written out separately
 * because they are two different rules from the spec that happen to agree, and
 * collapsing them would hide the day one of them changes.
 */
export function isTestimonyVisible(
  audience: RecordAudience,
  vendorState: VendorRecordState,
  testimonyClass: TestimonyClass,
): boolean {
  // Authenticated designers see everything, always. No vendor state gates a
  // designer out of the corpus they authored.
  if (audience === 'DESIGNER') return true;

  // Commissioned testimony is not gated on the vendor's CURRENT state. It only
  // exists because a request was paid for, so the gate already ran upstream at
  // purchase. This is the point of the superseded subscription-unlock model:
  // publication is a consequence of the testimony existing, and a record does
  // not collapse back to locked when a vendor lapses.
  if (testimonyClass === 'COMMISSIONED') return true;

  // Volunteer quotes. Public on claim, invisible before it — to the public and
  // to the unclaimed vendor alike. Enough to price the decision, not enough to
  // satisfy it.
  if (audience === 'VENDOR_OWNER') return vendorState !== 'TAGGED';
  return vendorState !== 'TAGGED';
}

// ─── Maturity ladder ────────────────────────────────────────────────────────

/** One specification event: a designer tagged this product into a project. */
export interface SpecificationEvent {
  /** Project's designer, falling back to its owner. Null only if neither resolves. */
  designerId: string | null;
  projectId: string;
}

/** One piece of testimony about this product. */
export interface TestimonyEvent {
  designerId: string | null;
  testimonyClass: TestimonyClass;
}

export interface RecordLadderInput {
  specifications: SpecificationEvent[];
  testimony: TestimonyEvent[];
}

/** Article tier thresholds. Named because the numbers are the whole argument. */
export const ARTICLE_DISTINCT_DESIGNERS = 3;
export const ARTICLE_DISTINCT_PROJECTS = 3;
export const ARTICLE_COMMISSIONED_TESTIMONIES = 2;

/**
 * Evaluate the maturity ladder.
 *
 * LISTING — the product exists. RECORD — at least one specification event.
 * ARTICLE — the independence gate: 3 distinct designers across 3 distinct
 * projects, including 2+ commissioned testimonies.
 *
 * Distinctness is enforced on designer identity and on project, never on tag
 * count. Counting tags would let one designer tag one product into one project
 * eleven times and call it an article.
 *
 * The commissioned testimonies must come from distinct designers too. Two
 * commissioned testimonies from the same designer are one designer's account
 * twice, which is precisely what the gate exists to reject — one friendly
 * designer and one vendor must not be able to manufacture an article between
 * them, and letting a vendor buy two requests from the same person is the
 * cheapest way to do it.
 *
 * A record populated entirely by volunteer quotes never reaches Article tier.
 * Volunteer content is a teaser for the vendor and a courtesy to the designer.
 * It is not the asset.
 */
export function evaluateRecordTier(input: RecordLadderInput): ProductRecordTier {
  if (input.specifications.length === 0) return 'LISTING';

  const designers = new Set<string>();
  const projects = new Set<string>();
  for (const spec of input.specifications) {
    if (spec.designerId) designers.add(spec.designerId);
    projects.add(spec.projectId);
  }

  const commissionedDesigners = new Set<string>();
  for (const t of input.testimony) {
    if (t.testimonyClass === 'COMMISSIONED' && t.designerId) {
      commissionedDesigners.add(t.designerId);
    }
  }

  const independent =
    designers.size >= ARTICLE_DISTINCT_DESIGNERS &&
    projects.size >= ARTICLE_DISTINCT_PROJECTS &&
    commissionedDesigners.size >= ARTICLE_COMMISSIONED_TESTIMONIES;

  return independent ? 'ARTICLE' : 'RECORD';
}

// ─── Coverage disclosure ────────────────────────────────────────────────────

export interface RecordCoverage {
  specifierCount: number;
  projectCount: number;
  testimonyCount: number;
}

/**
 * The sentence every Product Record publishes on its face:
 *
 *   "Specified by 40 designers across 47 projects. 6 have testified."
 *
 * Selective asking becomes visible rather than forbidden. A vendor who
 * commissions three of forty produces a record that announces the ratio, and
 * readers price it accordingly. Disclosure does more work than enforcement,
 * because it makes the gaming self-defeating instead of policed — which is why
 * this string is not optional and not conditional on the ratio being flattering.
 */
export function coverageDisclosure(coverage: RecordCoverage): string {
  const { specifierCount, projectCount, testimonyCount } = coverage;

  if (specifierCount === 0) return 'Not yet specified on Folio.';

  const designers = `${specifierCount} ${specifierCount === 1 ? 'designer' : 'designers'}`;
  const projects = `${projectCount} ${projectCount === 1 ? 'project' : 'projects'}`;
  const specified = `Specified by ${designers} across ${projects}.`;

  // The zero case is stated, not omitted. On the Prospective Page the absence is
  // the entire pitch, and a record that quietly drops the sentence when nobody
  // has testified is a record that hides its own ratio.
  if (testimonyCount === 0) return `${specified} None have testified yet.`;

  return `${specified} ${testimonyCount} ${testimonyCount === 1 ? 'has' : 'have'} testified.`;
}

// ─── Evidentiary ordering ───────────────────────────────────────────────────

/** The inputs the ordering is allowed to see. Contributor standing is not one. */
export interface RankableTestimony {
  testimonyClass: TestimonyClass;
  /** The designer's own in-situ photograph of this product installed. */
  hasInstallShot: boolean;
  createdAt: Date;
}

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
const MAX_ELAPSED_YEARS_SCORED = 3;

/**
 * Evidentiary weight for one piece of testimony (spec `21_ASSET_MATRIX` §8,
 * which governs the Product Record because the Record is the Product entity at
 * Corpus scope).
 *
 * "Ordering is by evidentiary weight, not by contributor prestige. A quote with
 * an install shot outranks a quote without one. A quote at two years outranks a
 * quote at two weeks. Prestige is one input, never the sort key."
 *
 * Note what is absent: follower count, designer tier, firm size, boost spend.
 * Ranking by contributor standing produces a leaderboard and tells a smaller
 * designer their evidence is worth less, which is the opposite of the position
 * Folio holds. Nothing may be added to this function that a vendor could buy.
 *
 * The weights are a starting point and are meant to be tuned against a real
 * corpus. Their relative order is not: commissioned outranks volunteer, an
 * install shot outranks none, and elapsed time outranks freshness.
 */
export function evidentiaryWeight(t: RankableTestimony, now: Date = new Date()): number {
  let score = 0;

  // Commissioned testimony was elicited through the canonical interviewer
  // against named conditions. Volunteer quotes are a courtesy and a teaser.
  if (t.testimonyClass === 'COMMISSIONED') score += 4;

  // The install shot is the half of the evidence a vendor cannot produce.
  if (t.hasInstallShot) score += 2;

  // Elapsed time, not recency. A quote at install and a quote two years later
  // are different kinds of evidence, and the second is the one no other party
  // can produce — it required holding the relationship for two years.
  const years = Math.floor((now.getTime() - t.createdAt.getTime()) / MS_PER_YEAR);
  score += Math.max(0, Math.min(years, MAX_ELAPSED_YEARS_SCORED));

  return score;
}

/**
 * Sort testimony by evidentiary weight, newest first within a tie. Returns a new
 * array; does not mutate the input.
 */
export function rankTestimony<T extends RankableTestimony>(items: T[], now: Date = new Date()): T[] {
  return [...items].sort((a, b) => {
    const delta = evidentiaryWeight(b, now) - evidentiaryWeight(a, now);
    if (delta !== 0) return delta;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
