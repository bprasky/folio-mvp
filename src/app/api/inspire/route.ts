import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    console.log(`User ${(session.user as any).id} fetching inspire posts - page ${page}`);

    // Fetch published projects with their images
    const projects = await prisma.project.findMany({
      where: {
        status: 'published'
      },
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          }
        },
        images: {
          select: {
            id: true,
            url: true,
            name: true,
            room: true,
          },
          take: 1 // Take only the first image per project
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: skip,
      take: limit
    });

    // Transform projects into inspire posts format
    const inspirePosts = projects
      .filter(project => project.images.length > 0) // Only include projects with images
      .map(project => {
        const image = project.images[0];
        return {
          id: `project-${project.id}`,
          imageUrl: image.url,
          title: project.name,
          author: project.designer.name,
          authorImage: project.designer.profileImage || '/default-avatar.png',
          likes: Math.floor(Math.random() * 500) + 50, // Mock engagement data
          saves: project.saves,
          views: project.views,
          type: determinePostType(project.saves, project.views),
          aspectRatio: calculateAspectRatio(image.id),
          projectLink: `/project/${project.id}`,
          designerLink: `/designer/${project.designer.id}`,
          room: image.room,
          category: project.category,
          createdAt: project.createdAt,
        };
      });

    console.log(`Returning ${inspirePosts.length} inspire posts`);

    return NextResponse.json({
      success: true,
      posts: inspirePosts,
      page: page,
      total: inspirePosts.length,
      hasMore: inspirePosts.length === limit
    });

  } catch (error) {
    console.error('Error fetching inspire posts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch inspire posts' },
      { status: 500 }
    );
  }
}

// Helper function to determine post type based on engagement
function determinePostType(saves: number, views: number): 'regular' | 'featured' | 'boosted' | 'viral' {
  const engagementRatio = saves / Math.max(views, 1);
  
  if (saves > 100 && views > 1000) {
    return 'viral';
  } else if (engagementRatio > 0.1) {
    return 'featured';
  } else if (saves > 50) {
    return 'boosted';
  } else {
    return 'regular';
  }
}

// Helper function to calculate aspect ratio (mock implementation)
function calculateAspectRatio(imageId: string): number {
  // Mock aspect ratios based on image ID hash
  const ratios = [0.8, 1.0, 1.2, 1.5, 0.6];
  const hash = imageId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ratios[hash % ratios.length];
} 