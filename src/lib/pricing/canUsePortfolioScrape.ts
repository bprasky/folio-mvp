import { prisma } from '@/lib/prisma';
import { isFoundingDesigner } from './founding-designer';
import { DESIGNER_EARLY_ACCESS_ENABLED } from './early-access';

/**
 * Portfolio scraping (paste-a-URL import) is a premium capability.
 * Available to founding designers (lifetime Pro) and paid tiers.
 */
const SCRAPE_TIERS = ['PRO', 'STUDIO', 'ENTERPRISE'] as const;

/**
 * Server-side gate: can this user use the portfolio-URL scrape path?
 * Founding designers qualify regardless of tier nuance; otherwise the
 * subscription tier must be one of the paid tiers.
 */
export async function canUsePortfolioScrape(userId: string): Promise<boolean> {
  // Route-level authentication and project ownership still apply.
  if (!userId) return false;
  if (DESIGNER_EARLY_ACCESS_ENABLED) return true;

  if (await isFoundingDesigner(userId)) return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });

  if (!user) return false;
  return (SCRAPE_TIERS as readonly string[]).includes(user.subscriptionTier);
}

/**
 * Pure predicate for the client/RSC when the tier is already known.
 * Note: founding-designer status (lifetime Pro) reads as PRO here, so this
 * also returns true for founders.
 */
export function canScrapeFromTier(tier: string | null | undefined): boolean {
  if (!tier) return false;
  if (DESIGNER_EARLY_ACCESS_ENABLED) return true;
  return (SCRAPE_TIERS as readonly string[]).includes(tier);
}
