export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { assertVendorTier, generateCollaborationSlug } from '@/lib/collaboration/auth';

// Schema for creating a new collaboration story
const CreateCollaborationStorySchema = z.object({
  designerUserId: z.string().uuid('Invalid designer ID'),
  taggedProjectId: z.string().uuid().optional(),
  taggedProductIds: z.array(z.string().uuid()).optional(),
  message: z.string().max(500).optional(), // Optional invitation message
});

// Schema for listing collaboration stories
const ListQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/collaboration/stories
 * List collaboration stories for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const query = ListQuerySchema.parse({
      status: url.searchParams.get('status') || undefined,
      limit: url.searchParams.get('limit') || 20,
      offset: url.searchParams.get('offset') || 0,
    });

    // Get user's vendor org if any
    const vendorMembership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        organization: { type: 'VENDOR' },
      },
      select: { organizationId: true },
    });

    // Build where clause - show stories where user is designer or part of vendor org
    const whereClause: any = {
      OR: [
        { designerUserId: session.user.id },
        ...(vendorMembership ? [{ vendorOrgId: vendorMembership.organizationId }] : []),
      ],
    };

    if (query.status) {
      whereClause.status = query.status;
    }

    const [stories, total] = await Promise.all([
      prisma.collaborationStory.findMany({
        where: whereClause,
        include: {
          vendorOrg: {
            select: { id: true, name: true, logo: true },
          },
          designer: {
            select: { id: true, name: true, profileImage: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.collaborationStory.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      stories,
      total,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    console.error('[collaboration/stories] GET failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collaboration stories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/collaboration/stories
 * Create a new collaboration story (vendor Pro+ only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Assert vendor Pro+ tier
    let vendorContext;
    try {
      vendorContext = await assertVendorTier(session.user.id);
    } catch (error: any) {
      if (error.message.includes('NotVendor')) {
        return NextResponse.json(
          { error: 'Only vendor organizations can create collaboration stories' },
          { status: 403 }
        );
      }
      if (error.message.includes('InsufficientTier')) {
        return NextResponse.json(
          { error: 'Pro+ subscription required to create collaboration stories' },
          { status: 403 }
        );
      }
      throw error;
    }

    // Parse and validate body
    const body = await request.json();
    const input = CreateCollaborationStorySchema.parse(body);

    // Verify designer exists and is a designer
    const designer = await prisma.user.findUnique({
      where: { id: input.designerUserId },
      select: { id: true, name: true, role: true },
    });

    if (!designer) {
      return NextResponse.json(
        { error: 'Designer not found' },
        { status: 404 }
      );
    }

    if (designer.role !== 'DESIGNER') {
      return NextResponse.json(
        { error: 'Selected user is not a designer' },
        { status: 400 }
      );
    }

    // Check for existing pending invitation
    const existingInvite = await prisma.collaborationStory.findFirst({
      where: {
        vendorOrgId: vendorContext.orgId,
        designerUserId: input.designerUserId,
        status: 'INVITED',
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: 'Pending invitation already exists for this designer' },
        { status: 409 }
      );
    }

    // Generate slug
    const slug = generateCollaborationSlug(vendorContext.orgName, designer.name);

    // Create the collaboration story
    const story = await prisma.collaborationStory.create({
      data: {
        slug,
        vendorOrgId: vendorContext.orgId,
        designerUserId: input.designerUserId,
        status: 'INVITED',
        taggedProjectId: input.taggedProjectId,
        taggedProductIds: input.taggedProductIds || [],
        invitedAt: new Date(),
      },
      include: {
        vendorOrg: {
          select: { id: true, name: true, logo: true },
        },
        designer: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });

    // TODO: Send notification to designer
    // await sendCollaborationInviteNotification(story.id, input.message);

    console.log('[collaboration/stories] Created:', {
      storyId: story.id,
      vendorOrgId: vendorContext.orgId,
      designerUserId: input.designerUserId,
    });

    return NextResponse.json(story, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[collaboration/stories] POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to create collaboration story' },
      { status: 500 }
    );
  }
}
