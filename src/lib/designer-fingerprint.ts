/**
 * Designer Fingerprint Tracking
 *
 * Utilities for tracking and analyzing individual designer product usage patterns
 * to build "fingerprints" that can be compared against aggregate patterns.
 */

import { prisma } from '@/lib/prisma';

/**
 * Normalize brand name for consistent matching
 */
function normalizeBrandName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Track that a designer used a product (updates affinity for product, brand, material, style)
 */
export async function trackDesignerProductUse(params: {
  designerId: string;
  cachedProductId: string;
  brandName?: string | null;
  materialType?: string | null;
  style?: string | null;
  projectId?: string | null;
}) {
  const { designerId, cachedProductId, brandName, materialType, style } = params;

  try {
    // Update or create product affinity
    await prisma.designerProductAffinity.upsert({
      where: {
        designerId_cachedProductId: {
          designerId,
          cachedProductId,
        },
      },
      create: {
        designerId,
        cachedProductId,
        useCount: 1,
        projectCount: 1,
      },
      update: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    // Track brand affinity if brand is provided
    if (brandName) {
      const normalizedBrand = normalizeBrandName(brandName);
      await prisma.$executeRaw`
        INSERT INTO designer_product_affinity (id, designer_id, brand_name, use_count, created_at, updated_at)
        VALUES (gen_random_uuid(), ${designerId}, ${normalizedBrand}, 1, NOW(), NOW())
        ON CONFLICT (designer_id, brand_name)
        WHERE brand_name IS NOT NULL AND cached_product_id IS NULL
        DO UPDATE SET
          use_count = designer_product_affinity.use_count + 1,
          last_used_at = NOW(),
          updated_at = NOW()
      `;
    }

    // Track material affinity if provided
    if (materialType) {
      await prisma.$executeRaw`
        INSERT INTO designer_product_affinity (id, designer_id, material_type, use_count, created_at, updated_at)
        VALUES (gen_random_uuid(), ${designerId}, ${materialType}, 1, NOW(), NOW())
        ON CONFLICT (designer_id, material_type)
        WHERE material_type IS NOT NULL AND cached_product_id IS NULL AND brand_name IS NULL
        DO UPDATE SET
          use_count = designer_product_affinity.use_count + 1,
          last_used_at = NOW(),
          updated_at = NOW()
      `;
    }

    // Track style affinity if provided
    if (style) {
      await prisma.$executeRaw`
        INSERT INTO designer_product_affinity (id, designer_id, style, use_count, created_at, updated_at)
        VALUES (gen_random_uuid(), ${designerId}, ${style}, 1, NOW(), NOW())
        ON CONFLICT (designer_id, style)
        WHERE style IS NOT NULL AND cached_product_id IS NULL AND brand_name IS NULL AND material_type IS NULL
        DO UPDATE SET
          use_count = designer_product_affinity.use_count + 1,
          last_used_at = NOW(),
          updated_at = NOW()
      `;
    }
  } catch (error) {
    console.error('Failed to track designer product use:', error);
    // Don't throw - tracking is non-critical
  }
}

/**
 * Track that a designer paired two products together
 */
export async function trackDesignerPairing(params: {
  designerId: string;
  productAId: string;
  productBId: string;
  roomType?: string | null;
}) {
  const { designerId, roomType } = params;

  // Ensure consistent ordering (smaller ID first)
  const [productAId, productBId] = [params.productAId, params.productBId].sort();

  try {
    // Update designer-specific pairing
    await prisma.$executeRaw`
      INSERT INTO designer_pairings (id, designer_id, product_a_id, product_b_id, room_type, pair_count, same_room_count, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${designerId},
        ${productAId}::uuid,
        ${productBId}::uuid,
        ${roomType},
        1,
        CASE WHEN ${roomType} IS NOT NULL THEN 1 ELSE 0 END,
        NOW(),
        NOW()
      )
      ON CONFLICT (designer_id, product_a_id, product_b_id)
      DO UPDATE SET
        pair_count = designer_pairings.pair_count + 1,
        same_room_count = CASE
          WHEN ${roomType} IS NOT NULL
          THEN designer_pairings.same_room_count + 1
          ELSE designer_pairings.same_room_count
        END,
        last_paired_at = NOW(),
        updated_at = NOW()
    `;

    // Also update the aggregate pairing
    await prisma.$executeRaw`
      INSERT INTO product_pairings (id, product_a_id, product_b_id, room_type, pair_count, same_room_count, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${productAId}::uuid,
        ${productBId}::uuid,
        ${roomType},
        1,
        CASE WHEN ${roomType} IS NOT NULL THEN 1 ELSE 0 END,
        NOW(),
        NOW()
      )
      ON CONFLICT (product_a_id, product_b_id)
      DO UPDATE SET
        pair_count = product_pairings.pair_count + 1,
        same_room_count = CASE
          WHEN ${roomType} IS NOT NULL
          THEN product_pairings.same_room_count + 1
          ELSE product_pairings.same_room_count
        END,
        updated_at = NOW()
    `;
  } catch (error) {
    console.error('Failed to track designer pairing:', error);
    // Don't throw - tracking is non-critical
  }
}

/**
 * Track all pairings for products in the same room
 */
export async function trackRoomPairings(params: {
  designerId: string;
  productIds: string[];
  roomType?: string | null;
}) {
  const { designerId, productIds, roomType } = params;

  if (productIds.length < 2) return;

  // Generate all unique pairs
  for (let i = 0; i < productIds.length; i++) {
    for (let j = i + 1; j < productIds.length; j++) {
      await trackDesignerPairing({
        designerId,
        productAId: productIds[i],
        productBId: productIds[j],
        roomType,
      });
    }
  }
}

/**
 * Get a designer's style fingerprint
 */
export async function getDesignerFingerprint(designerId: string) {
  try {
    const [profile, topBrands, topMaterials, topStyles, signaturePairings] = await Promise.all([
      // Get or compute profile
      prisma.designerStyleProfile.findUnique({
        where: { designerId },
      }),

      // Get top brands
      prisma.designerProductAffinity.findMany({
        where: {
          designerId,
          brandName: { not: null },
          cachedProductId: null,
        },
        orderBy: { useCount: 'desc' },
        take: 10,
      }),

      // Get top materials
      prisma.designerProductAffinity.findMany({
        where: {
          designerId,
          materialType: { not: null },
          cachedProductId: null,
          brandName: null,
        },
        orderBy: { useCount: 'desc' },
        take: 5,
      }),

      // Get top styles
      prisma.designerProductAffinity.findMany({
        where: {
          designerId,
          style: { not: null },
          cachedProductId: null,
          brandName: null,
          materialType: null,
        },
        orderBy: { useCount: 'desc' },
        take: 5,
      }),

      // Get signature pairings (their most frequent combinations)
      prisma.designerPairing.findMany({
        where: { designerId },
        orderBy: { pairCount: 'desc' },
        take: 10,
        include: {
          productA: {
            select: {
              id: true,
              productName: true,
              brand: true,
              materialType: true,
            },
          },
          productB: {
            select: {
              id: true,
              productName: true,
              brand: true,
              materialType: true,
            },
          },
        },
      }),
    ]);

    return {
      profile,
      topBrands: topBrands.map(b => ({
        name: b.brandName,
        count: b.useCount,
      })),
      topMaterials: topMaterials.map(m => ({
        type: m.materialType,
        count: m.useCount,
      })),
      topStyles: topStyles.map(s => ({
        style: s.style,
        count: s.useCount,
      })),
      signaturePairings: signaturePairings.map(p => ({
        productA: p.productA,
        productB: p.productB,
        pairCount: p.pairCount,
        roomType: p.roomType,
      })),
    };
  } catch (error) {
    console.error('Failed to get designer fingerprint:', error);
    return null;
  }
}

/**
 * Compare a designer's patterns to aggregate patterns
 * Returns delta showing what's unique about this designer
 */
export async function getDesignerDelta(designerId: string) {
  try {
    // Get designer's pairings with their aggregate comparison
    const deltas = await prisma.$queryRaw<Array<{
      product_a_id: string;
      product_b_id: string;
      designer_pair_count: number;
      aggregate_pair_count: number;
      preference_ratio: number;
      room_type: string | null;
    }>>`
      SELECT
        dp.product_a_id,
        dp.product_b_id,
        dp.pair_count as designer_pair_count,
        COALESCE(pp.pair_count, 0) as aggregate_pair_count,
        CASE
          WHEN COALESCE(pp.pair_count, 1) > 0
          THEN dp.pair_count::DECIMAL / COALESCE(pp.pair_count, 1)
          ELSE dp.pair_count::DECIMAL
        END as preference_ratio,
        dp.room_type
      FROM designer_pairings dp
      LEFT JOIN product_pairings pp
        ON dp.product_a_id = pp.product_a_id
        AND dp.product_b_id = pp.product_b_id
      WHERE dp.designer_id = ${designerId}
      ORDER BY preference_ratio DESC
      LIMIT 20
    `;

    // Get material preference delta
    const materialDeltas = await prisma.$queryRaw<Array<{
      material_type: string;
      designer_count: number;
      designer_percent: number;
      aggregate_percent: number;
      delta: number;
    }>>`
      WITH designer_materials AS (
        SELECT
          material_type,
          use_count,
          100.0 * use_count / NULLIF(SUM(use_count) OVER (), 0) as percent
        FROM designer_product_affinity
        WHERE designer_id = ${designerId}
          AND material_type IS NOT NULL
          AND cached_product_id IS NULL
          AND brand_name IS NULL
      ),
      aggregate_materials AS (
        SELECT
          material_type,
          SUM(use_count) as total_count,
          100.0 * SUM(use_count) / NULLIF(SUM(SUM(use_count)) OVER (), 0) as percent
        FROM designer_product_affinity
        WHERE material_type IS NOT NULL
          AND cached_product_id IS NULL
          AND brand_name IS NULL
        GROUP BY material_type
      )
      SELECT
        dm.material_type,
        dm.use_count as designer_count,
        ROUND(dm.percent, 1) as designer_percent,
        ROUND(COALESCE(am.percent, 0), 1) as aggregate_percent,
        ROUND(dm.percent - COALESCE(am.percent, 0), 1) as delta
      FROM designer_materials dm
      LEFT JOIN aggregate_materials am ON dm.material_type = am.material_type
      ORDER BY ABS(dm.percent - COALESCE(am.percent, 0)) DESC
    `;

    return {
      // Pairings this designer uses more than average
      signaturePairings: deltas.filter(d => d.preference_ratio > 1.5),
      // All pairing deltas
      allPairingDeltas: deltas,
      // Material preferences vs aggregate
      materialDeltas,
    };
  } catch (error) {
    console.error('Failed to get designer delta:', error);
    return null;
  }
}

/**
 * Link a selection to a cached product and track the relationship
 */
export async function linkSelectionToCachedProduct(params: {
  selectionId: string;
  cachedProductId: string;
  designerId: string;
  projectId?: string | null;
  roomType?: string | null;
  matchMethod?: 'url' | 'ai_match' | 'manual';
  matchConfidence?: number;
}) {
  const { selectionId, cachedProductId, designerId, projectId, roomType, matchMethod = 'url', matchConfidence = 1.0 } = params;

  try {
    // Create the link
    await prisma.selectionCachedProduct.upsert({
      where: {
        selectionId_cachedProductId: {
          selectionId,
          cachedProductId,
        },
      },
      create: {
        selectionId,
        cachedProductId,
        matchConfidence,
        matchMethod,
      },
      update: {
        matchConfidence,
        matchMethod,
      },
    });

    // Get the cached product details
    const cachedProduct = await prisma.cachedProduct.findUnique({
      where: { id: cachedProductId },
      select: {
        brand: true,
        materialType: true,
        style: true,
      },
    });

    // Track the designer's use of this product
    if (cachedProduct) {
      await trackDesignerProductUse({
        designerId,
        cachedProductId,
        brandName: cachedProduct.brand,
        materialType: cachedProduct.materialType,
        style: cachedProduct.style,
        projectId,
      });
    }

    // Increment use count on cached product
    await prisma.cachedProduct.update({
      where: { id: cachedProductId },
      data: {
        useCount: { increment: 1 },
      },
    });

    // Track engagement
    await prisma.cachedProductEngagement.create({
      data: {
        cachedProductId,
        userId: designerId,
        engagementType: 'use',
        source: 'selection',
        projectId,
      },
    });

    // If we know the room type, find other products in the same room to create pairings
    if (roomType && projectId) {
      // Get other cached products in the same room
      const otherSelectionsInRoom = await prisma.$queryRaw<Array<{ cached_product_id: string }>>`
        SELECT DISTINCT scp.cached_product_id
        FROM selection_cached_product scp
        JOIN selections s ON s.id = scp.selection_id
        WHERE s.project_id = ${projectId}
          AND s.room_id IN (
            SELECT room_id FROM selections WHERE id = ${selectionId}
          )
          AND scp.cached_product_id != ${cachedProductId}::uuid
      `;

      if (otherSelectionsInRoom.length > 0) {
        const otherProductIds = otherSelectionsInRoom.map(s => s.cached_product_id);
        await trackRoomPairings({
          designerId,
          productIds: [cachedProductId, ...otherProductIds],
          roomType,
        });
      }
    }
  } catch (error) {
    console.error('Failed to link selection to cached product:', error);
    // Don't throw - linking is non-critical
  }
}
