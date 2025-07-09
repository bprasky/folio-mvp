import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('id');

    if (vendorId) {
      // Get specific vendor with products and metrics
      const vendor = await prisma.user.findUnique({
        where: {
          id: vendorId,
          profileType: 'vendor'
        },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              imageUrl: true,
              category: true,
              brand: true,
              url: true,
              createdAt: true
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

      if (!vendor) {
        return NextResponse.json(
          { success: false, error: 'Vendor not found' },
          { status: 404 }
        );
      }

      // Calculate comprehensive metrics
      const vendorProductIds = vendor.products.map(p => p.id);
      
      // Get total projects using this vendor's products
      const totalProjects = await prisma.projectImage.count({
        where: {
          tags: {
            some: {
              productId: {
                in: vendorProductIds
              }
            }
          }
        }
      });

      // Get unique designers using this vendor's products
      const uniqueDesigners = await prisma.projectImage.findMany({
        where: {
          tags: {
            some: {
              productId: {
                in: vendorProductIds
              }
            }
          }
        },
        include: {
          project: {
            select: {
              designerId: true
            }
          }
        }
      });

      const designerIds = Array.from(new Set(uniqueDesigners.map(img => img.project.designerId)));
      const totalDesigners = designerIds.length;

      // Get most popular room type
      const roomCounts = await prisma.projectImage.groupBy({
        by: ['room'],
        where: {
          tags: {
            some: {
              productId: {
                in: vendorProductIds
              }
            }
          }
        },
        _count: {
          room: true
        },
        orderBy: {
          _count: {
            room: 'desc'
          }
        },
        take: 1
      });

      const mostPopularRoom = roomCounts[0]?.room || 'General';

      // Get trending product (most tagged in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const trendingProduct = await prisma.productTag.groupBy({
        by: ['productId'],
        where: {
          productId: {
            in: vendorProductIds
          },
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        _count: {
          productId: true
        },
        orderBy: {
          _count: {
            productId: 'desc'
          }
        },
        take: 1
      });

      let trendingProductName = 'No recent activity';
      if (trendingProduct.length > 0) {
        const trendingProductData = await prisma.product.findUnique({
          where: { id: trendingProduct[0].productId },
          select: { name: true }
        });
        trendingProductName = trendingProductData?.name || 'Unknown Product';
      }

      return NextResponse.json({
        success: true,
        vendor: {
          id: vendor.id,
          name: vendor.name,
          companyName: vendor.companyName,
          description: vendor.bio,
          logo: vendor.profileImage,
          website: vendor.website,
          products: vendor.products,
          metrics: {
            totalProjects,
            totalDesigners,
            mostPopularRoom,
            trendingProduct: trendingProductName,
            products: vendor.products.length,
            followers: vendor.followers || 0,
            views: vendor.views || 0
          }
        }
      });
    } else {
      // Get all vendors with product counts
      const vendors = await prisma.user.findMany({
        where: {
          profileType: 'vendor'
        },
        include: {
          _count: {
            select: {
              products: true
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      });

      const formattedVendors = vendors.map(vendor => ({
        id: vendor.id,
        name: vendor.name,
        companyName: vendor.companyName,
        description: vendor.bio,
        logo: vendor.profileImage,
        website: vendor.website,
        metrics: {
          products: vendor._count.products,
          followers: vendor.followers || 0,
          views: vendor.views || 0
        }
      }));

      return NextResponse.json({
        success: true,
        vendors: formattedVendors
      });
    }
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendors' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 