import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import OrgProfileHero from '@/components/org-profile/OrgProfileHero';
import OrgProfileTabs from '@/components/org-profile/OrgProfileTabs';
import OrgProfileFeed from '@/components/org-profile/OrgProfileFeed';
import OrgProfileAbout from '@/components/org-profile/OrgProfileAbout';
import PinnedCarousel from '@/components/org-profile/PinnedCarousel';

export const dynamic = 'force-dynamic';

interface Props {
  params: { orgId: string } | Promise<{ orgId: string }>;
  searchParams: { tab?: string; filter?: string; sort?: string } | Promise<{ tab?: string; filter?: string; sort?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const resolvedParams = params instanceof Promise ? await params : params;

  const org = await prisma.organization.findUnique({
    where: { id: resolvedParams.orgId },
    select: { name: true, description: true },
  });

  if (!org) {
    return { title: 'Organization Not Found | Folio' };
  }

  return {
    title: `${org.name} | Folio`,
    description: org.description || `${org.name}'s professional profile on Folio`,
  };
}

export default async function OrgProfilePage({ params, searchParams }: Props) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;

  // Fetch org without relations that might not exist in Prisma client yet
  const org = await prisma.organization.findUnique({
    where: { id: resolvedParams.orgId },
  });

  if (!org) {
    notFound();
  }

  // Serialize org data for client components (Prisma objects can have non-serializable properties)
  const orgData = {
    id: org.id,
    name: org.name,
    type: org.type,
    description: org.description,
    logo: org.logo,
    website: org.website,
    address: org.address,
    // New profile fields (might not exist yet)
    tagline: (org as any).tagline || null,
    philosophy: (org as any).philosophy || null,
    location: (org as any).location || null,
    foundedYear: (org as any).foundedYear || null,
    specialties: (org as any).specialties || [],
  };

  // Try to fetch team members separately (graceful fallback if relation doesn't exist)
  let teamMembers: any[] = [];
  try {
    teamMembers = await (prisma as any).teamMember?.findMany?.({
      where: { organizationId: resolvedParams.orgId },
      orderBy: { displayOrder: 'asc' },
    }) || [];
  } catch {
    // TeamMember model might not exist in Prisma client yet
  }

  // Check if current user is a member of this org
  const session = await getServerSession(authOptions);
  let isOwner = false;
  let isAdmin = false;

  if (session?.user?.id) {
    const membership = await prisma.organizationUser.findFirst({
      where: {
        organizationId: resolvedParams.orgId,
        userId: session.user.id,
        isActive: true,
      },
    });
    isOwner = membership?.role === 'OWNER';
    isAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';
  }

  // Get org members to find their projects
  const memberIds = await prisma.organizationUser.findMany({
    where: { organizationId: resolvedParams.orgId, isActive: true },
    select: { userId: true },
  }).then(members => members.map(m => m.userId));

  // Get project count
  const projectCount = memberIds.length > 0
    ? await prisma.project.count({
        where: { designerId: { in: memberIds }, isPublic: true },
      })
    : 0;

  // Get featured count
  const featuredCount = memberIds.length > 0
    ? await prisma.projectPost.count({
        where: {
          project: { designerId: { in: memberIds } },
          status: 'PUBLISHED',
        },
      })
    : 0;

  // Get pinned items (with fallback for missing fields)
  const pinnedItems = await getPinnedItems(memberIds);

  const activeTab = resolvedSearchParams.tab || 'feed';
  const activeFilter = resolvedSearchParams.filter || 'all';
  const activeSort = resolvedSearchParams.sort || 'featured';

  // Serialize team members for client components
  const teamData = teamMembers.map((m: any) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    headshotUrl: m.headshotUrl,
    bio: m.bio,
    displayOrder: m.displayOrder,
  }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF9F7' }}>
      <OrgProfileHero
        org={orgData}
        projectCount={projectCount}
        featuredCount={featuredCount}
        followerCount={(org as any).followerCount || 0}
        isOwner={isOwner}
      />

      {pinnedItems.length > 0 && <PinnedCarousel items={pinnedItems} />}

      <OrgProfileTabs activeTab={activeTab} orgId={resolvedParams.orgId} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'feed' ? (
          <Suspense fallback={<FeedSkeleton />}>
            <OrgProfileFeed
              orgId={resolvedParams.orgId}
              initialFilter={activeFilter}
              initialSort={activeSort}
            />
          </Suspense>
        ) : (
          <OrgProfileAbout
            org={orgData}
            team={teamData}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </div>
  );
}

async function getPinnedItems(memberIds: string[]) {
  if (memberIds.length === 0) return [];

  try {
    // Try to query with pinnedAt field
    const projects = await prisma.project.findMany({
      where: {
        designerId: { in: memberIds },
        isPublic: true,
        pinnedAt: { not: null },
      },
      include: {
        images: { take: 1, orderBy: { displayOrder: 'asc' } },
      },
      orderBy: { pinOrder: 'asc' },
      take: 5,
    });

    return projects.map(p => ({
      id: p.id,
      type: 'project' as const,
      data: {
        title: p.name,
        image: p.images[0]?.url,
        subtitle: `${p.city || 'Project'} · ${p.saves || 0} saves`,
      },
    }));
  } catch {
    // pinnedAt field might not exist in Prisma client yet
    return [];
  }
}

function FeedSkeleton() {
  return (
    <div>
      {/* Filter skeleton */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="h-8 w-20 rounded-full animate-pulse"
            style={{ backgroundColor: '#E8E4DF' }}
          />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="mb-4 rounded-lg animate-pulse break-inside-avoid"
            style={{
              backgroundColor: '#E8E4DF',
              aspectRatio: i % 2 === 0 ? '4/3' : '3/4',
            }}
          />
        ))}
      </div>
    </div>
  );
}
