#!/usr/bin/env tsx
/**
 * FOLIO Edge Decay Job
 * 
 * Applies time-based decay to graph edges to ensure the context graph
 * reflects current trends and relationships rather than stale historical data.
 * 
 * Usage: pnpm jobs:decay
 */

import { prisma } from "@/lib/prisma";

const DECAY_FACTOR = 0.9; // Reduce weight by 10% each decay cycle
const DECAY_INTERVAL_DAYS = 7; // Apply decay every 7 days
const MIN_WEIGHT = 0.1; // Remove edges below this threshold

/**
 * Apply decay to edges that have reached their decay date
 */
async function applyDecay() {
  const now = new Date();

  // Find all edges that should decay
  const edgesToDecay = await prisma.graphEdge.findMany({
    where: {
      decayAt: {
        lte: now,
      },
    },
  });

  console.log(`📉 Found ${edgesToDecay.length} edges to decay...`);

  let decayed = 0;
  let removed = 0;

  for (const edge of edgesToDecay) {
    const newWeight = edge.weight * DECAY_FACTOR;

    try {
      if (newWeight < MIN_WEIGHT) {
        // Remove edge if weight is too low
        await prisma.graphEdge.delete({
          where: { id: edge.id },
        });
        removed++;
      } else {
        // Update weight and reset decay date
        const nextDecayAt = new Date();
        nextDecayAt.setDate(nextDecayAt.getDate() + DECAY_INTERVAL_DAYS);

        await prisma.graphEdge.update({
          where: { id: edge.id },
          data: {
            weight: newWeight,
            decayAt: nextDecayAt,
            updatedAt: new Date(),
          },
        });
        decayed++;
      }
    } catch (error) {
      console.error(`✗ Failed to decay edge ${edge.id}:`, error);
    }
  }

  return { decayed, removed };
}

/**
 * Clean up orphaned edges (edges pointing to non-existent nodes)
 * This is a maintenance operation to keep the graph clean
 */
async function cleanupOrphanedEdges() {
  // This is a placeholder for future implementation
  // Would require checking if srcId/dstId still exist in their respective tables
  console.log("⚠️  Orphan cleanup not yet implemented");
  return { cleaned: 0 };
}

/**
 * Main execution
 */
async function run() {
  console.log("🚀 Starting edge decay...\n");

  try {
    // Apply decay
    const { decayed, removed } = await applyDecay();
    console.log(`✓ Decayed: ${decayed} edges`);
    console.log(`✓ Removed: ${removed} edges (below threshold)`);

    // Optional: cleanup orphaned edges
    const { cleaned } = await cleanupOrphanedEdges();
    if (cleaned > 0) {
      console.log(`✓ Cleaned up: ${cleaned} orphaned edges`);
    }

    // Print summary statistics
    const totalEdges = await prisma.graphEdge.count();
    const edgesByKind = await prisma.graphEdge.groupBy({
      by: ['kind'],
      _count: true,
    });

    console.log(`\n📊 Graph Statistics:`);
    console.log(`   - Total edges: ${totalEdges}`);
    console.log(`   - By kind:`);
    for (const { kind, _count } of edgesByKind) {
      console.log(`     • ${kind}: ${_count}`);
    }

    console.log(`\n✅ Edge decay complete!`);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  run()
    .then(() => {
      console.log("\n🎉 Edge decay finished successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Edge decay failed:", error);
      process.exit(1);
    });
}

export { run };




