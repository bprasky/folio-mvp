export const dynamic = 'force-dynamic';

import { stripPrivateInterviewData } from '@/lib/spotlight/privacy';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { detectAesthetic, DetectionInput } from "@/lib/aesthetic";
import { AestheticProfile } from "@/lib/aesthetic/types";

/**
 * POST /api/aesthetic/detect
 * 
 * Detects aesthetic profile for a designer based on their projects.
 * Accepts either designerId or projectIds.
 * 
 * Body: { designerId?: string, projectIds?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { designerId, projectIds } = body;

    if (!designerId && !projectIds) {
      return NextResponse.json(
        { error: "Either designerId or projectIds must be provided" },
        { status: 400 }
      );
    }

    // Determine which projects to analyze
    let projects;
    if (projectIds && Array.isArray(projectIds)) {
      projects = await prisma.project.findMany({
        where: {
          id: { in: projectIds },
          // Only analyze published projects
          OR: [
            { isPublic: true },
            { publishedAt: { not: null } },
            { status: "published" },
          ],
        },
        include: {
          images: {
            select: {
              id: true,
              url: true,
              // Include precomputed signals if available
              imageSignals: true,
            },
          },
          rooms: {
            select: {
              type: true,
              // Materials might be in selections or room metadata
            },
          },
        },
      });
    } else if (designerId) {
      projects = await prisma.project.findMany({
        where: {
          designerId,
          // Only analyze published projects
          OR: [
            { isPublic: true },
            { publishedAt: { not: null } },
            { status: "published" },
          ],
        },
        include: {
          images: {
            select: {
              id: true,
              url: true,
              imageSignals: true,
            },
          },
          rooms: {
            select: {
              type: true,
            },
          },
        },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    if (projects.length < 2) {
      return NextResponse.json(
        {
          error: "Not enough published projects",
          message: "At least 2 published projects are required for aesthetic detection",
        },
        { status: 400 }
      );
    }

    // Fetch product tags for material analysis
    const fetchedProjectIds = projects.map((p) => p.id);
    const productTags = await prisma.productTag.findMany({
      where: {
        image: {
          projectId: { in: fetchedProjectIds },
        },
      },
      include: {
        product: {
          select: {
            category: true,
            // Materials might be stored in a JSON field or separate table
            // Adjust based on your schema
          },
        },
        image: {
          select: {
            id: true,
            projectId: true,
          },
        },
      },
    });

    // Fetch interviews for language analysis
    const interviews = await stripPrivateInterviewData(await prisma.editorialInterview.findMany({
      where: {
        projectId: { in: fetchedProjectIds },
        status: "COMPLETED",
      },
      include: {
        answers: {
          select: {
            questionId: true, answerText: true,
          },
        },
      },
    }));

    // Transform to DetectionInput format
    const detectionInput: DetectionInput = {
      projects: projects.map((project) => ({
        id: project.id,
        images: project.images.map((img) => ({
          url: img.url,
          precomputedSignals: img.imageSignals as any,
        })),
        productTags: productTags
          .filter((tag) => tag.image.projectId === project.id)
          .map((tag) => ({
            product: {
              category: tag.product.category || undefined,
              materials: [], // TODO: Extract from product data if available
            },
          })),
        rooms: project.rooms.map((room) => ({
          type: room.type || "",
          materials: [], // TODO: Extract from room data if available
        })),
        description: project.description || undefined,
      })),
      interviews: interviews.map((interview) => ({
        transcript: interview.answers.map((a) => a.answerText).join(" "),
      })),
    };

    // Run detection
    const aestheticProfile = await detectAesthetic(detectionInput);

    // Save to User model if designerId was provided
    if (designerId) {
      await prisma.user.update({
        where: { id: designerId },
        data: {
          aestheticProfile: aestheticProfile as any,
          aestheticDetectedAt: new Date(),
        },
      });
    }

    return NextResponse.json(aestheticProfile);
  } catch (error: any) {
    console.error("[aesthetic/detect] Error:", error);
    return NextResponse.json(
      { error: "Failed to detect aesthetic", message: error.message },
      { status: 500 }
    );
  }
}


