import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch real projects for the current user
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: session.user.id },
          { designerId: session.user.id }
        ]
      },
      select: {
        id: true,
        description: true, // Use description as name since Project model doesn't have name field
        rooms: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Transform to match expected format
    const transformedProjects = projects.map(project => ({
      id: project.id,
      name: project.description || 'Untitled Project',
      rooms: project.rooms
    }));

    return NextResponse.json(transformedProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}