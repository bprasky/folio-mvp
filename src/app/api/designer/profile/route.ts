import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getMyProjects } from '@/server/queries/getMyProjects';
import { 
  getTaggedProductsForDesigner, 
  getProjectTagCounts 
} from '@/server/queries/getDesignerProjectsWithProducts';

/**
 * DESIGNER PROFILE DATA MODEL
 * 
 * - Projects shown here are the same "published projects" used in the global/project feed.
 * - A project is associated to a designer via Project.designerId -> User.id.
 * - Projects are considered "published" if isPublic: true OR publishedAt: { not: null } OR status: 'published'.
 * - "Known For Products" is derived from tagged products across this designer's published projects.
 * - ProductTag links ProjectImage -> Product, and ProjectImage belongs to Project.
 */

// Force dynamic - no caching for authenticated profile data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET - Fetch current designer's profile with projects
 * Uses comprehensive ownership query to find all user's projects
 * 
 * LAST ERROR SEEN: (will be logged here if any errors occur)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] /api/designer/profile – hit');

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.warn('[API] /api/designer/profile – no session/user ID');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    console.log('[API] /api/designer/profile – userId:', userId);

    // Fetch designer profile data
    console.log('[API] /api/designer/profile – fetching designer profile...');
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
      console.error('[API] /api/designer/profile – designer not found for userId:', userId);
      return NextResponse.json({ error: 'Designer not found' }, { status: 404 });
    }

    console.log('[API] /api/designer/profile – designer found:', designer.id);

    // Fetch projects using comprehensive ownership query
    // Profile view: show only published projects (portfolio showcase)
    console.log('[API] /api/designer/profile – fetching published projects...');
    const projects = await getMyProjects('published');
    console.log('[API] /api/designer/profile – found', projects.length, 'published projects');

    // Fetch product tags and products for metrics (across all projects, including drafts for analytics)
    console.log('[API] /api/designer/profile – fetching all projects for analytics...');
    const allProjects = await getMyProjects('all');
    const allProjectIds = allProjects.map(p => p.id);
    console.log('[API] /api/designer/profile – found', allProjectIds.length, 'total project IDs');
    
    // Get all product tags across designer's projects (including drafts for analytics metrics)
    console.log('[API] /api/designer/profile – fetching product tags...');
    const productTags = allProjectIds.length > 0
      ? await prisma.productTag.findMany({
          where: {
            image: {
              projectId: { in: allProjectIds }
            }
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
                brand: true,
              }
            },
            image: {
              select: {
                projectId: true,
              }
            }
          }
        })
      : [];
    console.log('[API] /api/designer/profile – found', productTags.length, 'product tags');

    // Calculate metrics (across all projects including drafts for internal analytics)
    const totalTaggedProducts = new Set(productTags.map(tag => tag.productId)).size;
    
    // Calculate influence value (sum of product prices)
    const influenceValue = productTags.reduce((sum, tag) => {
      return sum + (tag.product.price || 0);
    }, 0);

    // Get top 10 most-tagged products from PUBLISHED projects only (for public "Known For Products")
    console.log('[API] /api/designer/profile – fetching tagged products for designer...');
    let topProducts: any[] = [];
    try {
      topProducts = await getTaggedProductsForDesigner(userId);
      console.log('[API] /api/designer/profile – found', topProducts.length, 'top products');
    } catch (err: any) {
      console.error('[API] /api/designer/profile – ERROR in getTaggedProductsForDesigner:', err?.message, err?.stack);
      // Don't fail the whole request if this fails, just use empty array
      topProducts = [];
    }

    // Get project tag counts for display (only for published projects)
    console.log('[API] /api/designer/profile – fetching project tag counts...');
    const publishedProjectIds = projects.map(p => p.id);
    let projectTagCounts = new Map<string, number>();
    try {
      projectTagCounts = publishedProjectIds.length > 0
        ? await getProjectTagCounts(publishedProjectIds)
        : new Map<string, number>();
      console.log('[API] /api/designer/profile – tag counts calculated for', projectTagCounts.size, 'projects');
    } catch (err: any) {
      console.error('[API] /api/designer/profile – ERROR in getProjectTagCounts:', err?.message, err?.stack);
      // Don't fail the whole request if this fails, just use empty map
      projectTagCounts = new Map<string, number>();
    }

    // Transform projects for frontend with tag counts and city
    console.log('[API] /api/designer/profile – transforming projects...');
    const featuredProjects = projects.map(project => ({
      id: project.id,
      title: project.title,
      // NOTE: Project model does NOT have a slug field (only ProjectPost has slug)
      // Use null for slug since we use project.id for routing
      slug: null,
      image: project.images[0]?.url || '/images/product-placeholder.jpg',
      link: `/project/${project.id}`,
      category: project.category || 'Uncategorized',
      size: 'medium', // Default size for grid
      year: new Date(project.createdAt).getFullYear().toString(),
      description: project.description,
      isPublic: project.isPublic,
      publishedAt: project.publishedAt,
      status: project.status,
      city: project.city || null,
      tagCount: projectTagCounts.get(project.id) || 0,
    }));

    // Get style descriptors from specialties or use defaults
    const styleDescriptors = designer.specialties && designer.specialties.length > 0
      ? designer.specialties
      : [];

    // Placeholder for Atelier orders and vendor partnerships
    const atelierOrders = 0; // TODO: Implement when Atelier order system is ready
    const vendorPartnerships = 0; // TODO: Count vendor relationships when implemented

    console.log('[API] /api/designer/profile – preparing response...');
    const response = {
      ...designer,
      featuredProjects,
      // Calculate project count
      projects: projects.length.toString(),
      // Metrics
      metrics: {
        totalTaggedProducts,
        influenceValue,
        atelierOrders,
        vendorPartnerships,
      },
      // Top products
      topProducts,
      // Style descriptors
      styleDescriptors,
    };

    console.log('[API] /api/designer/profile – SUCCESS:', {
      designerId: designer.id,
      projectsCount: featuredProjects.length,
      topProductsCount: topProducts.length,
      metrics: response.metrics,
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    console.error('[API] /api/designer/profile – ERROR:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
    });
    
    // LAST ERROR SEEN: (update this comment with the actual error message)
    // Error details logged above
    
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to fetch profile',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
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

