import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get recent projects with their images and tags
    const projects = await prisma.project.findMany({
      where: { status: 'published' },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        images: {
          include: {
            tags: {
              include: {
                product: true
              }
            }
          }
        },
        designer: true
      }
    });

    // Get featured products
    const products = await prisma.product.findMany({
      where: { isPending: false },
      take: 8,
      orderBy: { createdAt: 'desc' }
    });

    // Get active designers
    const designers = await prisma.user.findMany({
      where: { profileType: 'designer' },
      take: 6,
      orderBy: { followers: 'desc' }
    });

    // Get media posts from subevents (aggregated feed)
    const subEventMedia = await prisma.subEventMedia.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            profileType: true
          }
        },
        subEvent: {
          select: {
            id: true,
            title: true,
            event: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    });

    // Transform data for feed format
    const feedItems: any[] = [];

    // Add subevent media posts as feed items
    subEventMedia.forEach((media) => {
      feedItems.push({
        id: `media-${media.id}`,
        type: media.type === 'video' ? 'video' : 'moodboard',
        size: '1x1',
        title: media.caption || `Post from ${media.subEvent.title}`,
        author: media.user.name,
        image: media.url,
        feedType: 'forYou',
        subType: 'subevent_post',
        eventTitle: media.subEvent.event.title,
        subEventTitle: media.subEvent.title,
        mediaId: media.id,
        subEventId: media.subEvent.id,
        eventId: media.subEvent.event.id,
        tags: media.tags,
        createdAt: media.createdAt
      });
    });

    // Add projects as editorial/moodboard cards
    projects.forEach((project, index) => {
      // Use first project image if available, otherwise use a placeholder
      const projectImage = project.images.length > 0 
        ? project.images[0].url 
        : 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=800&q=80';
      
      feedItems.push({
        id: `project-${project.id}`,
        type: index % 3 === 0 ? 'editorial' : 'moodboard',
        size: index % 3 === 0 ? '2x1' : '1x1',
        title: project.name,
        author: project.designer?.name || 'Designer',
        image: projectImage,
        feedType: 'forYou',
        subType: 'project',
        projectId: project.id,
        createdAt: project.createdAt
      });
    });

    // Add products
    products.forEach((product) => {
      feedItems.push({
        id: `product-${product.id}`,
        type: 'product',
        size: '1x1',
        name: product.name,
        brand: product.brand || 'Brand',
        price: product.price ? `$${product.price}` : 'Price TBD',
        image: product.imageUrl,
        feedType: 'forYou',
        subType: 'product',
        cta: 'Shop Now',
        productId: product.id,
        createdAt: product.createdAt
      });
    });

    // Add designers
    designers.forEach((designer) => {
      feedItems.push({
        id: `designer-${designer.id}`,
        type: 'designer',
        size: '1x1',
        name: designer.name,
        specialty: designer.bio || 'Interior Designer',
        image: designer.profileImage || 'https://randomuser.me/api/portraits/women/44.jpg',
        feedType: 'forYou',
        subType: 'designer',
        cta: 'View Profile',
        designerId: designer.id,
        createdAt: designer.createdAt
      });
    });

    // Sort by creation date (newest first) and then shuffle for variety
    const sortedFeed = feedItems.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Shuffle the feed items for variety while keeping recent items prominent
    const shuffledFeed = sortedFeed.sort(() => Math.random() - 0.3);

    return NextResponse.json({ items: shuffledFeed });

  } catch (error) {
    console.error('Feed API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed data' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 