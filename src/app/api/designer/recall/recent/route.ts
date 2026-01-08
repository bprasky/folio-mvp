export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get last 5 ProductTags scoped to designer's projects
    const recentTags = await prisma.productTag.findMany({
      where: {
        image: {
          project: {
            OR: [
              { designerId: userId },
              { ownerId: userId },
            ],
          },
        },
      },
      include: {
        product: {
          include: {
            vendorRecord: {
              select: {
                id: true,
                name: true,
              },
            },
            vendor: {
              select: {
                id: true,
                name: true,
                companyName: true,
              },
            },
          },
        },
        image: {
          include: {
            project: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    // Normalize results
    const results = recentTags.map((tag) => {
      const vendorName = tag.product.vendorRecord?.name ||
                        tag.product.vendor?.companyName ||
                        tag.product.vendor?.name ||
                        null;

      return {
        type: 'tag' as const,
        project: {
          id: tag.image.project.id,
          title: tag.image.project.title,
        },
        room: tag.image.room || null,
        product: {
          id: tag.product.id,
          name: tag.product.name,
          brand: tag.product.brand || undefined,
          imageUrl: tag.product.imageUrl || undefined,
        },
        vendorName,
        tagId: tag.id,
        imageId: tag.image.id,
        x: tag.x,
        y: tag.y,
        at: tag.createdAt.toISOString(),
        deepLink: `/designer/projects/${tag.image.project.id}?image=${tag.image.id}&tag=${tag.id}`,
      };
    });

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Failed to fetch recent recall items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent items' },
      { status: 500 }
    );
  }
}








