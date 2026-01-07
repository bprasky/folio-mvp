#!/usr/bin/env tsx
/**
 * FOLIO Edge Builder Job
 * 
 * Converts ContextSignals into GraphEdges that represent relationships
 * in the Folio ecosystem. Creates edges for saves, project additions,
 * RSVPs, feature clicks, and co-occurrence patterns.
 * 
 * Usage: pnpm jobs:edges
 */

import { prisma } from "@/lib/prisma";

interface EdgeRule {
  action: string;
  kind: string;
  weight: number;
  decayDays: number | null; // null = permanent
}

// Edge building rules
const EDGE_RULES: EdgeRule[] = [
  { action: "save", kind: "saves", weight: 0.8, decayDays: 7 },
  { action: "add_to_project", kind: "includes", weight: 1.0, decayDays: null }, // permanent
  { action: "rsvp", kind: "attends", weight: 0.9, decayDays: 14 },
  { action: "feature_click", kind: "affinity", weight: 1.2, decayDays: 30 },
  { action: "view", kind: "views", weight: 0.3, decayDays: 3 },
];

/**
 * Calculate decay date based on days from now
 */
function calculateDecayAt(days: number | null): Date {
  if (days === null) {
    // Permanent edges: set far future date
    return new Date('2099-12-31');
  }
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Build edges from recent context signals
 */
async function buildEdgesFromSignals() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 48); // Last 48 hours

  const signals = await prisma.contextSignal.findMany({
    where: {
      createdAt: {
        gte: cutoff,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`📥 Processing ${signals.length} signals from last 48 hours...`);

  let created = 0;
  let updated = 0;

  for (const signal of signals) {
    const rule = EDGE_RULES.find(r => r.action === signal.action);
    if (!rule) continue;

    // Determine source and destination
    let srcType: string | null = null;
    let srcId: string | null = null;
    let dstType: string | null = null;
    let dstId: string | null = null;

    // User -> Product (save, view)
    if (signal.userId && signal.productId) {
      srcType = "user";
      srcId = signal.userId;
      dstType = "product";
      dstId = signal.productId;
    }
    // User -> Event (rsvp)
    else if (signal.userId && signal.eventId) {
      srcType = "user";
      srcId = signal.userId;
      dstType = "event";
      dstId = signal.eventId;
    }
    // Project -> Product (add_to_project)
    else if (signal.projectId && signal.productId) {
      srcType = "project";
      srcId = signal.projectId;
      dstType = "product";
      dstId = signal.productId;
    }
    // Vendor -> Product (owns)
    else if (signal.vendorId && signal.productId) {
      srcType = "vendor";
      srcId = signal.vendorId;
      dstType = "product";
      dstId = signal.productId;
    }

    if (!srcType || !srcId || !dstType || !dstId) continue;

    try {
      // Upsert edge
      const existing = await prisma.graphEdge.findFirst({
        where: {
          srcType,
          srcId,
          dstType,
          dstId,
          kind: rule.kind,
        },
      });

      if (existing) {
        // Update weight and decay date
        await prisma.graphEdge.update({
          where: { id: existing.id },
          data: {
            weight: existing.weight + rule.weight,
            decayAt: calculateDecayAt(rule.decayDays),
            updatedAt: new Date(),
          },
        });
        updated++;
      } else {
        // Create new edge
        await prisma.graphEdge.create({
          data: {
            srcType,
            srcId,
            dstType,
            dstId,
            kind: rule.kind,
            weight: rule.weight,
            decayAt: calculateDecayAt(rule.decayDays),
          },
        });
        created++;
      }
    } catch (error) {
      console.error(`✗ Failed to create edge ${srcType}:${srcId} -> ${dstType}:${dstId}:`, error);
    }
  }

  return { created, updated };
}

/**
 * Build co-occurrence edges for products saved by the same user within 30 minutes
 */
async function buildCoOccurrenceEdges() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 48); // Last 48 hours

  // Get all save signals from last 48 hours
  const saves = await prisma.contextSignal.findMany({
    where: {
      action: "save",
      productId: { not: null },
      userId: { not: null },
      createdAt: { gte: cutoff },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`🔗 Analyzing ${saves.length} saves for co-occurrence patterns...`);

  let coOccurrenceEdges = 0;
  const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds

  // Group saves by user
  const userSaves = new Map<string, typeof saves>();
  for (const save of saves) {
    if (!save.userId) continue;
    if (!userSaves.has(save.userId)) {
      userSaves.set(save.userId, []);
    }
    userSaves.get(save.userId)!.push(save);
  }

  // Find co-occurrences within 30 minutes
  for (const [userId, userSaveList] of Array.from(userSaves.entries())) {
    for (let i = 0; i < userSaveList.length - 1; i++) {
      for (let j = i + 1; j < userSaveList.length; j++) {
        const saveA = userSaveList[i];
        const saveB = userSaveList[j];

        if (!saveA.productId || !saveB.productId) continue;

        const timeDiff = Math.abs(saveB.createdAt.getTime() - saveA.createdAt.getTime());
        
        if (timeDiff <= thirtyMinutes) {
          try {
            // Check if edge already exists
            const existing = await prisma.graphEdge.findFirst({
              where: {
                srcType: "product",
                srcId: saveA.productId,
                dstType: "product",
                dstId: saveB.productId,
                kind: "associated_with",
              },
            });

            if (existing) {
              // Update weight
              await prisma.graphEdge.update({
                where: { id: existing.id },
                data: {
                  weight: existing.weight + 0.5,
                  updatedAt: new Date(),
                },
              });
            } else {
              // Create new edge
              await prisma.graphEdge.create({
                data: {
                  srcType: "product",
                  srcId: saveA.productId,
                  dstType: "product",
                  dstId: saveB.productId,
                  kind: "associated_with",
                  weight: 0.5,
                  decayAt: calculateDecayAt(14),
                },
              });
            }

            coOccurrenceEdges++;
          } catch (error) {
            console.error(`✗ Failed to create co-occurrence edge:`, error);
          }
        }
      }
    }
  }

  return coOccurrenceEdges;
}

/**
 * Main execution
 */
async function run() {
  console.log("🚀 Starting edge builder...\n");

  try {
    // Build edges from signals
    const { created, updated } = await buildEdgesFromSignals();
    console.log(`✓ Signal edges: ${created} created, ${updated} updated`);

    // Build co-occurrence edges
    const coOccurrences = await buildCoOccurrenceEdges();
    console.log(`✓ Co-occurrence edges: ${coOccurrences}`);

    console.log(`\n✅ Edge building complete!`);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  run()
    .then(() => {
      console.log("\n🎉 Edge builder finished successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Edge builder failed:", error);
      process.exit(1);
    });
}

export { run };

