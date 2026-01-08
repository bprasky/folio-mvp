export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is a vendor rep
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        isVendorRep: true,
        vendorOrganizationId: true,
      },
    });

    if (!user || !user.isVendorRep || !user.vendorOrganizationId) {
      return NextResponse.json(
        { error: 'User is not a vendor rep' },
        { status: 403 }
      );
    }

    const orgId = user.vendorOrganizationId;

    // Find all projects where this vendor organization was tagged
    // Via vendorOrgId on projects
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { vendorOrgId: orgId },
          {
            images: {
              some: {
                tags: {
                  some: {
                    product: {
                      vendor: {
                        organizationUsers: {
                          some: {
                            organizationId: orgId,
                            isActive: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
          },
        },
        images: {
          take: 1,
          select: {
            url: true,
            tags: {
              where: {
                product: {
                  vendor: {
                    organizationUsers: {
                      some: {
                        organizationId: orgId,
                        isActive: true,
                      },
                    },
                  },
                },
              },
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    // Get designers this rep is following
    const following = await prisma.follow.findMany({
      where: {
        followerId: user.id,
      },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Shape feed items
    const feedItems = projects.map((project) => {
      // Count tags from all images
      const productCount = project.images.reduce((count, img) => count + (img.tags?.length || 0), 0);
      const designer = project.designer;
      
      return {
        id: project.id,
        type: 'project_tagged' as const,
        project: {
          id: project.id,
          title: project.title,
          description: project.description,
          imageUrl: project.images[0]?.url,
          updatedAt: project.updatedAt,
        },
        designer: designer ? {
          id: designer.id,
          name: designer.name,
          email: designer.email,
          profileImage: designer.profileImage,
        } : null,
        summary: designer
          ? `Designer ${designer.name} tagged ${productCount} of your products in ${project.title || 'a project'}`
          : `${productCount} of your products were tagged in ${project.title || 'a project'}`,
        productCount,
        createdAt: project.updatedAt,
      };
    });

    return NextResponse.json({
      feedItems,
      following: following.map((f) => f.following),
      organizationId: orgId,
    });
  } catch (error) {
    console.error('Failed to fetch rep dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}

