import { prisma } from '@/lib/prisma';

/**
 * Sync ProductTestimonial records from ShopProduct quotes
 *
 * This utility creates/updates ProductTestimonial records based on ShopProduct.quote values.
 * It should be called when:
 * - A designer adds/updates a quote on their shop product
 * - A batch sync is needed (e.g., migration)
 *
 * The ShopProduct -> ProductTestimonial relationship is 1:1 via shopProductId unique constraint.
 */

/**
 * Sync a single ShopProduct quote to ProductTestimonial
 */
export async function syncSingleTestimonial(shopProductId: string): Promise<void> {
  const shopProduct = await prisma.shopProduct.findUnique({
    where: { id: shopProductId },
    select: {
      id: true,
      productId: true,
      quote: true,
      quoteApprovedAt: true,
      isActive: true,
    },
  });

  if (!shopProduct) {
    console.warn(`[syncTestimonials] ShopProduct not found: ${shopProductId}`);
    return;
  }

  // If shop product has no quote or is inactive, delete any existing testimonial
  if (!shopProduct.quote || !shopProduct.isActive) {
    await prisma.productTestimonial.deleteMany({
      where: { shopProductId },
    });
    console.log(`[syncTestimonials] Removed testimonial for ShopProduct: ${shopProductId}`);
    return;
  }

  // Upsert the testimonial
  await prisma.productTestimonial.upsert({
    where: { shopProductId },
    create: {
      productId: shopProduct.productId,
      shopProductId: shopProduct.id,
      quote: shopProduct.quote,
      isFeatured: false, // Featured status is set by vendor boosts
    },
    update: {
      quote: shopProduct.quote,
    },
  });

  console.log(`[syncTestimonials] Synced testimonial for ShopProduct: ${shopProductId}`);
}

/**
 * Sync all ShopProduct quotes to ProductTestimonial
 * Useful for initial migration or batch updates
 */
export async function syncAllTestimonials(): Promise<{
  created: number;
  updated: number;
  deleted: number;
}> {
  let created = 0;
  let updated = 0;
  let deleted = 0;

  // Get all active shop products with quotes
  const shopProductsWithQuotes = await prisma.shopProduct.findMany({
    where: {
      quote: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      productId: true,
      quote: true,
    },
  });

  // Get existing testimonial shopProductIds
  const existingTestimonials = await prisma.productTestimonial.findMany({
    select: { shopProductId: true },
  });
  const existingIds = new Set(existingTestimonials.map((t) => t.shopProductId));

  // Track which shopProductIds we've processed
  const processedIds = new Set<string>();

  // Create/update testimonials
  for (const sp of shopProductsWithQuotes) {
    processedIds.add(sp.id);

    if (existingIds.has(sp.id)) {
      // Update existing
      await prisma.productTestimonial.update({
        where: { shopProductId: sp.id },
        data: { quote: sp.quote! },
      });
      updated++;
    } else {
      // Create new
      await prisma.productTestimonial.create({
        data: {
          productId: sp.productId,
          shopProductId: sp.id,
          quote: sp.quote!,
          isFeatured: false,
        },
      });
      created++;
    }
  }

  // Delete testimonials for shop products that no longer have quotes
  const orphanedIds = [...existingIds].filter((id) => !processedIds.has(id));
  if (orphanedIds.length > 0) {
    const deleteResult = await prisma.productTestimonial.deleteMany({
      where: { shopProductId: { in: orphanedIds } },
    });
    deleted = deleteResult.count;
  }

  console.log(`[syncTestimonials] Batch sync complete:`, {
    created,
    updated,
    deleted,
    total: shopProductsWithQuotes.length,
  });

  return { created, updated, deleted };
}

/**
 * Mark a testimonial as featured (called when vendor approves a boost)
 */
export async function setTestimonialFeatured(
  shopProductId: string,
  isFeatured: boolean
): Promise<void> {
  await prisma.productTestimonial.updateMany({
    where: { shopProductId },
    data: { isFeatured },
  });

  console.log(
    `[syncTestimonials] Set featured=${isFeatured} for ShopProduct: ${shopProductId}`
  );
}
