import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { BrandAssets } from "@/lib/aesthetic/types";

/**
 * GET - Fetch brand assets for current designer
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brandAssets = await prisma.designerBrandAssets.findUnique({
      where: { userId: session.user.id },
    });

    if (!brandAssets) {
      return NextResponse.json(null);
    }

    return NextResponse.json(brandAssets);
  } catch (error: any) {
    console.error("[brand-assets] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch brand assets" },
      { status: 500 }
    );
  }
}

/**
 * POST/PUT - Save or update brand assets
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const assets: BrandAssets = body;

    // Upsert brand assets
    const brandAssets = await prisma.designerBrandAssets.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        logoLightUrl: assets.logoLightUrl || null,
        logoDarkUrl: assets.logoDarkUrl || null,
        logomarkUrl: assets.logomarkUrl || null,
        primaryColor: assets.primaryColor || null,
        secondaryColor: assets.secondaryColor || null,
        accentColor: assets.accentColor || null,
        backgroundColor: assets.backgroundColor || null,
        headingFont: assets.headingFont || null,
        bodyFont: assets.bodyFont || null,
        moodImageUrls: assets.moodImageUrls || [],
        inspirationNotes: assets.inspirationNotes || null,
        inspiredByDesigners: assets.inspiredByDesigners || [],
        inspiredByPublications: assets.inspiredByPublications || [],
        tagline: assets.tagline || null,
        brandAdjectives: assets.brandAdjectives || [],
      },
      update: {
        logoLightUrl: assets.logoLightUrl || null,
        logoDarkUrl: assets.logoDarkUrl || null,
        logomarkUrl: assets.logomarkUrl || null,
        primaryColor: assets.primaryColor || null,
        secondaryColor: assets.secondaryColor || null,
        accentColor: assets.accentColor || null,
        backgroundColor: assets.backgroundColor || null,
        headingFont: assets.headingFont || null,
        bodyFont: assets.bodyFont || null,
        moodImageUrls: assets.moodImageUrls || [],
        inspirationNotes: assets.inspirationNotes || null,
        inspiredByDesigners: assets.inspiredByDesigners || [],
        inspiredByPublications: assets.inspiredByPublications || [],
        tagline: assets.tagline || null,
        brandAdjectives: assets.brandAdjectives || [],
      },
    });

    // Update profile state if needed
    const projectCount = await prisma.project.count({
      where: {
        designerId: session.user.id,
        OR: [
          { isPublic: true },
          { publishedAt: { not: null } },
          { status: "published" },
        ],
      },
    });

    const { getProfileState } = await import("@/lib/profile/getProfileState");
    const newState = getProfileState(projectCount, true, false, false);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { profileState: newState },
    });

    return NextResponse.json(brandAssets);
  } catch (error: any) {
    console.error("[brand-assets] POST error:", error);
    return NextResponse.json(
      { error: "Failed to save brand assets", message: error.message },
      { status: 500 }
    );
  }
}


