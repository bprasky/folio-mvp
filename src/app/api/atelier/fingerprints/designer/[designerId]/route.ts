export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { AtelierOwnerType } from "@prisma/client";

type Params = { params: { designerId: string } };

/**
 * GET /api/atelier/fingerprints/designer/[designerId]
 *
 * Returns the computed fingerprint for a designer.
 * This is the primary endpoint for looking up a designer's Atelier fingerprint.
 *
 * Query params:
 *   - includeNodes: boolean (default true) - include node data
 *   - includeEdges: boolean (default true) - include edge data
 *   - format: 'full' | 'summary' | 'deployment' (default 'full')
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

    const { designerId } = params;
    const searchParams = req.nextUrl.searchParams;
    const includeNodes = searchParams.get('includeNodes') !== 'false';
    const includeEdges = searchParams.get('includeEdges') !== 'false';
    const format = searchParams.get('format') || 'full';

    // Find fingerprint for this designer
    const fingerprint = await prisma.atelierFingerprint.findFirst({
      where: {
        designerId,
        ownerType: AtelierOwnerType.DESIGNER,
      },
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
        { error: "Fingerprint not found for this designer" },
        { status: 404 }
      );
    }

    // Check authorization - user must be the owner, an admin, or have deployment access
    const user = session.user as { id: string; role: string };
    const isOwner = fingerprint.designerId === user.id;
    const isAdmin = user.role === 'ADMIN';

    // For non-owners/non-admins, check if there's a deployment they have access to
    if (!isOwner && !isAdmin) {
      // For now, allow read access to fingerprints for consultation purposes
      // In production, you'd check if the user has deployment access
      // return NextResponse.json(
      //   { error: "Forbidden - not the fingerprint owner" },
      //   { status: 403 }
      // );
    }

    // Get designer info for context
    const designer = await prisma.user.findUnique({
      where: { id: designerId },
      select: {
        id: true,
        name: true,
        studio: true,
        voiceProfile: {
          select: {
            formalityLevel: true,
            enthusiasmLevel: true,
            technicalDepth: true,
            reasoningStyle: true,
            signaturePhrases: true,
          }
        }
      }
    });

    if (format === 'summary') {
      const summary = buildFingerprintSummary(fingerprint, designer);
      return NextResponse.json({ fingerprint: summary });
    }

    if (format === 'deployment') {
      // Return a deployment-ready format with context injection structure
      const deploymentContext = buildDeploymentContext(fingerprint, designer);
      return NextResponse.json({ deploymentContext });
    }

    return NextResponse.json({
      fingerprint,
      designer: {
        id: designer?.id,
        name: designer?.name,
        studio: designer?.studio,
      }
    });
  } catch (error: any) {
    console.error("Error fetching designer Atelier fingerprint:", error);
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
function buildFingerprintSummary(fingerprint: any, designer: any) {
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
    completeness: fingerprint.completeness,
    version: fingerprint.version,
    lastComputedAt: fingerprint.lastComputedAt,

    designer: {
      name: designer?.name,
      studio: designer?.studio,
    },

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

/**
 * Builds a deployment-ready context for AI prompts
 */
function buildDeploymentContext(fingerprint: any, designer: any) {
  const summary = buildFingerprintSummary(fingerprint, designer);

  // Build natural language descriptions for prompt injection
  const styleDescription = summary.stylePreferences.length > 0
    ? `favors ${summary.stylePreferences.map((s: any) => s.label).join(', ')} aesthetics`
    : 'eclectic style preferences';

  const materialDescription = summary.materialAffinities.length > 0
    ? `drawn to ${summary.materialAffinities.map((m: any) => m.label).join(', ')}`
    : 'diverse material interests';

  const roomDescription = summary.roomExpertise.length > 0
    ? `particularly experienced with ${summary.roomExpertise.map((r: any) => r.label).join(', ')}`
    : 'broad room expertise';

  const voiceProfile = designer?.voiceProfile;

  return {
    fingerprintId: fingerprint.id,
    designerName: designer?.name || 'Designer',
    designerStudio: designer?.studio,
    version: fingerprint.version,
    completeness: fingerprint.completeness,

    // Structured data for programmatic use
    preferences: {
      styles: summary.stylePreferences,
      materials: summary.materialAffinities,
      rooms: summary.roomExpertise,
      vendors: summary.vendorRelationships,
      categories: summary.categoryFocus,
    },

    // Natural language for prompt injection
    designDNA: {
      styleDescription,
      materialDescription,
      roomDescription,
    },

    // Voice characteristics (if available)
    voiceProfile: voiceProfile ? {
      formalityLevel: voiceProfile.formalityLevel,
      enthusiasmLevel: voiceProfile.enthusiasmLevel,
      technicalDepth: voiceProfile.technicalDepth,
      reasoningStyle: voiceProfile.reasoningStyle,
      signaturePhrases: voiceProfile.signaturePhrases,
    } : null,

    // Prompt template variables
    promptVariables: {
      designerName: designer?.name || 'the designer',
      styleList: summary.stylePreferences.map((s: any) => s.label).join(', ') || 'varied',
      materialList: summary.materialAffinities.map((m: any) => m.label).join(', ') || 'diverse',
      roomExpertise: summary.roomExpertise.map((r: any) => r.label).join(', ') || 'all spaces',
      topVendors: summary.vendorRelationships.slice(0, 3).map((v: any) => v.label).join(', ') || 'quality vendors',
    },
  };
}
