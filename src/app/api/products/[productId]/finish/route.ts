// @idor-allow: public-read reason="Authenticated designer finish proposal; returns only the extracted finish for a product the designer is about to tag, which is catalog data rather than another designer's specification"
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { proposedFinishByProductId } from '@/lib/products/proposedFinish';

/**
 * GET /api/products/[productId]/finish
 *
 * What extraction proposes as this product's finish (spec 21 delta D3).
 *
 * The tagger prefills from the scrape response in URL mode, where the finish
 * arrives with the preview. A catalog-search selection has no scrape to read,
 * so it asks here instead — same proposal, same source, one round trip.
 *
 * What this returns is `CachedProduct.finish`: what the URL says the product is,
 * shared across every designer. It is NOT another designer's `ProductTag
 * .finishRaw`, which is a specification decision and is never surfaced here.
 * Extraction proposes, the tag records, and the tag always wins.
 *
 * `source` is the field the UI needs to keep D3's central distinction visible:
 * an OBSERVED finish was read off the product page and may be stored
 * unconfirmed, because it is a fact about the product. Anything a model merely
 * inferred is a suggestion for a human to accept and must never be written on
 * its own. This route only ever returns observed values.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { productId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const productId = params.productId?.trim();
  if (!productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 });
  }

  // Never throws by construction — a missing proposal is an empty map, not an
  // error. A finish the tagger cannot prefill is a blank field, not a failure.
  const proposals = await proposedFinishByProductId([productId]);
  const finish = proposals.get(productId) ?? null;

  return NextResponse.json({
    finish,
    source: finish ? 'observed' : null,
  });
}
