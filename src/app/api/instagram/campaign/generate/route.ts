import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { selectCampaignContent, CampaignPreset } from '@/lib/instagram/campaign/selectCampaignContent';
import { generateLaunchCard } from '@/lib/instagram/campaign/generateLaunchCard';
import { generateRoomSpotlight } from '@/lib/instagram/campaign/generateRoomSpotlight';
import { generateCaption, generateCaptionsFile } from '@/lib/instagram/campaign/generateCaptions';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for campaign generation

interface GenerateCampaignRequest {
  projectId: string;
  preset: CampaignPreset;
  formats: ('square' | 'portrait' | 'story')[];
  customSelections?: {
    roomNames?: string[];
    productIds?: string[];
    quoteIndices?: number[];
    includeDetails?: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body: GenerateCampaignRequest = await request.json();
    const { projectId, preset, formats, customSelections } = body;

    if (!projectId || !preset || !formats || formats.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, preset, formats' },
        { status: 400 }
      );
    }

    // Fetch project data
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        designer: {
          select: {
            name: true,
            studio: true,
            instagram: true,
          },
        },
        images: {
          orderBy: { displayOrder: 'asc' },
          include: {
            tags: {
              include: {
                product: {
                  include: {
                    vendor: true,
                  },
                },
              },
            },
          },
        },
        post: {
          select: {
            slug: true,
            excerpt: true,
          },
        },
      },
    });

    if (!project || !project.post) {
      return NextResponse.json(
        { error: 'Project not found or not published' },
        { status: 404 }
      );
    }

    // Select campaign content
    const contentSelection = await selectCampaignContent(projectId, preset);

    // Apply custom selections if provided
    if (customSelections) {
      if (customSelections.roomNames) {
        contentSelection.rooms.forEach((room) => {
          room.suggested = customSelections.roomNames!.includes(room.name);
        });
      }
      if (customSelections.productIds) {
        contentSelection.products.forEach((product) => {
          product.suggested = customSelections.productIds!.includes(product.id);
        });
      }
      if (customSelections.quoteIndices !== undefined) {
        contentSelection.quotes.forEach((quote, idx) => {
          quote.suggested = customSelections.quoteIndices!.includes(idx);
        });
      }
      if (customSelections.includeDetails !== undefined) {
        if (!customSelections.includeDetails) {
          contentSelection.details = [];
        }
      }
    }

    // Recalculate total posts
    const selectedRooms = contentSelection.rooms.filter((r) => r.suggested);
    const selectedProducts = contentSelection.products.filter((p) => p.suggested);
    const selectedQuotes = contentSelection.quotes.filter((q) => q.suggested);
    const totalPosts =
      2 + // launch + closer
      selectedRooms.length +
      selectedProducts.length +
      selectedQuotes.length +
      contentSelection.details.length;

    // Prepare project metadata for captions
    const projectData = {
      title: project.title,
      description: project.description || undefined,
      city: project.city || undefined,
      regionState: project.regionState || undefined,
      projectType: project.projectType || undefined,
      designerName: project.designer?.studio || project.designer?.name || 'Designer',
      designerInstagram: project.designer?.instagram || undefined,
      slug: project.post.slug,
    };

    // Generate all campaign assets
    const zip = new JSZip();
    const captionData: Array<{
      postNumber: number;
      postType: string;
      caption: string;
      hashtags: string[];
    }> = [];

    let postNumber = 1;

    // 1. Generate Launch Card
    const launchFolder = zip.folder('01-launch')!;
    for (const format of formats) {
      const launchCard = await generateLaunchCard({
        projectTitle: project.title,
        designerName: projectData.designerName,
        heroImageUrl: project.images[0].url,
        projectSlug: project.post.slug,
        format,
        seriesInfo: { current: postNumber, total: totalPosts },
      });
      launchFolder.file(`launch-${format}.jpg`, launchCard);
    }

    const launchCaption = generateCaption({
      postType: 'launch',
      project: projectData,
    });
    captionData.push({
      postNumber,
      postType: 'launch',
      ...launchCaption,
    });
    postNumber++;

    // 2. Generate Room Spotlights
    for (const room of selectedRooms) {
      const roomFolder = zip.folder(
        `${String(postNumber).padStart(2, '0')}-${room.name.toLowerCase().replace(/\s+/g, '-')}`
      )!;

      const roomImages = project.images.filter((img) => room.imageIds.includes(img.id));

      for (const format of formats) {
        const spotlightSlides = await generateRoomSpotlight({
          roomName: room.name,
          projectTitle: project.title,
          designerName: projectData.designerName,
          projectSlug: project.post.slug,
          imageUrls: roomImages.map((img) => img.url),
          format,
          seriesInfo: { current: postNumber, total: totalPosts },
        });

        spotlightSlides.forEach((slide, idx) => {
          roomFolder.file(`slide-${idx + 1}-${format}.jpg`, slide);
        });
      }

      const roomCaption = generateCaption({
        postType: 'room_spotlight',
        project: projectData,
        context: { roomName: room.name },
      });
      captionData.push({
        postNumber,
        postType: 'room_spotlight',
        ...roomCaption,
      });
      postNumber++;
    }

    // 3. Generate Product Features (simplified - single image for now)
    for (const product of selectedProducts) {
      const productFolder = zip.folder(
        `${String(postNumber).padStart(2, '0')}-product-${product.name.toLowerCase().replace(/\s+/g, '-').substring(0, 20)}`
      )!;

      const productImage = project.images.find((img) => img.id === product.imageId);
      if (productImage) {
        // For now, use launch card generation with product info
        // In Phase 2, create dedicated product card template
        for (const format of formats) {
          const productCard = await generateLaunchCard({
            projectTitle: `${product.name} by ${product.brand}`,
            designerName: `Featured in ${project.title}`,
            heroImageUrl: productImage.url,
            projectSlug: project.post.slug,
            format,
            seriesInfo: { current: postNumber, total: totalPosts },
          });
          productFolder.file(`product-${format}.jpg`, productCard);
        }
      }

      const productCaption = generateCaption({
        postType: 'product_feature',
        project: projectData,
        context: {
          productName: product.name,
          productBrand: product.brand,
        },
      });
      captionData.push({
        postNumber,
        postType: 'product_feature',
        ...productCaption,
      });
      postNumber++;
    }

    // 4. Generate Quote Cards (Phase 2 - skip for now, just captions)
    for (const quote of selectedQuotes) {
      const quoteCaption = generateCaption({
        postType: 'quote',
        project: projectData,
        context: {
          quoteText: quote.text,
        },
      });
      captionData.push({
        postNumber,
        postType: 'quote',
        ...quoteCaption,
      });
      postNumber++;
    }

    // 5. Generate Closer Card
    const closerFolder = zip.folder(`${String(postNumber).padStart(2, '0')}-closer`)!;
    for (const format of formats) {
      const closerCard = await generateLaunchCard({
        projectTitle: project.title,
        designerName: 'Explore the full project on Folio',
        heroImageUrl: project.images[Math.min(1, project.images.length - 1)].url,
        projectSlug: project.post.slug,
        format,
        seriesInfo: { current: postNumber, total: totalPosts },
      });
      closerFolder.file(`closer-${format}.jpg`, closerCard);
    }

    const closerCaption = generateCaption({
      postType: 'closer',
      project: projectData,
    });
    captionData.push({
      postNumber,
      postType: 'closer',
      ...closerCaption,
    });

    // Add captions.txt file
    const captionsContent = generateCaptionsFile(captionData);
    zip.file('captions.txt', captionsContent);

    // Add README.txt
    const readmeContent = `Instagram Campaign for ${project.title}
====================================

Total Posts: ${totalPosts}
Suggested Pacing: 2 posts/week ≈ ${Math.ceil(totalPosts / 2)} weeks

FOLDER STRUCTURE:
- Each folder represents one Instagram post
- Inside each folder, you'll find the image(s) in different formats:
  - square (1080×1080) - Standard feed posts
  - portrait (1080×1350) - Carousel posts
  - story (1080×1920) - Instagram Stories

CAPTIONS:
- See captions.txt for ready-to-copy captions and hashtags
- Each caption corresponds to the numbered folder

POSTING TIPS:
- Mix these posts with other projects for feed variety
- Post during your audience's peak engagement times
- Tag vendors and collaborators when posting product features
- Use Stories to tease upcoming posts
- Engage with comments within the first hour

Questions? Contact support@folio.ad

Generated: ${new Date().toISOString().split('T')[0]}
`;
    zip.file('README.txt', readmeContent);

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const base64Zip = zipBuffer.toString('base64');

    // Return download
    return new NextResponse(base64Zip, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${project.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-instagram-campaign.zip"`,
      },
    });
  } catch (error: any) {
    console.error('Campaign generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate campaign' },
      { status: 500 }
    );
  }
}
