/**
 * ScrapeAttempt recorder (spec 17 Phase 1).
 *
 * Writes one row per scrape attempt so the per-domain failure mode is
 * observable from data instead of console.error. The write is best effort and
 * must never throw into the scrape path: a failed insert is logged and
 * swallowed. Phase 2 reads the resulting `domain, outcome` distribution to seed
 * the escalation policy.
 */

import { prisma } from '@/lib/prisma';
import type { BrowserlessResult, ScrapeEndpoint } from './client';
import { classifyScrapeOutcome, isBlockedOutcome, type ScrapeOutcome } from './classify';

export type ScrapeConsumer =
  | 'VENDOR_WIZARD'
  | 'IMPORT_IMAGE'
  | 'IMPORT_WEBSITE'
  | 'DESIGNER_BIO'
  | 'PRODUCT_SCRAPE';

type ScrapeEscalation = 'NONE' | 'BASIC' | 'STEALTH' | 'RESIDENTIAL' | 'UNBLOCK' | 'BQL_SOLVE';
type ScrapeEndpointEnum = 'CONTENT' | 'FUNCTION' | 'SMART_SCRAPE' | 'UNBLOCK' | 'BQL' | 'DIRECT_FETCH';

const ENDPOINT_ENUM: Record<ScrapeEndpoint, ScrapeEndpointEnum> = {
  content: 'CONTENT',
  function: 'FUNCTION',
  'smart-scrape': 'SMART_SCRAPE',
  bql: 'BQL',
  direct: 'DIRECT_FETCH',
};

// Phase 1 runs nothing above a basic render, so a Browserless endpoint maps to
// BASIC and a direct fetch to NONE. Phase 2 sets the escalation explicitly per
// attempt and passes it through.
const ENDPOINT_ESCALATION: Record<ScrapeEndpoint, ScrapeEscalation> = {
  content: 'BASIC',
  function: 'BASIC',
  'smart-scrape': 'STEALTH',
  bql: 'BQL_SOLVE',
  direct: 'NONE',
};

export interface RecordScrapeInput {
  url: string;
  consumer: ScrapeConsumer;
  result: BrowserlessResult;
  /** Explicit outcome; when omitted the result is classified. */
  outcome?: ScrapeOutcome;
  /**
   * Parse-based emptiness for the THIN_CONTENT vs RENDERED_OK split. A detected
   * block (or timeout / error) is never overridden by this flag.
   */
  emptyResult?: boolean;
  /** Target page status parsed from a /function payload, overriding the result. */
  targetStatus?: number | null;
  escalationLevel?: ScrapeEscalation;
  importSessionId?: string | null;
  productId?: string | null;
}

/** The four outcomes that mean the target actively blocked us. */
const BLOCKED_OUTCOMES: ScrapeOutcome[] = [
  'BLOCKED_403',
  'BLOCKED_429',
  'CHALLENGE_PAGE',
  'CAPTCHA_PRESENT',
];

/**
 * True when a recent scrape of this exact URL was recorded as blocked. This is
 * the authorization breadcrumb for auto-escalation: the cheap path records a
 * blocked attempt, and the expensive BQL rung reads it to confirm the spend is
 * justified, without the domain needing to be on the static flagged list.
 * Best effort — a read failure returns false rather than throwing into the path.
 */
export async function hasRecentBlockedAttempt(url: string, withinMs = 30 * 60 * 1000): Promise<boolean> {
  try {
    const row = await prisma.scrapeAttempt.findFirst({
      where: {
        url,
        outcome: { in: BLOCKED_OUTCOMES as any },
        createdAt: { gte: new Date(Date.now() - withinMs) },
      },
      select: { id: true },
    });
    return row != null;
  } catch (err) {
    console.error('[scrapeAttempt] recent-block lookup failed:', err);
    return false;
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export async function recordScrapeAttempt(input: RecordScrapeInput): Promise<void> {
  try {
    const { result } = input;
    const targetStatus = input.targetStatus !== undefined ? input.targetStatus : result.targetStatus;

    let outcome: ScrapeOutcome =
      input.outcome ?? classifyScrapeOutcome({ ...result, targetStatus: targetStatus ?? null });

    if (
      input.outcome === undefined &&
      input.emptyResult !== undefined &&
      !isBlockedOutcome(outcome) &&
      outcome !== 'TIMEOUT' &&
      outcome !== 'BROWSERLESS_ERROR' &&
      outcome !== 'DIRECT_FETCH_FALLBACK'
    ) {
      outcome = input.emptyResult ? 'THIN_CONTENT' : 'RENDERED_OK';
    }

    await prisma.scrapeAttempt.create({
      data: {
        url: input.url,
        domain: domainOf(input.url),
        consumer: input.consumer as any,
        endpoint: ENDPOINT_ENUM[result.endpoint] as any,
        escalationLevel: (input.escalationLevel ?? ENDPOINT_ESCALATION[result.endpoint]) as any,
        targetStatus: targetStatus ?? null,
        outcome: outcome as any,
        durationMs: result.durationMs,
        importSessionId: input.importSessionId ?? null,
        productId: input.productId ?? null,
      },
    });
  } catch (err) {
    // Best effort: instrumentation must never throw into the scrape path.
    console.error('[scrapeAttempt] write failed:', err);
  }
}
