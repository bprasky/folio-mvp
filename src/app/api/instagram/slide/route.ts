/**
 * API route to generate a single Instagram slide at full resolution
 * POST /api/instagram/slide
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { generateSingleSlide } from '@/lib/instagram/generateSingleSlide';
import { z } from 'zod';

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SlideRequestSchema = z.object({
  projectId: z.string().uuid(),
  slideIndex: z.number().int().min(0),
  orderedImageIds: z.array(z.string().uuid()).min(1),
  selectedQuotes: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  // Ensure we always return JSON, even on unexpected errors
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = session.user.id;
    
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('[instagram-slide] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: parseError.message },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Validate request schema
    let validatedData;
    try {
      validatedData = SlideRequestSchema.parse(body);
    } catch (validationError: any) {
      console.error('[instagram-slide] Validation error:', validationError);
      return NextResponse.json(
        { error: 'Invalid request data', issues: validationError.issues || validationError.message },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const { projectId, slideIndex, orderedImageIds, selectedQuotes = [] } = validatedData;

    // Verify project access
    await assertProjectView(userId, projectId);

    // Fetch project data
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        description: true,
        images: {
          where: { id: { in: orderedImageIds } },
          include: {
            tags: {
              include: {
                product: true,
              },
            },
          },
        },
        post: {
          select: {
            expandedBlocks: true,
            heroAssetId: true,
            slug: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Reorder images according to orderedImageIds (maintain the order from the array)
    const orderedImages = orderedImageIds
      .map(id => project.images.find(img => img.id === id))
      .filter(Boolean) as typeof project.images;

    if (orderedImages.length === 0) {
      return NextResponse.json(
        { error: 'No valid images found' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check for Facebook CDN images before generating slide
    const facebookImages = orderedImages.filter(img => 
      img.url.includes('fbcdn.net') || 
      img.url.includes('facebook.com') ||
      img.url.includes('scontent-')
    );

    // For slide generation, we'll still try but catch the error and return a helpful message
    // (The generateSingleSlide function will create fallback slides for failed images)

    // Extract unique products from image tags
    const productMap = new Map<string, { id: string; name: string; imageUrl?: string | null; brand?: string | null }>();
    orderedImages.forEach(img => {
      img.tags.forEach(tag => {
        if (tag.product && !productMap.has(tag.product.id)) {
          productMap.set(tag.product.id, {
            id: tag.product.id,
            name: tag.product.name,
            imageUrl: tag.product.imageUrl,
            brand: tag.product.brand,
          });
        }
      });
    });
    const products = Array.from(productMap.values());

    // Generate single slide with error handling
    let slideBuffer: Buffer;
    try {
      slideBuffer = await generateSingleSlide({
        projectTitle: project.title,
        images: orderedImages.map(img => ({
          id: img.id,
          url: img.url,
          name: img.name,
          room: img.room,
        })),
        slideIndex,
        quotes: selectedQuotes.length > 0 ? selectedQuotes.map(text => ({ text })) : undefined,
        heroImageUrl: project.post?.heroAssetId
          ? orderedImages.find(img => img.id === project.post.heroAssetId)?.url
          : orderedImages[0]?.url,
        projectSlug: project.post?.slug || undefined,
        projectId: project.id,
        expandedBlocks: project.post?.expandedBlocks as any,
        products: products.length >= 4 ? products : undefined, // Only pass if ≥4 products
      });
    } catch (slideError: any) {
      console.error('[instagram-slide] Slide generation error:', slideError);
      return NextResponse.json(
        { 
          error: `Failed to generate slide: ${slideError.message || 'Unknown error'}`,
          slideIndex,
          details: process.env.NODE_ENV === 'development' ? slideError.stack : undefined
        },
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Return as base64 for client download
    const base64 = slideBuffer.toString('base64');
    return NextResponse.json(
      { image: `data:image/jpeg;base64,${base64}` },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('[instagram-slide] Unhandled error:', error);
    
    // Ensure we always return JSON, never HTML
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request', issues: error.issues },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const errorMessage = error?.message || 'Failed to generate slide';
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? { 
          stack: error?.stack?.substring(0, 500), // Limit stack trace length
          name: error?.name,
          details: error?.details 
        }
      : undefined;
    
    return NextResponse.json(
      { 
        error: errorMessage,
        ...(errorDetails || {})
      },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

