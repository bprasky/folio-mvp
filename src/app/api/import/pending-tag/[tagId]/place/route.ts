/** Confirm a schedule row on one or more project photos. Coordinates are percentages. */
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { assertProjectWrite } from '@/lib/authz/access';
import { prisma } from '@/lib/prisma';
import { scheduleReview } from '@/lib/import-agent/finishScheduleReview';
import { isDocumentImage } from '@/lib/publish/computePublishReadiness';
import { normalizeProductUrl } from '@/lib/products/normalizeProductUrl';
import { parseProductUrl } from '@/lib/server/safe-product-url';
import { recordLabelEvent } from '@/lib/vision/recordLabelEvent';

function validPlacements(value: unknown): value is Array<{ imageId: string; x: number; y: number }> {
  return Array.isArray(value) && value.length > 0 && value.length <= 12 && new Set(value.map(p => p?.imageId)).size === value.length &&
    value.every(p => typeof p?.imageId === 'string' && [p.x, p.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100));
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  try {
    const { tagId } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const placements = body.placements ?? [{ imageId: body.imageId, x: body.x, y: body.y }];
    if (!validPlacements(placements)) return NextResponse.json({ error: 'Choose valid photo positions (0–100).' }, { status: 400 });
    const pending = await prisma.pendingProductTag.findUnique({ where: { id: tagId }, include: { importSession: true } });
    if (!pending?.importSession.projectId || pending.source !== 'SPEC') return NextResponse.json({ error: 'Schedule item not found' }, { status: 404 });
    const projectId = pending.importSession.projectId;
    try { await assertProjectWrite(userId, projectId); }
    catch { return NextResponse.json({ error: 'Not permitted' }, { status: 403 }); }
    if (pending.status === 'CONFIRMED') return NextResponse.json({ productTagId: pending.resultingTagId, productId: pending.confirmedProductId });
    if (pending.status !== 'UNREVIEWED') return NextResponse.json({ error: 'Item already reviewed' }, { status: 409 });
    const photos = await prisma.projectImage.findMany({ where: { id: { in: placements.map(p => p.imageId) }, projectId, inclusion: { not: 'EXCLUDED' } }, select: { id: true, name: true } });
    if (photos.length !== placements.length || photos.some(p => isDocumentImage(p.name ?? undefined))) return NextResponse.json({ error: 'Choose included photos in this project.' }, { status: 400 });
    const review = scheduleReview(pending.topSuggestion);
    const research = body.useResearch !== false && review?.research?.exact && review.research.confidence !== 'low' ? review.research : null;
    const rawUrl = pending.extractedProductUrl || research?.productUrl;
    let url: string | null = null;
    try { if (rawUrl) url = normalizeProductUrl(parseProductUrl(rawUrl).href); } catch { /* unsafe source links never persist */ }
    const brand = pending.extractedVendor || research?.brand || null;
    const priceCents = pending.extractedPrice ?? research?.priceCents ?? null;
    const result = await prisma.$transaction(async tx => {
      // Claim inside the same transaction as the product/tags/counter: rollback on any failure.
      const claimed = await tx.pendingProductTag.updateMany({ where: { id: tagId, status: 'UNREVIEWED' }, data: { status: 'CONFIRMED' } });
      if (!claimed.count) {
        const existing = await tx.pendingProductTag.findUniqueOrThrow({ where: { id: tagId } });
        if (existing.status !== 'CONFIRMED') throw new Error('Item changed during confirmation');
        return { productTagId: existing.resultingTagId, productId: existing.confirmedProductId, replay: true };
      }
      // Never merge unrelated brands merely because they share a product name.
      const existing = await tx.product.findFirst({ where: url ? { url } : {
        name: { equals: pending.description, mode: 'insensitive' }, brand: brand ? { equals: brand, mode: 'insensitive' } : null,
      } });
      const product = existing || await tx.product.create({ data: {
        name: pending.description, brand, category: pending.category, url,
        imageUrl: research?.imageUrl || null, price: priceCents === null ? null : priceCents / 100, description: research?.description || null, isPending: true,
      } });
      if (existing && !existing.vendorId && research) await tx.product.update({ where: { id: product.id }, data: {
        description: existing.description || research.description, imageUrl: existing.imageUrl || research.imageUrl,
        price: existing.price ?? (priceCents === null ? null : priceCents / 100), brand: existing.brand || brand,
        category: existing.category || pending.category,
      } });
      // Product forms already read this cache. Preserve established catalog records.
      if (url && research) await tx.cachedProduct.upsert({ where: { url }, update: {}, create: {
        url, imageUrl: research.imageUrl, productName: pending.description, brand, priceCents, currency: 'USD',
        description: research.description, sku: pending.extractedSku || research.sku,
        widthIn: research.widthIn, depthIn: research.depthIn, heightIn: research.heightIn,
        materialType: research.material, finish: research.finish, extractionConfidence: research.confidence,
        aiResponse: { source: 'finish-schedule', productUrl: research.productUrl, research },
      } });
      const tags = [];
      for (const placement of placements) {
        const suggested = review?.matches.find(m => m.imageId === placement.imageId);
        tags.push(await tx.productTag.create({ data: {
          ...placement, productId: product.id, reviewedAt: new Date(),
          aiX: suggested ? suggested.x * 100 : null, aiY: suggested ? suggested.y * 100 : null,
          // Finish is a separate specification decision; this importer does not assert it.
        } }));
      }
      await tx.projectImage.updateMany({ where: { id: { in: photos.map(p => p.id) }, projectId }, data: { noProducts: false } });
      await tx.pendingProductTag.update({ where: { id: tagId }, data: {
        projectImageId: placements[0].imageId, x: placements[0].x / 100, y: placements[0].y / 100,
        confirmedProductId: product.id, resultingTagId: tags[0].id, reviewedAt: new Date(),
      } });
      await tx.importSession.update({ where: { id: pending.importSessionId }, data: { verifiedTags: { increment: 1 } } });
      return { productTagId: tags[0].id, productId: product.id, replay: false };
    });
    if (!result.replay) for (const placement of placements) await recordLabelEvent({ projectId, imageId: placement.imageId, userId,
      source: 'HUMAN', taskType: 'PRODUCT_TAG', action: 'confirm',
      value: { description: pending.description, x: placement.x, y: placement.y, confirmedProductId: result.productId },
    }).catch(() => {});
    return NextResponse.json(result);
  } catch (error) {
    console.error('[pending-tag/place]', error);
    return NextResponse.json({ error: 'Could not confirm this item. Please retry.' }, { status: 500 });
  }
}
