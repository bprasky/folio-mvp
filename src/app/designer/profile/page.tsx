import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { PUBLISHED_PROJECT_FILTER } from '@/server/queries/filters';
import ProfileClient from './ProfileClient';
import type { ProfilePageData, ProfileProject, ProfileProduct, ProfileTeamMember, ProfileCollaboration } from './types';

export const dynamic = 'force-dynamic';

export default async function DesignerProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // Fetch user (without profileInterview — table may not exist yet)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      title: true,
      location: true,
      bio: true,
      profileImage: true,
      specialties: true,
      website: true,
      instagram: true,
      linkedin: true,
      organizationUsers: {
        where: { isActive: true, showOnProfile: true },
        take: 1,
        select: {
          organization: {
            select: {
              id: true,
              name: true,
              teamMembers: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                  headshotUrl: true,
                  linkedUser: {
                    select: {
                      id: true,
                      name: true,
                      profileImage: true,
                    },
                  },
                },
                orderBy: { displayOrder: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    redirect('/login');
  }

  // Get organization and team members
  const orgUser = user.organizationUsers[0] ?? null;
  const organization = orgUser?.organization ? { name: orgUser.organization.name } : null;
  const teamMembers: ProfileTeamMember[] = (orgUser?.organization?.teamMembers ?? []).map(m => ({
    id: m.id,
    name: m.linkedUser?.name || m.name,
    role: m.role,
    headshotUrl: m.headshotUrl,
    profileImage: m.linkedUser?.profileImage || null,
  }));

  // Fetch published projects with cover images and post titles
  const rawProjects = await prisma.project.findMany({
    where: {
      AND: [
        { OR: [{ designerId: userId }, { ownerId: userId }] },
        PUBLISHED_PROJECT_FILTER,
      ],
    },
    orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      city: true,
      regionState: true,
      projectType: true,
      createdAt: true,
      views: true,
      saves: true,
      images: {
        take: 1,
        orderBy: { displayOrder: 'asc' },
        select: { url: true },
      },
      post: {
        select: { title: true },
      },
    },
  });

  const projectIds = rawProjects.map(p => p.id);

  // Fetch products: all product tags across published projects, deduplicated
  const allProductTags = projectIds.length > 0
    ? await prisma.productTag.findMany({
        where: {
          image: { projectId: { in: projectIds } },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              price: true,
              imageUrl: true,
              category: true,
            },
          },
          image: {
            select: { projectId: true },
          },
        },
      })
    : [];

  // Count unique products per project (for product count badges)
  const projectProductCounts = new Map<string, Set<string>>();
  allProductTags.forEach(tag => {
    const projId = tag.image.projectId;
    if (!projectProductCounts.has(projId)) {
      projectProductCounts.set(projId, new Set());
    }
    projectProductCounts.get(projId)!.add(tag.productId);
  });

  const projects: ProfileProject[] = rawProjects.map(p => ({
    id: p.id,
    title: p.post?.title || p.title || 'Untitled Project',
    imageUrl: p.images[0]?.url || null,
    location: [p.city, p.regionState].filter(Boolean).join(', ') || null,
    type: p.projectType !== 'UNSPECIFIED' ? formatProjectType(p.projectType) : null,
    year: p.createdAt ? new Date(p.createdAt).getFullYear().toString() : null,
    productCount: projectProductCounts.get(p.id)?.size || 0,
    views: p.views,
    saves: p.saves,
  }));

  // Total project count
  const projectCount = projects.length;

  // Deduplicate products and count projects
  const productMap = new Map<
    string,
    {
      product: (typeof allProductTags)[0]['product'];
      projectIds: Set<string>;
    }
  >();
  allProductTags.forEach(tag => {
    const existing = productMap.get(tag.productId);
    if (existing) {
      existing.projectIds.add(tag.image.projectId);
    } else {
      productMap.set(tag.productId, {
        product: tag.product,
        projectIds: new Set([tag.image.projectId]),
      });
    }
  });

  const products: ProfileProduct[] = Array.from(productMap.values())
    .map(item => ({
      id: item.product.id,
      name: item.product.name,
      vendor: item.product.brand || 'Unknown Vendor',
      imageUrl: item.product.imageUrl,
      price: item.product.price,
      category: item.product.category,
      projectCount: item.projectIds.size,
    }))
    .sort((a, b) => b.projectCount - a.projectCount);

  const productCount = products.length;

  // Build collaborations from most-used vendors
  const vendorCounts = new Map<string, number>();
  allProductTags.forEach(tag => {
    const vendor = tag.product.brand;
    if (vendor) {
      vendorCounts.set(vendor, (vendorCounts.get(vendor) || 0) + 1);
    }
  });

  const collaborations: ProfileCollaboration[] = Array.from(vendorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .filter(([, count]) => count >= 2)
    .map(([vendor, count]) => ({
      vendor,
      note: `${count} product${count !== 1 ? 's' : ''} specified across your projects`,
      productCount: count,
    }));

  // Attempt to load profileInterview — table may not exist yet (P2021)
  let profileInterview: ProfilePageData['profileInterview'] = null;
  try {
    const interview = await prisma.profileInterview.findUnique({
      where: { userId },
      select: {
        generatedBio: true,
        shortBio: true,
        pullQuotes: true,
        philosophyStatement: true,
        processDescription: true,
      },
    });
    if (interview) {
      let pullQuotes: string[] | null = null;
      if (interview.pullQuotes && Array.isArray(interview.pullQuotes)) {
        pullQuotes = (interview.pullQuotes as unknown[]).filter(
          (q): q is string => typeof q === 'string'
        );
      }
      profileInterview = {
        generatedBio: interview.generatedBio,
        shortBio: interview.shortBio,
        pullQuotes,
        philosophyStatement: interview.philosophyStatement,
        processDescription: interview.processDescription,
      };
    }
  } catch {
    // Table doesn't exist yet — silently fall back to null
  }

  const pageData: ProfilePageData = {
    user: {
      id: user.id,
      name: user.name,
      title: user.title,
      location: user.location,
      bio: user.bio,
      profileImage: user.profileImage,
      specialties: user.specialties || [],
      website: user.website,
      instagram: user.instagram,
      linkedin: user.linkedin,
    },
    organization,
    profileInterview,
    projects,
    products,
    teamMembers,
    collaborations,
    projectCount,
    productCount,
    isOwner: true,
  };

  return <ProfileClient data={pageData} />;
}

function formatProjectType(type: string): string {
  const typeMap: Record<string, string> = {
    RESIDENTIAL: 'Residential',
    COMMERCIAL: 'Commercial',
    HOSPITALITY: 'Hospitality',
    MIXED_USE: 'Mixed Use',
    RETAIL: 'Retail',
    RESTAURANT: 'Restaurant',
    UNSPECIFIED: '',
  };
  return typeMap[type] || type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ');
}
