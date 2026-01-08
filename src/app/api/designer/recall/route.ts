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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    // Return empty if query is too short
    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const userId = session.user.id;

    // Query A: ProductTag-based recall
    const tagResults = await prisma.productTag.findMany({
      where: {
        image: {
          project: {
            OR: [
              { designerId: userId },
              { ownerId: userId },
            ],
          },
        },
        OR: [
          { product: { name: { contains: query, mode: 'insensitive' } } },
          { product: { brand: { contains: query, mode: 'insensitive' } } },
          { image: { room: { contains: query, mode: 'insensitive' } } },
        ],
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
      take: 20,
    });

    // Query B: Selection-based recall
    const selectionResults = await prisma.selection.findMany({
      where: {
        project: {
          OR: [
            { designerId: userId },
            { ownerId: userId },
          ],
        },
        OR: [
          { productName: { contains: query, mode: 'insensitive' } },
          { vendorName: { contains: query, mode: 'insensitive' } },
          { room: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
          },
        },
        room: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    // Normalize and deduplicate results
    const resultMap = new Map<string, {
      type: 'tag' | 'selection';
      project: { id: string; title: string | null };
      room: string | null;
      product: { id?: string; name: string | null; brand?: string | null; imageUrl?: string | null };
      vendorName?: string | null;
      tagId?: string;
      imageId?: string;
      x?: number;
      y?: number;
      at: string;
      deepLink: string;
    }>();

    // Process tag results
    for (const tag of tagResults) {
      const key = `${tag.image.project.id}-${tag.product.name}-${tag.image.room || ''}`;
      if (!resultMap.has(key)) {
        // Normalize vendorName
        const vendorName = tag.product.vendorRecord?.name ||
                          tag.product.vendor?.companyName ||
                          tag.product.vendor?.name ||
                          null;

        resultMap.set(key, {
          type: 'tag',
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
        });
      }
    }

    // Process selection results
    for (const selection of selectionResults) {
      const roomName = selection.room?.name || null;
      const key = `${selection.project.id}-${selection.productName || ''}-${roomName || ''}`;
      if (!resultMap.has(key)) {
        const deepLink = selection.room?.id
          ? `/designer/projects/${selection.project.id}?room=${selection.room.id}`
          : `/designer/projects/${selection.project.id}`;

        resultMap.set(key, {
          type: 'selection',
          project: {
            id: selection.project.id,
            title: selection.project.title,
          },
          room: roomName,
          product: {
            name: selection.productName || null,
            brand: undefined,
            imageUrl: selection.photo || undefined,
          },
          vendorName: selection.vendorName || null,
          at: selection.createdAt.toISOString(),
          deepLink,
        });
      }
    }

    // Convert map to array and sort by timestamp (most recent first)
    const results = Array.from(resultMap.values()).sort((a, b) => {
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

    // Type the response properly
    type RecallResult = {
      type: 'tag' | 'selection';
      project: { id: string; title: string | null };
      room: string | null;
      product: { id?: string; name: string | null; brand?: string | null; imageUrl?: string | null };
      vendorName?: string | null;
      tagId?: string;
      imageId?: string;
      x?: number;
      y?: number;
      at: string;
      deepLink: string;
    };

    return NextResponse.json({ results: results as RecallResult[] });

  } catch (error) {
    console.error('Failed to fetch recall results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recall results' },
      { status: 500 }
    );
  }
}

