import { projectPhotoProcessingUrl } from '@/lib/server/protected-project-photo';
export const dynamic = 'force-dynamic';

/**
 * API route to export Instagram carousel
 * POST /api/instagram/export
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { extractQuotes } from '@/lib/instagram/extractQuotes';
import { generateCarouselSlides } from '@/lib/instagram/generateCarouselSlides';
import { generateCaption } from '@/lib/instagram/generateCaption';
import { createZip } from '@/lib/instagram/createZip';
import { z } from 'zod';

const ExportRequestSchema = z.object({
  projectId: z.string().uuid(),
  orderedImageIds: z.array(z.string().uuid()).min(1),
  selectedQuotes: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { projectId, orderedImageIds, selectedQuotes = [] } = ExportRequestSchema.parse(body);

    // Verify project access
    await assertProjectView(userId, projectId);

    // Fetch project data
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        description: true,
        city: true,
        regionState: true,
        projectType: true,
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

    // Reorder images according to orderedImageIds
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

    // Get hero image (first in ordered list, or explicitly set)
    const heroImage = project.post?.heroAssetId
      ? orderedImages.find(img => img.id === project.post.heroAssetId)
      : orderedImages[0];

    // Check for Facebook CDN images before generating slides
    const facebookImages = orderedImages.filter(img => 
      img.url.includes('fbcdn.net') || 
      img.url.includes('facebook.com') ||
      img.url.includes('scontent-')
    );

    if (facebookImages.length > 0) {
      return NextResponse.json(
        { 
          error: `Cannot generate export: ${facebookImages.length} image(s) are on Facebook CDN and cannot be fetched server-side. Please re-upload images to Supabase first (this happens automatically when you open the export modal).`,
          facebookImageCount: facebookImages.length,
        },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

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

    // Generate carousel slides with expandedBlocks for smart quote matching
    let slides: Buffer[];
    try {
      slides = await generateCarouselSlides({
        projectTitle: project.title,
        images: await Promise.all(orderedImages.map(async img => ({
          id: img.id,
          url: await projectPhotoProcessingUrl(img.url, projectId),
          name: img.name,
          room: img.room,
        }))),
        quotes: selectedQuotes.length > 0 ? selectedQuotes.map(text => ({ text })) : undefined,
        heroImageUrl: heroImage?.url ? await projectPhotoProcessingUrl(heroImage.url, projectId) : undefined,
        projectSlug: project.post?.slug || undefined,
        projectId: project.id,
        expandedBlocks: project.post?.expandedBlocks as any,
        products: products.length >= 4 ? products : undefined, // Only pass if ≥4 products
      });
    } catch (slideError: any) {
      console.error('[instagram-export] Error generating slides:', slideError);
      
      // Check if error is related to Facebook CDN or image fetching
      if (slideError.message?.includes('Facebook CDN') || 
          slideError.message?.includes('re-uploaded') ||
          slideError.message?.includes('403') ||
          slideError.message?.includes('Failed to fetch image')) {
        return NextResponse.json(
          { 
            error: 'Failed to fetch images. Some images may still be on Facebook CDN. Please wait for automatic re-upload to complete and refresh the page.',
            details: slideError.message,
          },
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      throw slideError; // Re-throw if it's a different error
    }

    // Generate caption
    let caption = '';
    let hashtags: string[] = [];
    try {
      const captionResult = await generateCaption({
        projectTitle: project.title,
        projectDescription: project.description,
        city: project.city,
        regionState: project.regionState,
        projectType: project.projectType,
        expandedBlocks: project.post?.expandedBlocks as any,
        productTags: project.images.flatMap(img =>
          img.tags.map(tag => ({ product: tag.product }))
        ),
      });
      caption = captionResult.caption;
      hashtags = captionResult.hashtags;
      
      // Format with hashtags on new line
      caption = caption + '\n\n' + hashtags.join(' ');
    } catch (error) {
      console.warn('[instagram-export] Caption generation failed, using fallback:', error);
      // Fallback caption
      caption = `${project.title}\n\n${project.description || 'A design project on Folio.'}\n\nThe complete story, shoppable product details, and behind-the-scenes are now live on Folio → link in bio\n\n#interiordesign #homedesign #design #foliodesign`;
    }

    // Create ZIP
    const zipBuffer = await createZip({
      slides,
      caption,
      projectTitle: project.title,
    });

    // Return ZIP as base64 for dev (or signed URL for production)
    const base64 = zipBuffer.toString('base64');
    const filename = `${project.title.toLowerCase().replace(/\s+/g, '-')}-instagram-export.zip`;

    return NextResponse.json(
      {
        zip: base64,
        filename,
        mimeType: 'application/zip',
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request', issues: error.issues },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (error.message === 'Forbidden' || error.message === 'NotFound') {
      return NextResponse.json(
        { error: error.message },
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.error('[instagram-export] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

