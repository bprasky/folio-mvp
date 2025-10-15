import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getMyProjects } from '@/server/queries/getMyProjects';

// Force dynamic - no caching for authenticated profile data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET - Fetch current designer's profile with projects
 * Uses comprehensive ownership query to find all user's projects
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch designer profile data
    const designer = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        profileImage: true,
        location: true,
        title: true,
        phone: true,
        studio: true,
        website: true,
        instagram: true,
        linkedin: true,
        specialties: true,
        followers: true,
        following: true,
        views: true,
        createdAt: true,
      },
    });

    if (!designer) {
      return NextResponse.json({ error: 'Designer not found' }, { status: 404 });
    }

    // Fetch projects using comprehensive ownership query
    // Profile view: only show published/completed projects (portfolio showcase)
    const projects = await getMyProjects('published');

    // Transform projects for frontend
    const featuredProjects = projects.map(project => ({
      id: project.id,
      title: project.title,
      slug: project.slug,
      image: project.images[0]?.url || '/images/product-placeholder.jpg',
      link: `/project/${project.id}`,
      category: project.category || 'Uncategorized',
      size: 'medium', // Default size for grid
      year: new Date(project.createdAt).getFullYear().toString(),
      description: project.description,
      isPublic: project.isPublic,
      publishedAt: project.publishedAt,
      status: project.status,
    }));

    return NextResponse.json({
      ...designer,
      featuredProjects,
      // Calculate project count
      projects: projects.length.toString(),
    });

  } catch (error) {
    console.error('Error fetching designer profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update current designer's profile
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    // Whitelist allowed fields (prevent updating sensitive fields like passwordHash, role, etc.)
    const allowedFields = [
      'name',
      'bio',
      'profileImage',
      'location',
      'title',
      'phone',
      'studio',
      'website',
      'instagram',
      'linkedin',
      'specialties',
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    // Update designer profile
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({ 
      ok: true, 
      designer: {
        id: updated.id,
        name: updated.name,
        bio: updated.bio,
        profileImage: updated.profileImage,
        location: updated.location,
        title: updated.title,
        phone: updated.phone,
        studio: updated.studio,
        website: updated.website,
        instagram: updated.instagram,
      }
    });

  } catch (error) {
    console.error('Error updating designer profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

