import { prisma } from "@/lib/prisma";
import {
  AtelierOwnerType,
  AtelierNodeType,
  AtelierRelationType,
  AtelierSignalSourceType,
} from "@prisma/client";

export async function recomputeDesignerAtelierFingerprint(designerId: string) {
  // Fetch or create fingerprint
  let fingerprint = await prisma.atelierFingerprint.findFirst({
    where: { designerId, ownerType: AtelierOwnerType.DESIGNER },
  });

  if (!fingerprint) {
    fingerprint = await prisma.atelierFingerprint.create({
      data: {
        ownerType: AtelierOwnerType.DESIGNER,
        designerId,
        completeness: 0,
      },
    });
  }

  // Fetch signals for this designer
  const signals = await prisma.atelierSignal.findMany({
    where: {
      designerId,
      ownerType: AtelierOwnerType.DESIGNER,
    },
  });

  if (!signals.length) {
    // nothing to compute yet – set low completeness and return
    await prisma.atelierFingerprint.update({
      where: { id: fingerprint.id },
      data: { completeness: 0, lastComputedAt: new Date() },
    });
    return fingerprint;
  }

  // Aggregate signals by normalized key
  type AggBucket = { key: string; totalWeight: number; count: number };
  const buckets: Record<string, AggBucket> = {};

  for (const s of signals) {
    const key = s.key;
    if (!buckets[key]) {
      buckets[key] = { key, totalWeight: 0, count: 0 };
    }
    buckets[key].totalWeight += s.weight ?? 1;
    buckets[key].count += 1;
  }

  // Simple heuristics to map keys -> node type + label
  const styleBuckets: AggBucket[] = [];
  const roomBuckets: AggBucket[] = [];
  const vendorBuckets: AggBucket[] = [];
  const productCatBuckets: AggBucket[] = [];
  const materialBuckets: AggBucket[] = [];

  Object.values(buckets).forEach((bucket) => {
    const { key } = bucket;
    if (key.startsWith("style:")) styleBuckets.push(bucket);
    else if (key.startsWith("room:")) roomBuckets.push(bucket);
    else if (key.startsWith("vendor:")) vendorBuckets.push(bucket);
    else if (key.startsWith("productCategory:")) productCatBuckets.push(bucket);
    else if (key.startsWith("material:")) materialBuckets.push(bucket);
  });

  // Clean previous nodes/edges for this fingerprint (simple v1 approach)
  await prisma.atelierEdge.deleteMany({ where: { fingerprintId: fingerprint.id } });
  await prisma.atelierNode.deleteMany({ where: { fingerprintId: fingerprint.id } });

  const nodesToCreate: {
    nodeType: AtelierNodeType;
    label: string;
    weight: number;
    metadata?: any;
  }[] = [];

  function pushNodesFromBuckets(
    buckets: AggBucket[],
    nodeType: AtelierNodeType,
  ) {
    if (!buckets.length) return;
    // Normalize by max weight per group
    const maxWeight = Math.max(...buckets.map((b) => b.totalWeight));
    for (const b of buckets) {
      const label = b.key.split(":")[1] || b.key;
      const normalizedWeight = maxWeight > 0 ? b.totalWeight / maxWeight : 0;
      nodesToCreate.push({
        nodeType,
        label,
        weight: normalizedWeight,
        metadata: {
          rawKey: b.key,
          count: b.count,
          totalWeight: b.totalWeight,
        },
      });
    }
  }

  pushNodesFromBuckets(styleBuckets, AtelierNodeType.STYLE);
  pushNodesFromBuckets(roomBuckets, AtelierNodeType.ROOM_TYPE);
  pushNodesFromBuckets(vendorBuckets, AtelierNodeType.VENDOR);
  pushNodesFromBuckets(productCatBuckets, AtelierNodeType.PRODUCT_CATEGORY);
  pushNodesFromBuckets(materialBuckets, AtelierNodeType.MATERIAL);

  const createdNodes = await prisma.$transaction(
    nodesToCreate.map((n) =>
      prisma.atelierNode.create({
        data: {
          fingerprintId: fingerprint.id,
          nodeType: n.nodeType,
          label: n.label,
          weight: n.weight,
          metadata: n.metadata,
        },
      }),
    ),
  );

  // Build simple edges:
  // - connect STYLE nodes to ROOM_TYPE nodes
  // - connect STYLE nodes to VENDOR nodes
  // - connect ROOM_TYPE nodes to VENDOR nodes
  // This is enough to visualize a useful constellation in v1.
  const styleNodes = createdNodes.filter((n) => n.nodeType === AtelierNodeType.STYLE);
  const roomNodes = createdNodes.filter((n) => n.nodeType === AtelierNodeType.ROOM_TYPE);
  const vendorNodes = createdNodes.filter((n) => n.nodeType === AtelierNodeType.VENDOR);

  const edgesToCreate: {
    sourceNodeId: string;
    targetNodeId: string;
    relationType: AtelierRelationType;
    weight: number;
  }[] = [];

  function connectAll(
    sources: typeof createdNodes,
    targets: typeof createdNodes,
    relationType: AtelierRelationType,
  ) {
    for (const s of sources) {
      for (const t of targets) {
        // Basic heuristic: combined weight = average of node weights
        const w = (s.weight + t.weight) / 2;
        // Avoid edges that are basically noise
        if (w < 0.15) continue;
        edgesToCreate.push({
          sourceNodeId: s.id,
          targetNodeId: t.id,
          relationType,
          weight: w,
        });
      }
    }
  }

  connectAll(styleNodes, roomNodes, AtelierRelationType.PROJECT_ROOM_FOCUS);
  connectAll(styleNodes, vendorNodes, AtelierRelationType.FREQUENT_VENDOR);
  connectAll(roomNodes, vendorNodes, AtelierRelationType.PREFERS);

  if (edgesToCreate.length) {
    await prisma.$transaction(
      edgesToCreate.map((e) =>
        prisma.atelierEdge.create({
          data: {
            fingerprintId: fingerprint.id,
            sourceNodeId: e.sourceNodeId,
            targetNodeId: e.targetNodeId,
            relationType: e.relationType,
            weight: e.weight,
          },
        }),
      ),
    );
  }

  // Compute a simple completeness score v1:
  // based on number of unique signals & diversity of buckets.
  const uniqueKeysCount = Object.keys(buckets).length;
  const diversityFactor =
    [styleBuckets, roomBuckets, vendorBuckets, productCatBuckets, materialBuckets].filter(
      (b) => b.length > 0,
    ).length / 5;

  const maxSignalsForFull = 200; // arbitrary cap for v1
  const signalFactor = Math.min(uniqueKeysCount / maxSignalsForFull, 1);
  const completeness = Math.max(0.05, Math.min(signalFactor * diversityFactor, 1));

  const updated = await prisma.atelierFingerprint.update({
    where: { id: fingerprint.id },
    data: {
      completeness,
      lastComputedAt: new Date(),
    },
  });

  return updated;
}

// TODO: Future - extend this to ownerType === VENDOR for Vendor Atelier
// export async function recomputeVendorAtelierFingerprint(vendorId: string) {
//   // Look at which designers use/saved their products
//   // Identify segments of designers who are good fits
//   // Eventually feed into an "Atelier worker" that:
//   //   - Follows/boosts/comments for their top accounts
//   //   - Reaches out to new designers fitting their fingerprint
// }




