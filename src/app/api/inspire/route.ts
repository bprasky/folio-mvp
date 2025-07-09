import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 12;
    const offset = (page - 1) * limit;

    // Get project images with their project and designer info
    const projectImages = await prisma.projectImage.findMany({
      skip: offset,
      take: limit,
      include: {
        project: {
          include: {
            designer: true
          }
        },
        tags: {
          include: {
            product: true
          }
        }
      },
      where: {
        project: {
          status: 'published'
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // If we don't have enough project images, also get some projects without images
    let additionalPosts: any[] = [];
    if (projectImages.length < limit) {
      const projectsWithoutImages = await prisma.project.findMany({
        where: {
          status: 'published',
          images: {
            none: {}
          }
        },
        include: {
          designer: true
        },
        take: limit - projectImages.length,
        orderBy: { createdAt: 'desc' }
      });

      additionalPosts = projectsWithoutImages.map((project, index) => {
        const types = ['regular', 'featured', 'boosted', 'viral'];
        const type = types[index % types.length];
        const aspectRatios = [1.0, 1.2, 0.8, 1.5, 0.9, 1.6];
        const aspectRatio = aspectRatios[index % aspectRatios.length];

        return {
          id: `project-${project.id}`,
          imageUrl: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=800&q=80',
          title: project.name,
          author: project.designer?.name || 'Designer',
          authorImage: project.designer?.profileImage || 'https://randomuser.me/api/portraits/women/44.jpg',
          likes: Math.floor(Math.random() * 5000) + 100,
          saves: Math.floor(Math.random() * 1000) + 50,
          type,
          aspectRatio,
          projectLink: `/project/${project.id}`,
          designerLink: `/designer/profile?user=${project.designerId}`,
          productLink: undefined
        };
      });
    }

    // Transform to inspire feed format
    const inspirePosts = projectImages.map((image, index) => {
      // Vary the post types for visual interest
      const types = ['regular', 'featured', 'boosted', 'viral'];
      const type = types[index % types.length];
      
      // Vary aspect ratios
      const aspectRatios = [1.0, 1.2, 0.8, 1.5, 0.9, 1.6];
      const aspectRatio = aspectRatios[index % aspectRatios.length];

      return {
        id: `image-${image.id}`,
        imageUrl: image.url,
        title: image.name || image.project.name,
        author: image.project.designer?.name || 'Designer',
        authorImage: image.project.designer?.profileImage || 'https://randomuser.me/api/portraits/women/44.jpg',
        likes: Math.floor(Math.random() * 5000) + 100, // Simulate likes
        saves: Math.floor(Math.random() * 1000) + 50,  // Simulate saves
        type,
        aspectRatio,
        projectLink: `/project/${image.project.id}`,
        designerLink: `/designer/profile?user=${image.project.designerId}`,
        // Add product links if there are tagged products
        productLink: image.tags.length > 0 ? `/product/${image.tags[0].product?.id}` : undefined
      };
    });

    return NextResponse.json({ 
      posts: [...inspirePosts, ...additionalPosts],
      hasMore: (projectImages.length + additionalPosts.length) === limit // Simple pagination check
    });

  } catch (error) {
    console.error('Inspire API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inspire data' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 