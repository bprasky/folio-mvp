/**
 * Share Card Generation
 * Generates shareable images for contributions
 */

import { prisma } from '@/lib/prisma';
import { generateShareCardSvg, truncateQuote } from './templates';
import type {
  ShareCardVariant,
  ShareCardData,
  ShareCardResult,
  GenerateShareCardOptions,
} from './types';

// For now, we'll store share cards as SVG data URLs
// In production, this would upload to Supabase storage

/**
 * Generate a share card for a contribution
 */
export async function generateShareCard(
  options: GenerateShareCardOptions
): Promise<ShareCardResult | null> {
  const { contributionId, variant, customQuote } = options;

  // Fetch contribution with related data
  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      articleTopic: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      publishedInPost: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
  });

  if (!contribution) {
    console.error(`[generateShareCard] Contribution not found: ${contributionId}`);
    return null;
  }

  // Determine the quote to use
  const quote = customQuote || contribution.pullQuote || truncateQuote(contribution.content, 200);

  // Build attribution
  const attribution = contribution.user.name;
  const userTitle = getRoleTitle(contribution.user.role);

  // Build article URL
  const articleUrl = contribution.publishedInPost?.slug
    ? `https://folio.io/p/${contribution.publishedInPost.slug}`
    : `https://folio.io/article-topics/${contribution.articleTopic.slug}`;

  // Generate SVG
  const cardData: ShareCardData = {
    quote,
    attribution,
    userTitle,
    articleTitle: contribution.articleTopic.title,
    articleUrl,
    variant,
  };

  const svg = generateShareCardSvg(cardData);

  // Convert SVG to data URL
  const svgBase64 = Buffer.from(svg).toString('base64');
  const imageUrl = `data:image/svg+xml;base64,${svgBase64}`;

  // Check for existing share card
  const existingCard = await prisma.shareCard.findFirst({
    where: {
      contributionId,
      variant,
    },
  });

  // Create or update share card record
  const shareCard = existingCard
    ? await prisma.shareCard.update({
        where: { id: existingCard.id },
        data: {
          imageUrl,
          quote,
          attribution,
          articleTitle: contribution.articleTopic.title,
          articleUrl,
          generatedAt: new Date(),
        },
      })
    : await prisma.shareCard.create({
        data: {
          contributionId,
          imageUrl,
          quote,
          attribution,
          articleTitle: contribution.articleTopic.title,
          articleUrl,
          variant,
        },
      });

  // Update contribution's shareCardUrl (using first variant as primary)
  if (variant === 'instagram_post') {
    await prisma.contribution.update({
      where: { id: contributionId },
      data: {
        shareCardUrl: imageUrl,
        shareCardGeneratedAt: new Date(),
      },
    });
  }

  return {
    id: shareCard.id,
    contributionId: shareCard.contributionId || '',
    imageUrl: shareCard.imageUrl,
    quote: shareCard.quote,
    attribution: shareCard.attribution,
    articleTitle: shareCard.articleTitle,
    articleUrl: shareCard.articleUrl,
    variant: shareCard.variant as ShareCardVariant,
    generatedAt: shareCard.generatedAt,
  };
}

/**
 * Generate all share card variants for a contribution
 */
export async function generateAllVariants(
  contributionId: string
): Promise<ShareCardResult[]> {
  const variants: ShareCardVariant[] = ['instagram_story', 'instagram_post', 'linkedin', 'twitter'];
  const results: ShareCardResult[] = [];

  for (const variant of variants) {
    const result = await generateShareCard({ contributionId, variant });
    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Get existing share cards for a contribution
 */
export async function getShareCards(contributionId: string): Promise<ShareCardResult[]> {
  const cards = await prisma.shareCard.findMany({
    where: { contributionId },
    orderBy: { generatedAt: 'desc' },
  });

  return cards.map((card) => ({
    id: card.id,
    contributionId: card.contributionId || '',
    imageUrl: card.imageUrl,
    quote: card.quote,
    attribution: card.attribution,
    articleTitle: card.articleTitle,
    articleUrl: card.articleUrl,
    variant: card.variant as ShareCardVariant,
    generatedAt: card.generatedAt,
  }));
}

/**
 * Track a share event
 */
export async function trackShareEvent(
  contributionId: string,
  action: 'download' | 'share'
): Promise<void> {
  await prisma.contribution.update({
    where: { id: contributionId },
    data: {
      shareCount: { increment: 1 },
    },
  });
}

/**
 * Get friendly role title
 */
function getRoleTitle(role: string): string {
  const titles: Record<string, string> = {
    DESIGNER: 'Interior Designer',
    ARCHITECT: 'Architect',
    BUILDER: 'Builder',
    VENDOR: 'Industry Professional',
    INDIVIDUAL: '',
    ADMIN: 'Folio Team',
  };
  return titles[role] || '';
}
