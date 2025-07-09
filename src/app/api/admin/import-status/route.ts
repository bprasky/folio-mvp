import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get users with their import status
    const users = await prisma.user.findMany({
      where: {
        profileType: 'designer'
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        designerProfile: true,
        designerProjects: {
          select: {
            id: true,
            images: {
              select: {
                id: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform into import status format
    const importStatuses = users.map(user => {
      const hasProfile = !!user.designerProfile;
      const hasProjects = user.designerProjects.length > 0;
      const hasImages = user.designerProjects.some(p => p.images.length > 0);

      let status: 'pending' | 'completed' | 'failed' = 'pending';
      let errorMessage: string | undefined;

      if (hasProfile && hasProjects && hasImages) {
        status = 'completed';
      } else if (!hasProfile) {
        status = 'failed';
        errorMessage = 'No designer profile created';
      } else if (!hasProjects) {
        status = 'failed';
        errorMessage = 'No projects imported';
      } else if (!hasImages) {
        status = 'failed';
        errorMessage = 'No images found in projects';
      }

      return {
        userId: user.id,
        email: user.email || 'No email',
        status,
        createdAt: user.createdAt.toISOString(),
        errorMessage
      };
    });

    return NextResponse.json(importStatuses);
  } catch (error) {
    console.error('Error fetching import status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import status' },
      { status: 500 }
    );
  }
} 