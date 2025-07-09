import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');

    if (!vendorId) {
      return NextResponse.json(
        { success: false, error: 'Vendor ID is required' },
        { status: 400 }
      );
    }

    // Get all products for this vendor
    const vendorProducts = await prisma.product.findMany({
      where: {
        vendorId: vendorId,
      },
      select: {
        id: true,
      },
    });

    const productIds = vendorProducts.map(p => p.id);

    if (productIds.length === 0) {
      return NextResponse.json({
        success: true,
        images: [],
      });
    }

    // Get tagged images that contain this vendor's products
    const taggedImages = await prisma.projectImage.findMany({
      where: {
        tags: {
          some: {
            productId: {
              in: productIds,
            },
          },
        },
      },
      include: {
        project: {
          include: {
            designer: true,
          },
        },
        tags: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20, // Limit to 20 most recent
    });

    // Transform the data for the frontend
    const transformedImages = taggedImages.map(image => {
      // Get unique products tagged in this image
      const uniqueProducts = image.tags
        .map(tag => tag.product)
        .filter((product, index, self) => 
          self.findIndex(p => p.id === product.id) === index
        );

      return {
        id: image.id,
        url: image.url,
        projectId: image.project.id,
        projectName: image.project.name,
        designerName: image.project.designer?.name || 'Unknown Designer',
        room: image.room || 'General',
        products: uniqueProducts.map(product => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          imageUrl: product.imageUrl,
          category: product.category,
          brand: product.brand,
          url: product.url,
          tags: 0, // Will be calculated separately
          saves: 0, // Will be calculated separately
          views: 0, // Will be calculated separately
        })),
        tags: image.tags.length,
        saves: 0, // Placeholder - could be calculated from folder saves
        views: 0, // Placeholder - could be calculated from project views
        createdAt: image.createdAt?.toISOString() || new Date().toISOString(),
      };
    });

    // Calculate metrics for products
    for (const image of transformedImages) {
      for (const product of image.products) {
        // Get tag count for this product
        const tagCount = await prisma.productTag.count({
          where: {
            productId: product.id,
          },
        });

        // Get save count (placeholder - would need folder relationship)
        const saveCount = Math.floor(Math.random() * 50) + 5; // Mock data for now

        // Get view count (placeholder - would need project views)
        const viewCount = Math.floor(Math.random() * 200) + 20; // Mock data for now

        product.tags = tagCount;
        product.saves = saveCount;
        product.views = viewCount;
      }

      // Calculate image metrics
      image.saves = Math.floor(Math.random() * 100) + 10; // Mock data
      image.views = Math.floor(Math.random() * 500) + 50; // Mock data
    }

    return NextResponse.json({
      success: true,
      images: transformedImages,
    });

  } catch (error) {
    console.error('Error fetching vendor tagged images:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendor tagged images' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 