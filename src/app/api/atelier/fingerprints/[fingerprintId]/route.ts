export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

type Params = { params: { fingerprintId: string } };

/**
 * GET /api/atelier/fingerprints/[fingerprintId]
 *
 * Returns the computed fingerprint with nodes and edges.
 * This is the critical missing API for Atelier deployment and recommendations.
 *
 * Query params:
 *   - includeNodes: boolean (default true) - include node data
 *   - includeEdges: boolean (default true) - include edge data
 *   - format: 'full' | 'summary' (default 'full') - response format
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { fingerprintId } = params;
    const searchParams = req.nextUrl.searchParams;
    const includeNodes = searchParams.get('includeNodes') !== 'false';
    const includeEdges = searchParams.get('includeEdges') !== 'false';
    const format = searchParams.get('format') || 'full';

    const fingerprint = await prisma.atelierFingerprint.findUnique({
      where: { id: fingerprintId },
      include: {
        nodes: includeNodes,
        edges: includeEdges ? {
          include: {
            sourceNode: true,
            targetNode: true,
          }
        } : false,
      },
    });

    if (!fingerprint) {
      return NextResponse.json(
        { error: "Fingerprint not found" },
        { status: 404 }
      );
    }

    // Check authorization - user must be the owner or an admin
    const user = session.user as { id: string; role: string };
    const isOwner = fingerprint.designerId === user.id || fingerprint.vendorId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - not the fingerprint owner" },
        { status: 403 }
      );
    }

    if (format === 'summary') {
      // Return a summarized version for quick lookups
      const summary = buildFingerprintSummary(fingerprint);
      return NextResponse.json({ fingerprint: summary });
    }

    return NextResponse.json({ fingerprint });
  } catch (error: any) {
    console.error("Error fetching Atelier fingerprint:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch fingerprint",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}

/**
 * Builds a summarized fingerprint for use in AI context injection
 */
function buildFingerprintSummary(fingerprint: any) {
  const nodes = fingerprint.nodes || [];

  // Group nodes by type
  const styleNodes = nodes.filter((n: any) => n.nodeType === 'STYLE');
  const roomNodes = nodes.filter((n: any) => n.nodeType === 'ROOM_TYPE');
  const materialNodes = nodes.filter((n: any) => n.nodeType === 'MATERIAL');
  const vendorNodes = nodes.filter((n: any) => n.nodeType === 'VENDOR');
  const categoryNodes = nodes.filter((n: any) => n.nodeType === 'PRODUCT_CATEGORY');

  // Sort by weight and take top items
  const topByWeight = (arr: any[], limit: number) =>
    arr.sort((a, b) => b.weight - a.weight).slice(0, limit).map(n => ({
      label: n.label,
      weight: n.weight,
    }));

  return {
    id: fingerprint.id,
    ownerType: fingerprint.ownerType,
    designerId: fingerprint.designerId,
    vendorId: fingerprint.vendorId,
    completeness: fingerprint.completeness,
    version: fingerprint.version,
    lastComputedAt: fingerprint.lastComputedAt,

    // Summarized preferences
    stylePreferences: topByWeight(styleNodes, 5),
    roomExpertise: topByWeight(roomNodes, 5),
    materialAffinities: topByWeight(materialNodes, 5),
    vendorRelationships: topByWeight(vendorNodes, 10),
    categoryFocus: topByWeight(categoryNodes, 5),

    // Stats
    nodeCount: nodes.length,
    edgeCount: fingerprint.edges?.length || 0,
  };
}
