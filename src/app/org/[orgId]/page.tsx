import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PUBLISHED_PROJECT_FILTER } from '@/server/queries/filters';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import OrgProfileHero from '@/components/org-profile/OrgProfileHero';
import { OrgMemberNotices } from '@/components/org-profile/OrgMemberNotices';
import { can, isOrgRole } from '@/lib/orgPermissions';
import OrgProfileTabs from '@/components/org-profile/OrgProfileTabs';
import OrgProfileFeed from '@/components/org-profile/OrgProfileFeed';
import OrgProjectsGrid from '@/components/org-profile/OrgProjectsGrid';
import OrgShopTab from '@/components/org-profile/OrgShopTab';
import OrgContactTab from '@/components/org-profile/OrgContactTab';
import { OrgAboutTab } from '@/components/org-onboarding';
import PinnedCarousel from '@/components/org-profile/PinnedCarousel';
import OrgDesignerRelationships from '@/components/org-profile/OrgDesignerRelationships';
import OrgTerritoryManager from '@/components/org-profile/OrgTerritoryManager';
// Vendor-specific components
import { VendorFeed } from '@/components/vendor/VendorFeed';
import { VendorShop } from '@/components/vendor/VendorShop';
import { VendorTeam } from '@/components/vendor/VendorTeam';
import { VendorPromptSection } from '@/components/vendor/VendorPromptSection';

export const dynamic = 'force-dynamic';

interface Props {
  params: { orgId: string } | Promise<{ orgId: string }>;
  searchParams: { tab?: string; filter?: string; sort?: string } | Promise<{ tab?: string; filter?: string; sort?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const resolvedParams = params instanceof Promise ? await params : params;

  try {
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
  } catch (err) {
    console.error('[OrgProfilePage] Error generating metadata:', err);
    return { title: 'Organization | Folio' };
  }
}

export default async function OrgProfilePage({ params, searchParams }: Props) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;

