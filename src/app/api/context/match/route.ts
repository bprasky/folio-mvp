import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  nodeType: z.string(),
  nodeId: z.string(),
  targetType: z.string(),
  limit: z.coerce.number().default(10).refine((n) => n <= 50, { message: "Limit must be at most 50" }),
});

/**
 * GET /api/context/match
 * 
 * Find semantically similar nodes using pgvector similarity search
 * 
 * Query params:
 * - nodeType: Type of the source node (e.g., "product", "vendor", "event", "project")
 * - nodeId: ID of the source node
 * - targetType: Type of nodes to match against
 * - limit: Maximum number of results (default: 10, max: 50)
 * 
 * Returns:
 * - results: Array of { nodeType, nodeId, similarity } sorted by similarity (highest first)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const input = schema.parse(Object.fromEntries(searchParams));

    // Find the source embedding
    const src = await prisma.embedding.findUnique({
      where: {
        nodeType_nodeId: {
          nodeType: input.nodeType,
          nodeId: input.nodeId,
        },
      },
    });

    if (!src) {
      return NextResponse.json({
        results: [],
        error: "Source node embedding not found",
      }, { status: 404 });
    }

    // Query for similar embeddings using pgvector
    // Using cosine distance operator (<=>)
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT "nodeType", "nodeId",
        1 - ("vector" <=> $1::vector) AS similarity
      FROM "embeddings"
      WHERE "nodeType" = $2
        AND "nodeId" != $3
      ORDER BY "vector" <-> $1::vector
      LIMIT $4
      `,
      src.vector,
      input.targetType,
      input.nodeId, // Exclude self
      input.limit
    );

    return NextResponse.json({
      results: rows.map(row => ({
        nodeType: row.nodeType,
        nodeId: row.nodeId,
        similarity: parseFloat(row.similarity.toFixed(4)),
      })),
      query: {
        sourceType: input.nodeType,
        sourceId: input.nodeId,
        targetType: input.targetType,
        limit: input.limit,
      },
    });
  } catch (error) {
    console.error("[ContextMatch] Error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/context/match
 * 
 * Same as GET but with request body for more complex queries
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = schema.parse(body);

    const src = await prisma.embedding.findUnique({
      where: {
        nodeType_nodeId: {
          nodeType: input.nodeType,
          nodeId: input.nodeId,
        },
      },
    });

    if (!src) {
      return NextResponse.json({
        results: [],
        error: "Source node embedding not found",
      }, { status: 404 });
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT "nodeType", "nodeId",
        1 - ("vector" <=> $1::vector) AS similarity
      FROM "embeddings"
      WHERE "nodeType" = $2
        AND "nodeId" != $3
      ORDER BY "vector" <-> $1::vector
      LIMIT $4
      `,
      src.vector,
      input.targetType,
      input.nodeId,
      input.limit
    );

    return NextResponse.json({
      results: rows.map(row => ({
        nodeType: row.nodeType,
        nodeId: row.nodeId,
        similarity: parseFloat(row.similarity.toFixed(4)),
      })),
      query: {
        sourceType: input.nodeType,
        sourceId: input.nodeId,
        targetType: input.targetType,
        limit: input.limit,
      },
    });
  } catch (error) {
    console.error("[ContextMatch] Error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

