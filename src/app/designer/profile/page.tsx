import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { PUBLISHED_PROJECT_FILTER } from '@/server/queries/filters';
import ProfileClient from './ProfileClient';
import type { ProfilePageData, ProfileProject, ProfileProduct, ProfileTeamMember, ProfileCollaboration, DesignerBioData, UpcomingEventRSVP } from './types';

export const dynamic = 'force-dynamic';

export default async function DesignerProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // Fetch user — keep this query free of tables that may not exist yet
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
            },
          },
        },
      },
    },
  });

  if (!user) {
    redirect('/login');
  }

  // Get organization
  const orgUser = user.organizationUsers[0] ?? null;
  const organization = orgUser?.organization
    ? { id: orgUser.organization.id, name: orgUser.organization.name }
    : null;

  // Fetch save and board counts
  let saveCount = 0;
  let boardCount = 0;
  try {
    [saveCount, boardCount] = await Promise.all([
      prisma.save.count({ where: { userId } }),
      prisma.board.count({ where: { userId } }),
    ]);
  } catch {
    // Tables might not exist yet — fall back to 0
  }

  // Fetch team members separately — team_member table may not exist yet
  let teamMembers: ProfileTeamMember[] = [];
  if (orgUser?.organization?.id) {
    try {
      const members = await prisma.teamMember.findMany({
        where: { organizationId: orgUser.organization.id },
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
      });
      teamMembers = members.map(m => ({
        id: m.id,
        name: m.linkedUser?.name || m.name,
        role: m.role,
        headshotUrl: m.headshotUrl,
        profileImage: m.linkedUser?.profileImage || null,
      }));
    } catch {
      // Table doesn't exist yet — silently fall back to empty
    }
  }

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
        select: { slug: true },
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
            select: {
              projectId: true,
              url: true,
              project: {
                select: { title: true },
              },
            },
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
    title: p.title || 'Untitled Project',
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

  // Deduplicate products and count projects, capturing best crop URL and context
  const productMap = new Map<
    string,
    {
      product: (typeof allProductTags)[0]['product'];
      projectIds: Set<string>;
      cropUrl: string | null;
      sourceImageUrl: string | null;
      projectTitle: string | null;
      projectId: string | null;
    }
  >();
  allProductTags.forEach(tag => {
    const existing = productMap.get(tag.productId);
    if (existing) {
      existing.projectIds.add(tag.image.projectId);
      // Prefer a tag that has a cropUrl
      if (!existing.cropUrl && tag.cropUrl) {
        existing.cropUrl = tag.cropUrl;
        existing.sourceImageUrl = tag.image.url;
        existing.projectTitle = (tag.image as any).project?.title || null;
        existing.projectId = tag.image.projectId;
      }
    } else {
      productMap.set(tag.productId, {
        product: tag.product,
        projectIds: new Set([tag.image.projectId]),
        cropUrl: tag.cropUrl,
        sourceImageUrl: tag.image.url,
        projectTitle: (tag.image as any).project?.title || null,
        projectId: tag.image.projectId,
      });
    }
  });

  const products: ProfileProduct[] = Array.from(productMap.values())
    .map(item => ({
      id: item.product.id,
      name: item.product.name,
      vendor: item.product.brand || 'Unknown Vendor',
      imageUrl: item.product.imageUrl,
      cropUrl: item.cropUrl,
      price: item.product.price,
      category: item.product.category,
      projectCount: item.projectIds.size,
      sourceImageUrl: item.sourceImageUrl,
      projectTitle: item.projectTitle,
      projectId: item.projectId,
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

  // Attempt to load designerBio — table may not exist yet
  let designerBio: DesignerBioData | null = null;
  try {
    const bio = await prisma.designerBio.findUnique({
      where: { userId },
      select: {
        status: true,
        folioBio: true,
        sourceUrl: true,
        interviewAnswers: true,
      },
    });
    if (bio) {
      const answers = Array.isArray(bio.interviewAnswers) ? bio.interviewAnswers : [];
      designerBio = {
        status: bio.status,
        folioBio: bio.folioBio,
        sourceUrl: bio.sourceUrl,
        answerCount: answers.length,
      };
    }
  } catch {
    // Table doesn't exist yet — silently fall back to null
  }

  // Fetch upcoming event RSVPs for the badge feature
  let upcomingEventRSVPs: UpcomingEventRSVP[] = [];
  try {
    const rsvps = await prisma.eventRSVP.findMany({
      where: {
        userId,
        status: 'attending',
        event: { endDate: { gte: new Date() } },
      },
      select: {
        eventId: true,
        event: {
          select: {
            title: true,
            startDate: true,
            location: true,
          },
        },
      },
      orderBy: { event: { startDate: 'asc' } },
      take: 3,
    });
    upcomingEventRSVPs = rsvps.map(r => ({
      eventId: r.eventId,
      eventTitle: r.event.title,
      eventStartDate: r.event.startDate.toISOString(),
      eventLocation: r.event.location,
    }));
  } catch {
    // EventRSVP table might not exist yet
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
    designerBio,
    projects,
    products,
    teamMembers,
    collaborations,
    saveCount,
    boardCount,
    upcomingEventRSVPs,
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
