import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get vendor's projects and selections
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: session.user.id },
          { selections: { some: { vendorRepId: session.user.id } } },
        ],
      },
      select: {
        id: true,
        title: true,
        city: true,
        regionState: true,
        createdAt: true,
        selections: {
          where: { vendorRepId: session.user.id },
          select: {
            id: true,
            productName: true,
            vendorName: true,
            createdAt: true,
            tags: true,
          },
        },
      },
    });

    // Spec Heatmap: counts by city/region
    const specHeatmap = projects.reduce((acc, project) => {
      const key = project.city || project.regionState || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Trending Products: top vendor SKUs by saves/spec adds over trailing 30/90 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const trendingProducts = projects
      .flatMap(p => p.selections)
      .reduce((acc, selection) => {
        const key = selection.productName || selection.vendorName || 'Unknown';
        if (!acc[key]) {
          acc[key] = { count: 0, recent: 0, selections: [] };
        }
        acc[key].count++;
        acc[key].selections.push(selection);
        
        if (new Date(selection.createdAt) > thirtyDaysAgo) {
          acc[key].recent++;
        }
        return acc;
      }, {} as Record<string, { count: number; recent: number; selections: any[] }>);

    const trendingProductsSorted = Object.entries(trendingProducts)
      .map(([name, data]) => ({
        name,
        totalSpecs: data.count,
        recentSpecs: data.recent,
        selections: data.selections,
      }))
      .sort((a, b) => b.recentSpecs - a.recentSpecs)
      .slice(0, 10);

    // Designer Influence: ranked designers by repeat spec conversions
    const designerInfluence = projects.reduce((acc, project) => {
      if (project.ownerId !== session.user.id) {
        const designerId = project.ownerId;
        if (!acc[designerId]) {
          acc[designerId] = {
            designerId,
            projectCount: 0,
            selectionCount: 0,
            recentActivity: 0,
          };
        }
        acc[designerId].projectCount++;
        acc[designerId].selectionCount += project.selections.length;
        
        if (new Date(project.createdAt) > thirtyDaysAgo) {
          acc[designerId].recentActivity++;
        }
      }
      return acc;
    }, {} as Record<string, { designerId: string; projectCount: number; selectionCount: number; recentActivity: number }>);

    const designerInfluenceSorted = Object.values(designerInfluence)
      .map(designer => ({
        ...designer,
        influenceScore: designer.projectCount * 2 + designer.selectionCount + designer.recentActivity * 3,
      }))
      .sort((a, b) => b.influenceScore - a.influenceScore)
      .slice(0, 10);

    // Pipeline Snapshot: counts by specified, awaiting_approval, quoted
    const pipelineSnapshot = {
      specified: projects.length,
      awaitingApproval: projects.filter(p => p.selections.length > 0).length,
      quoted: 0, // This would require checking QuoteAttachment table
    };

    // Get quote counts if QuoteAttachment table exists
    try {
      const quoteCount = await prisma.quoteAttachment?.count?.({
        where: { vendorId: session.user.id },
      }).catch(() => 0);
      pipelineSnapshot.quoted = quoteCount || 0;
    } catch {
      // QuoteAttachment table doesn't exist yet
    }

    return NextResponse.json({
      ok: true,
      analytics: {
        specHeatmap,
        trendingProducts: trendingProductsSorted,
        designerInfluence: designerInfluenceSorted,
        pipelineSnapshot,
        summary: {
          totalProjects: projects.length,
          totalSelections: projects.reduce((sum, p) => sum + p.selections.length, 0),
          activeRegions: Object.keys(specHeatmap).length,
          topProduct: trendingProductsSorted[0]?.name || null,
          topDesigner: designerInfluenceSorted[0]?.designerId || null,
        },
      },
    });
  } catch (error: any) {
    console.error("[vendor-analytics][GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

