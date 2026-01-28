/**
 * GET /api/share-cards/[contributionId]
 * Get existing share cards for contribution
 *
 * POST /api/share-cards/[contributionId]
 * Generate share card(s)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getShareCards,
  generateShareCard,
  generateAllVariants,
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
  { params }: { params: Promise<{ contributionId: string }> }
) {
  try {
    const { contributionId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const shareCards = await getShareCards(contributionId);

    return NextResponse.json({
      shareCards,
      count: shareCards.length,
    });
  } catch (error) {
    console.error('[GET /api/share-cards/[contributionId]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share cards' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contributionId: string }> }
) {
  try {
    const { contributionId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { variants, customQuote } = body;

    // If specific variants requested, generate those
    if (variants && Array.isArray(variants)) {
      const validVariants = variants.filter((v): v is ShareCardVariant =>
        VALID_VARIANTS.includes(v)
      );

      if (validVariants.length === 0) {
        return NextResponse.json(
          { error: 'No valid variants specified' },
          { status: 400 }
        );
      }

      const results = [];
      for (const variant of validVariants) {
        const result = await generateShareCard({
          contributionId,
          variant,
          customQuote,
        });
        if (result) results.push(result);
      }

      return NextResponse.json({
        success: true,
        shareCards: results,
        count: results.length,
      });
    }

    // Otherwise generate all variants
    const results = await generateAllVariants(contributionId);

    return NextResponse.json({
      success: true,
      shareCards: results,
      count: results.length,
    });
  } catch (error) {
    console.error('[POST /api/share-cards/[contributionId]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate share cards' },
      { status: 500 }
    );
  }
}
