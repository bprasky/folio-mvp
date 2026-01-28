/**
 * GET /api/share-cards/[contributionId]/[variant]
 * Get or generate a specific variant share card
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  generateShareCard,
  type ShareCardVariant,
} from '@/lib/share-cards';

const VALID_VARIANTS: ShareCardVariant[] = [
  'instagram_story',
  'instagram_post',
  'linkedin',
  'twitter',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contributionId: string; variant: string }> }
) {
  try {
    const { contributionId, variant } = await params;

    // Validate variant
    if (!VALID_VARIANTS.includes(variant as ShareCardVariant)) {
      return NextResponse.json(
        { error: 'Invalid variant' },
        { status: 400 }
      );
    }

    // Check for existing share card
    let shareCard = await prisma.shareCard.findFirst({
      where: {
        contributionId,
        variant,
      },
    });

    // Generate if doesn't exist
    if (!shareCard) {
      const session = await getServerSession(authOptions);

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required to generate share card' },
          { status: 401 }
        );
      }

      const result = await generateShareCard({
        contributionId,
        variant: variant as ShareCardVariant,
      });

      if (!result) {
        return NextResponse.json(
          { error: 'Failed to generate share card' },
          { status: 500 }
        );
      }

      return NextResponse.json({ shareCard: result });
    }

    return NextResponse.json({
      shareCard: {
        id: shareCard.id,
        contributionId: shareCard.contributionId,
        imageUrl: shareCard.imageUrl,
        quote: shareCard.quote,
        attribution: shareCard.attribution,
        articleTitle: shareCard.articleTitle,
        articleUrl: shareCard.articleUrl,
        variant: shareCard.variant,
        generatedAt: shareCard.generatedAt,
      },
    });
  } catch (error) {
    console.error('[GET /api/share-cards/[contributionId]/[variant]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share card' },
      { status: 500 }
    );
  }
}