  // Fetch org without relations that might not exist in Prisma client yet
  let org;
  try {
    org = await prisma.organization.findUnique({
      where: { id: resolvedParams.orgId },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        logo: true,
        website: true,
        address: true,
        tagline: true,
        philosophy: true,
        location: true,
        foundedYear: true,
        specialties: true,
        followerCount: true,
        teamSizeRange: true,
        services: true,
        projectTypes: true,
        serviceRegions: true,
        memberships: true,
        certifications: true,
      },
    });
  } catch (err) {
    console.error('[OrgProfilePage] Error fetching organization:', err);
    notFound();
  }

  if (!org) {
    notFound();
  }

  // Serialize org data for client components (Prisma objects can have non-serializable properties)
  const orgData = {
    id: org.id,
    name: org.name,
    type: org.type,
    description: org.description ?? null,
    logo: org.logo ?? null,
    website: org.website ?? null,
    address: org.address ?? null,
    // Profile fields
    tagline: (org as any).tagline ?? null,
    philosophy: (org as any).philosophy ?? null,
    location: (org as any).location ?? null,
    foundedYear: (org as any).foundedYear ?? null,
    specialties: Array.isArray((org as any).specialties) ? (org as any).specialties : [],
    followerCount: typeof (org as any).followerCount === 'number' ? (org as any).followerCount : 0,
    // Onboarding fields
    teamSizeRange: (org as any).teamSizeRange ?? null,
    services: Array.isArray((org as any).services) ? (org as any).services : [],
    projectTypes: Array.isArray((org as any).projectTypes) ? (org as any).projectTypes : [],
    serviceRegions: Array.isArray((org as any).serviceRegions) ? (org as any).serviceRegions : [],
    memberships: Array.isArray((org as any).memberships) ? (org as any).memberships : [],
    certifications: Array.isArray((org as any).certifications) ? (org as any).certifications : [],
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

  // Fetch onboarding progress
  let onboardingProgress = {
    bioInterviewComplete: false,
    studioDetailsComplete: false,
    teamSetupComplete: false,
    processComplete: false,
    recognitionComplete: false,
    pinnedWorkComplete: false,
  };
  try {
    const progress = await (prisma as any).orgOnboardingProgress?.findUnique?.({
      where: { organizationId: resolvedParams.orgId },
    });
    if (progress) {
      onboardingProgress = {
        bioInterviewComplete: progress.bioInterviewComplete ?? false,
        studioDetailsComplete: progress.studioDetailsComplete ?? false,
        teamSetupComplete: progress.teamSetupComplete ?? false,
        processComplete: progress.processComplete ?? false,
        recognitionComplete: progress.recognitionComplete ?? false,
        pinnedWorkComplete: progress.pinnedWorkComplete ?? false,
      };
    }
  } catch {
    // OrgOnboardingProgress model might not exist yet
  }

  // Fetch process phases
  let processPhases: any[] = [];
  try {
    processPhases = await (prisma as any).orgProcessPhase?.findMany?.({
      where: { organizationId: resolvedParams.orgId },
      orderBy: { order: 'asc' },
    }) || [];
  } catch {
    // OrgProcessPhase model might not exist yet
  }

  // Fetch recognition
  let recognition: any[] = [];
  try {
    recognition = await (prisma as any).orgRecognition?.findMany?.({
      where: { organizationId: resolvedParams.orgId },
      orderBy: { date: 'desc' },
    }) || [];
  } catch {
    // OrgRecognition model might not exist yet
  }

  // Check if current user is a member of this org
  const session = await getServerSession(authOptions);
  let isOwner = false;
  let isAdmin = false;
  let isMember = false;
  let canAddToTeam = false;
  // True when the viewer is a member of this org AND their own Folio
  // profile is missing the data the team card pulls from (photo or bio).
  // Drives the self-nudge banner; default false when not signed in.
  let currentUserNeedsProfile = false;

  if (session?.user?.id) {
    try {
      const membership = await prisma.organizationUser.findFirst({
        where: {
          organizationId: resolvedParams.orgId,
          userId: session.user.id,
          isActive: true,
        },
      });
      isOwner = membership?.role === 'OWNER';
      isAdmin = membership?.role === 'OWNER' || membership?.role === 'ADMIN';
      isMember = membership !== null;
      canAddToTeam = isOrgRole(membership?.role) && can(membership?.role, 'add_to_team_page');

      if (isMember) {
        const viewer = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { bio: true, profileImage: true },
        });
        currentUserNeedsProfile =
          !viewer?.bio?.trim() || !viewer?.profileImage;
      }
    } catch (err) {
      console.error('[OrgProfilePage] Error checking membership:', err);
      // Continue with default isOwner/isAdmin = false
    }
  }

  // Get org members to find their projects
  let memberIds: string[] = [];
  try {
    const members = await prisma.organizationUser.findMany({
      where: { organizationId: resolvedParams.orgId, isActive: true },
      select: { userId: true },
    });
    memberIds = members.map(m => m.userId);
  } catch (err) {
    console.error('[OrgProfilePage] Error fetching member IDs:', err);
  }

  // Get project count
  let projectCount = 0;
  if (memberIds.length > 0) {
    try {
      projectCount = await prisma.project.count({
        where: { designerId: { in: memberIds }, ...PUBLISHED_PROJECT_FILTER },
      });
    } catch (err) {
      console.error('[OrgProfilePage] Error counting projects:', err);
    }
  }

  // Compute setup card completion state
  const setupState = {
    profileComplete: Boolean(orgData.description) && Boolean(org.logo),
    recognitionComplete: recognition.length > 0,
    teamInviteComplete: false,
    firstProjectPublished: projectCount > 0,
  };

  if (memberIds.length > 1) {
    setupState.teamInviteComplete = true;
  } else {
    try {
      const inviteCount = await (prisma as any).teamMemberInvite?.count?.({
        where: { organizationId: resolvedParams.orgId },
      }) ?? 0;
      setupState.teamInviteComplete = inviteCount > 0;
    } catch {
      // TeamMemberInvite model might not exist yet
    }
  }

  // Get featured count
  let featuredCount = 0;
  if (memberIds.length > 0) {
    try {
      featuredCount = await prisma.projectPost.count({
        where: {
          project: { designerId: { in: memberIds } },
          status: 'PUBLISHED',
        },
      });
    } catch (err) {
      console.error('[OrgProfilePage] Error counting featured posts:', err);
    }
  }

  // Get follower count from UserRelationship table
  let followerCount = orgData.followerCount;
  if (memberIds.length > 0) {
    try {
      const relationshipFollowerCount = await prisma.userRelationship.count({
        where: { followingId: { in: memberIds } },
      });
      // Use the higher of denormalized count or actual relationship count
      followerCount = Math.max(followerCount, relationshipFollowerCount);
    } catch {
      // UserRelationship table might not exist yet — fall back to denormalized count
    }
  }

  // Get pinned items (with fallback for missing fields)
  const pinnedItems = await getPinnedItems(memberIds);

  // Fetch published projects for the Projects tab
  let orgProjects: any[] = [];
  if (memberIds.length > 0) {
    try {
      orgProjects = await prisma.project.findMany({
        where: { designerId: { in: memberIds }, ...PUBLISHED_PROJECT_FILTER },
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          city: true,
          regionState: true,
          projectType: true,
          createdAt: true,
          images: { take: 1, orderBy: { displayOrder: 'asc' }, select: { url: true } },
        },
      });
    } catch (err) {
      console.error('[OrgProfilePage] Error fetching projects:', err);
    }
  }

  const projectsData = orgProjects.map((p: any) => ({
    id: p.id,
    title: p.title || 'Untitled Project',
    imageUrl: p.images?.[0]?.url || null,
    location: [p.city, p.regionState].filter(Boolean).join(', ') || null,
    type: p.projectType !== 'UNSPECIFIED' ? p.projectType : null,
    year: p.createdAt ? new Date(p.createdAt).getFullYear().toString() : null,
  }));

  // Fetch products from org members' projects for the Shop tab
  let productsData: any[] = [];
  if (orgProjects.length > 0) {
    try {
      const projectIds = orgProjects.map((p: any) => p.id);
      const allProductTags = await prisma.productTag.findMany({
        where: { image: { projectId: { in: projectIds } } },
        include: {
          product: {
            select: { id: true, name: true, brand: true, price: true, imageUrl: true, category: true },
          },
          image: {
            select: {
              projectId: true,
              url: true,
              project: { select: { title: true } },
            },
          },
        },
      });

      // Deduplicate products
      const productMap = new Map<string, any>();
      allProductTags.forEach((tag: any) => {
        const existing = productMap.get(tag.productId);
        if (existing) {
          existing.projectIds.add(tag.image.projectId);
          if (!existing.cropUrl && tag.cropUrl) {
            existing.cropUrl = tag.cropUrl;
            existing.sourceImageUrl = tag.image.url;
            existing.projectTitle = tag.image.project?.title || null;
            existing.projectId = tag.image.projectId;
          }
        } else {
          productMap.set(tag.productId, {
            product: tag.product,
            projectIds: new Set([tag.image.projectId]),
            cropUrl: tag.cropUrl,
            sourceImageUrl: tag.image.url,
            projectTitle: tag.image.project?.title || null,
            projectId: tag.image.projectId,
          });
        }
      });

      productsData = Array.from(productMap.values())
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
        .sort((a: any, b: any) => b.projectCount - a.projectCount);
    } catch (err) {
      console.error('[OrgProfilePage] Error fetching products:', err);
    }
  }

  // Detect vendor org type
  const VENDOR_ORG_TYPES = ['VENDOR', 'MANUFACTURER', 'SHOWROOM'];
  const isVendorOrg = VENDOR_ORG_TYPES.includes(org.type);

  // Fetch org members for team tab (used by both vendor and design orgs)
  let orgMembers: any[] = [];
  try {
    const members = await prisma.organizationUser.findMany({
      where: { organizationId: resolvedParams.orgId, isActive: true },
      include: {
        user: { select: { id: true, name: true, profileImage: true, title: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
    orgMembers = members.map(m => ({
      id: m.user.id,
      name: m.user.name || 'Team Member',
      profileImage: m.user.profileImage,
      title: m.user.title,
      role: m.role,
      workEmail: m.showOnProfile ? m.workEmail : null,
    }));
  } catch {
    // Graceful fallback
  }

  // Default to About tab when no published projects (empty profile is a dead end on Feed)
  const defaultTab = projectCount === 0 ? 'about' : 'feed';
  const activeTab = resolvedSearchParams.tab || defaultTab;
  const activeFilter = resolvedSearchParams.filter || 'all';
  const activeSort = resolvedSearchParams.sort || 'featured';

  // Serialize team members for client components
  const teamData = teamMembers.map((m: any) => ({
    id: m.id ?? '',
    name: m.name ?? '',
    role: m.role ?? '',
    headshotUrl: m.headshotUrl ?? null,
    bio: m.bio ?? null,
    displayOrder: typeof m.displayOrder === 'number' ? m.displayOrder : 0,
  }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface-ground)' }}>
      <OrgProfileHero
        org={orgData}
        projectCount={projectCount}
        featuredCount={featuredCount}
        followerCount={followerCount}
        isOwner={isOwner}
        isMember={isMember}
      />

      <OrgMemberNotices
        orgId={resolvedParams.orgId}
        canAddToTeam={canAddToTeam}
        isMember={isMember}
        currentUserNeedsProfile={currentUserNeedsProfile}
      />

      {pinnedItems.length > 0 && <PinnedCarousel items={pinnedItems} />}

      <OrgProfileTabs activeTab={activeTab} orgId={resolvedParams.orgId} defaultTab={defaultTab} orgType={org.type} isMember={isMember} isAdmin={isAdmin} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Vendor-specific tab content */}
        {isVendorOrg && activeTab === 'feed' && (
          <Suspense fallback={<FeedSkeleton />}>
            <VendorFeed orgId={resolvedParams.orgId} />
            {/* Curated prompts visible on vendor org page */}
            <VendorPromptSection orgId={resolvedParams.orgId} isOwner={isOwner} />
          </Suspense>
        )}
        {isVendorOrg && activeTab === 'shop' && (
          <VendorShop orgId={resolvedParams.orgId} />
        )}
        {isVendorOrg && activeTab === 'team' && (
          <VendorTeam members={orgMembers} orgId={resolvedParams.orgId} orgName={orgData.name} />
        )}

        {/* Design org tab content (unchanged) */}
        {!isVendorOrg && activeTab === 'feed' && (
          <Suspense fallback={<FeedSkeleton />}>
            <OrgProfileFeed
              orgId={resolvedParams.orgId}
              initialFilter={activeFilter}
              initialSort={activeSort}
              isMember={isMember}
              isAdmin={isAdmin}
              projectCount={projectCount}
              setupState={setupState}
            />
          </Suspense>
        )}
        {!isVendorOrg && activeTab === 'projects' && (
          <OrgProjectsGrid projects={projectsData} isOwner={isOwner} />
        )}
        {!isVendorOrg && activeTab === 'shop' && (
          <OrgShopTab products={productsData} />
        )}
        {activeTab === 'relationships' && isMember && (
          <Suspense fallback={<TabSkeleton />}>
            <OrgDesignerRelationships orgId={resolvedParams.orgId} isAdmin={isAdmin} />
            {isAdmin && (
              <div className="mt-8">
                <h2 className="text-sm font-medium text-stone-900 mb-4">Territory & Governance</h2>
                <OrgTerritoryManager orgId={resolvedParams.orgId} isAdmin={isAdmin} />
              </div>
            )}
          </Suspense>
        )}
        {activeTab === 'about' && (
          <OrgAboutTab
            org={orgData}
            team={teamData}
            processPhases={processPhases.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description ?? null,
              order: p.order,
            }))}
            recognition={recognition.map((r: any) => ({
              id: r.id,
              type: r.type,
              title: r.title,
              source: r.source,
              date: r.date ?? null,
              url: r.url ?? null,
            }))}
            onboardingProgress={onboardingProgress}
            isOwner={isOwner}
          />
        )}
        {activeTab === 'contact' && (
          <OrgContactTab
            org={orgData}
            isOwner={isOwner}
            currentUser={session?.user ? { id: session.user.id, name: session.user.name || '' } : null}
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
        title: p.title || 'Untitled',
        image: p.images[0]?.url || null,
        subtitle: `${p.city || 'Project'} · ${p.saves || 0} saves`,
      },
    }));
  } catch {
    // pinnedAt field might not exist in Prisma client yet
    return [];
  }
}

function TabSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="h-24 rounded-lg animate-pulse"
          style={{ backgroundColor: '#E8E4DF' }}
        />
      ))}
    </div>
  );
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
