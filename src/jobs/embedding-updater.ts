#!/usr/bin/env tsx
/**
 * FOLIO Embedding Updater Job
 * 
 * Generates AI embeddings for products, vendors, projects, and events
 * to enable semantic similarity search in the context graph.
 * 
 * Usage: pnpm jobs:embed
 */

import { prisma } from "@/lib/prisma";
import { embedText, vectorToBuffer, buildEmbeddingText } from "@/lib/ai/embeddings";

interface EmbeddingTarget {
  nodeType: string;
  nodeId: string;
  text: string;
}

/**
 * Fetch products that need embeddings
 */
async function fetchProducts(limit: number = 50): Promise<EmbeddingTarget[]> {
  const products = await prisma.product.findMany({
    take: limit,
    where: {
      isPending: false, // Only embed published products
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return products.map(p => ({
    nodeType: "product",
    nodeId: p.id,
    text: buildEmbeddingText({
      name: p.name,
      description: p.description,
      category: p.category,
      brand: p.brand,
    }),
  }));
}

/**
 * Fetch vendors (users with VENDOR role) that need embeddings
 */
async function fetchVendors(limit: number = 50): Promise<EmbeddingTarget[]> {
  const vendors = await prisma.user.findMany({
    take: limit,
    where: {
      role: 'VENDOR',
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return vendors.map(v => ({
    nodeType: "vendor",
    nodeId: v.id,
    text: buildEmbeddingText({
      name: v.name,
      description: v.bio,
      tags: v.specialties,
    }),
  }));
}

/**
 * Fetch events that need embeddings
 */
async function fetchEvents(limit: number = 50): Promise<EmbeddingTarget[]> {
  const events = await prisma.event.findMany({
    take: limit,
    where: {
      isPublic: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return events.map(e => ({
    nodeType: "event",
    nodeId: e.id,
    text: buildEmbeddingText({
      title: e.title,
      description: e.description,
      eventTypes: e.eventTypes,
      designStyles: e.designStyles,
      tags: e.eventTags,
    }),
  }));
}

/**
 * Fetch projects that need embeddings
 */
async function fetchProjects(limit: number = 50): Promise<EmbeddingTarget[]> {
  const projects = await prisma.project.findMany({
    take: limit,
    where: {
      isPublic: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return projects.map(p => ({
    nodeType: "project",
    nodeId: p.id,
    text: buildEmbeddingText({
      title: p.title,
      description: p.description,
      category: p.category,
    }),
  }));
}

/**
 * Generate and store embeddings for a batch of targets
 */
async function processEmbeddings(targets: EmbeddingTarget[]) {
  let processed = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      // Generate embedding
      const vector = await embedText(target.text);
      const vectorBuffer = vectorToBuffer(vector);

      // Upsert into database using raw SQL for pgvector compatibility
      await prisma.$executeRawUnsafe(
        `INSERT INTO "embeddings" ("id", "nodeType", "nodeId", "vector", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         ON CONFLICT ("nodeType", "nodeId")
         DO UPDATE SET "vector" = $3, "updatedAt" = $4`,
        target.nodeType,
        target.nodeId,
        vectorBuffer,
        new Date()
      );

      processed++;
      console.log(`✓ Embedded ${target.nodeType}:${target.nodeId}`);
    } catch (error) {
      failed++;
      console.error(`✗ Failed to embed ${target.nodeType}:${target.nodeId}:`, error);
    }
  }

  return { processed, failed };
}

/**
 * Main execution
 */
async function run() {
  console.log("🚀 Starting embedding updater...\n");

  try {
    // Fetch all targets
    const [products, vendors, events, projects] = await Promise.all([
      fetchProducts(50),
      fetchVendors(50),
      fetchEvents(50),
      fetchProjects(50),
    ]);

    const allTargets = [...products, ...vendors, ...events, ...projects];
    
    console.log(`📊 Found ${allTargets.length} targets:`);
    console.log(`   - ${products.length} products`);
    console.log(`   - ${vendors.length} vendors`);
    console.log(`   - ${events.length} events`);
    console.log(`   - ${projects.length} projects\n`);

    if (allTargets.length === 0) {
      console.log("✓ No targets to process. Exiting.");
      return;
    }

    // Process embeddings
    const { processed, failed } = await processEmbeddings(allTargets);

    console.log(`\n✅ Complete!`);
    console.log(`   - Processed: ${processed}`);
    console.log(`   - Failed: ${failed}`);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  run()
    .then(() => {
      console.log("\n🎉 Embedding updater finished successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Embedding updater failed:", error);
      process.exit(1);
    });
}

export { run };




