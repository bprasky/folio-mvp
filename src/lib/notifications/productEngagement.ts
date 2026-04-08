import { prisma } from '@/lib/prisma';

const SAVE_THRESHOLD = 2;

/**
 * Fire-and-forget: Check if an incomplete product has crossed the save threshold.
 * If so, notify the tagging designer with dual CTAs (complete yourself / ask vendor).
 *
 * Call this after every successful save.
 */
export function notifyProductEngagement(productId: string): void {
  notifyProductEngagementSafe(productId).catch(() => {});
}

async function notifyProductEngagementSafe(productId: string): Promise<void> {
  try {
    // Fetch product with completeness-relevant fields
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        brand: true,
        url: true,
        vendorId: true,
      },
    });

    if (!product) return;

    // Check if product is incomplete (missing image, vendor, or URL)
    const missingFields: string[] = [];
    if (!product.imageUrl) missingFields.push('image');
    if (!product.brand && !product.vendorId) missingFields.push('vendor');
    if (!product.url) missingFields.push('url');

    // If product is complete, no notification needed
    if (missingFields.length === 0) return;

    // Count total saves for this product
    const saveCount = await prisma.save.count({
      where: { productId },
    });

    if (saveCount < SAVE_THRESHOLD) return;

    // Check if we already sent this notification (dedup by productId)
    const existing = await prisma.notification.findFirst({
      where: {
        type: 'PRODUCT_NEEDS_DETAILS',
        metadata: {
          path: ['productId'],
          equals: productId,
        },
        read: false,
      },
    });

    if (existing) return; // Already notified, not yet acted on

    // Find the designer who tagged this product
    // ProductTag → ProjectImage → Project → designerId
    const tag = await prisma.productTag.findFirst({
      where: { productId },
      select: {
        image: {
          select: {
            project: {
              select: {
                designerId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // First tag — likely the original tagger
    });

    const designerId = tag?.image?.project?.designerId;
    if (!designerId) return;

    // Build human-readable missing list
    const missingLabels = missingFields.map((f) => {
      if (f === 'image') return 'a product image';
      if (f === 'vendor') return 'vendor/brand info';
      if (f === 'url') return 'a product URL';
      return f;
    });

    const missingText = missingLabels.join(', ');

    // Create notification
    await prisma.notification.create({
      data: {
        userId: designerId,
        type: 'PRODUCT_NEEDS_DETAILS',
        title: 'Your product is getting attention!',
        body: `"${product.name}" has been saved ${saveCount} times. Add ${missingText} to make it shoppable.`,
        actionUrl: `/products/${product.id}/edit`,
        metadata: {
          productId: product.id,
          productName: product.name,
          saveCount,
          missingFields,
        },
      },
    });

    console.log('[notifyProductEngagement] Notification created', {
      productId,
      designerId,
      saveCount,
      missingFields,
    });
  } catch (error: any) {
    console.error('[notifyProductEngagement] Failed (non-fatal)', {
      productId,
      error: error.message,
    });
  }
}
