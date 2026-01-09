import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { FeatureType, FeatureBadge, FeatureStatus, Prisma } from '@prisma/client';
import { canCreateFeatureFromEvent } from '@/lib/feature-content/canCreateFeatureFromEvent';
import { checkProjectForFeatureEligibility } from '@/lib/feature-content/triggerFeatureInvitation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Schema for creating a Feature
const createFeatureSchema = z.object({
  type: z.nativeEnum(FeatureType),
  sourceEventId: z.string().optional(),
  sourceProjectId: z.string().optional(),
  collaborationStoryId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().optional(),
  excerpt: z.string().optional(),
  heroImageUrl: z.string().url().optional(),
  content: z.any().optional(),
});

// Schema for list filters
const listFiltersSchema = z.object({
  type: z.nativeEnum(FeatureType).optional(),
  status: z.nativeEnum(FeatureStatus).optional(),
  authorId: z.string().optional(),
  badge: z.nativeEnum(FeatureBadge).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  includeUnpublished: z.coerce.boolean().default(false),
});

/**
 * Generates a URL-safe slug from a title.
 */
function generateSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

  const timestamp = Date.now().toString(36);
  return `${baseSlug}-${timestamp}`;
}

/**
 * GET /api/features
 * List features with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);

    // Parse and validate filters
    const filters = listFiltersSchema.parse({
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      authorId: searchParams.get('authorId') || undefined,
      badge: searchParams.get('badge') || undefined,
      limit: searchParams.get('limit') || 20,
      offset: searchParams.get('offset') || 0,
      includeUnpublished: searchParams.get('includeUnpublished') || false,
    });

    // Build where clause
    const where: Prisma.FeatureWhereInput = {};

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    } else if (!filters.includeUnpublished) {
      // By default, only show published/above_fold features
      where.status = { in: ['PUBLISHED', 'ABOVE_FOLD'] };
    }

    if (filters.authorId) {
      where.primaryAuthorId = filters.authorId;
    }

    if (filters.badge) {
      where.badgeType = filters.badge;
    }

    // Only allow viewing unpublished features if user is author or admin
    if (filters.includeUnpublished && session?.user?.id) {
      const isAdmin = session.user.role === 'ADMIN';
      if (!isAdmin) {
        // Non-admins can only see their own unpublished features
        where.OR = [
          { status: { in: ['PUBLISHED', 'ABOVE_FOLD'] } },
          { primaryAuthorId: session.user.id },
        ];
      }
    }

    const [features, total] = await Promise.all([
      prisma.feature.findMany({
        where,
        include: {
          primaryAuthor: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          sourceEvent: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
            },
          },
          sourceProject: {
            select: {
              id: true,
              title: true,
            },
          },
          _count: {
            select: {
              vendorContributions: true,
            },
          },
        },
        orderBy: [
          { aboveFoldAt: 'desc' },
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        take: filters.limit,
        skip: filters.offset,
      }),
      prisma.feature.count({ where }),
    ]);

    return NextResponse.json({
      features,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + features.length < total,
      },
    });
  } catch (error) {
    console.error('GET /api/features error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/features
 * Create a new Feature (checks source legitimacy)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = createFeatureSchema.parse(body);

    const userId = session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    // Validate source legitimacy based on type
    switch (data.type) {
      case FeatureType.FOLIO_FEATURE:
        // Only admins can create Folio Features
        if (!isAdmin) {
          return NextResponse.json(
            { error: 'Only administrators can create Folio Features' },
            { status: 403 }
          );
        }
        break;

      case FeatureType.EVENT_FEATURE:
        if (!data.sourceEventId) {
          return NextResponse.json(
            { error: 'Event Feature requires a source event' },
            { status: 400 }
          );
        }

        // Check if user can create feature from this event
        const eventEligibility = await canCreateFeatureFromEvent(
          data.sourceEventId,
          userId
        );

        if (!eventEligibility.eligible) {
          return NextResponse.json(
            { error: eventEligibility.reason },
            { status: 403 }
          );
        }
        break;

      case FeatureType.COLLABORATION:
        if (!data.collaborationStoryId) {
          return NextResponse.json(
            { error: 'Collaboration Feature requires a collaboration story ID' },
            { status: 400 }
          );
        }
        // TODO: Validate collaboration story exists and user is author
        // For now, allow creation by any designer
        break;

      case FeatureType.PRODUCT_SPOTLIGHT:
        if (!data.sourceProjectId) {
          return NextResponse.json(
            { error: 'Product Spotlight requires a source project' },
            { status: 400 }
          );
        }

        // Check project eligibility (engagement thresholds)
        const projectEligibility = await checkProjectForFeatureEligibility(
          data.sourceProjectId
        );

        if (!projectEligibility.eligible) {
          return NextResponse.json(
            { error: projectEligibility.reason },
            { status: 403 }
          );
        }

        // Verify user is the project designer
        if (projectEligibility.designerId !== userId && !isAdmin) {
          return NextResponse.json(
            { error: 'Only the project designer can create a Product Spotlight' },
            { status: 403 }
          );
        }
        break;
    }

    // Determine badge type based on feature type
    const badgeType = data.type as unknown as FeatureBadge;

    // Create the feature
    const feature = await prisma.feature.create({
      data: {
        slug: generateSlug(data.title),
        type: data.type,
        sourceEventId: data.sourceEventId,
        sourceProjectId: data.sourceProjectId,
        collaborationStoryId: data.collaborationStoryId,
        primaryAuthorId: userId,
        title: data.title,
        subtitle: data.subtitle,
        excerpt: data.excerpt,
        heroImageUrl: data.heroImageUrl,
        content: data.content,
        status: FeatureStatus.DRAFT,
        badgeType,
      },
      include: {
        primaryAuthor: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    return NextResponse.json(feature, { status: 201 });
  } catch (error) {
    console.error('POST /api/features error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
