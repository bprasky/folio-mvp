import { expertiseEnabled } from '@/lib/publishing-studio/expertise/flag';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { PUBLISHED_PROJECT_FILTER } from '@/server/queries/filters';
import ProfileHero from '@/components/profile/unified/ProfileHero';
import ProfileTabs from '@/components/profile/unified/ProfileTabs';
import ProfileFeed from '@/components/profile/unified/ProfileFeed';
import ProfileShop from '@/components/profile/unified/ProfileShop';
import ProfileAbout from '@/components/profile/unified/ProfileAbout';
import PinnedCarousel from '@/components/profile/unified/PinnedCarousel';
import { PublishedStudioStories } from '@/components/profile/PublishedStudioStories';
import { PublishedExpertise } from '@/components/profile/PublishedExpertise';

export const dynamic = 'force-dynamic';

interface Props {
  params: { userId: string } | Promise<{ userId: string }>;
  searchParams: { tab?: string; filter?: string; sort?: string } | Promise<{ tab?: string; filter?: string; sort?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const resolvedParams = params instanceof Promise ? await params : params;

  const user = await prisma.user.findUnique({
    where: { id: resolvedParams.userId },
    select: { name: true, title: true, bio: true },
  });

  if (!user) {
    return { title: 'Profile Not Found | Folio' };
  }

  return {
    title: `${user.name} | Folio`,
    description: user.bio || `${user.name}'s professional profile on Folio`,
  };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;

  const user = await prisma.user.findUnique({
    where: { id: resolvedParams.userId },
    include: {
      profileInterview: true,
      organizationUsers: {
        where: { isActive: true },
        include: {
          organization: {
            include: {
              teamMembers: {
                orderBy: { displayOrder: 'asc' },
                include: {
                  linkedUser: {
                    select: {
                      id: true,
                      name: true,
                      profileImage: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  // Check if current user is viewing their own profile
  const session = await auth();
  const isOwner = session?.user?.id === user.id;

  const activeTab = resolvedSearchParams.tab || 'feed';
  const activeFilter = resolvedSearchParams.filter || 'all';
  const activeSort = resolvedSearchParams.sort || 'featured';

  // Get project count
  const projectCount = await prisma.project.count({
    where: { designerId: resolvedParams.userId, ...PUBLISHED_PROJECT_FILTER },
  });

  // Get featured count
  const featuredCount = await prisma.projectPost.count({
    where: {
      project: { designerId: resolvedParams.userId },
      status: 'PUBLISHED',
    },
  });

  // Get pinned items
  const pinnedItems = await getPinnedItems(resolvedParams.userId);

  // Extract team from organization
  const primaryOrg = user.organizationUsers[0]?.organization;
  const team = primaryOrg?.teamMembers || [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface-ground)' }}>
      <ProfileHero
        user={user}
        projectCount={projectCount}
        featuredCount={featuredCount}
        isOwner={isOwner}
      />

      {pinnedItems.length > 0 && <PinnedCarousel items={pinnedItems} />}

      {activeTab !== 'about' && <PublishedStudioStories userId={resolvedParams.userId} />}
      <ProfileTabs activeTab={activeTab} userId={resolvedParams.userId} expertiseEnabled={expertiseEnabled()} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'expertise' && expertiseEnabled() && <PublishedExpertise userId={resolvedParams.userId} />}
        {activeTab === 'feed' && (
          <Suspense fallback={<FeedSkeleton />}>
            <ProfileFeed
              userId={resolvedParams.userId}
              initialFilter={activeFilter}
              initialSort={activeSort}
            />
          </Suspense>
        )}
        {activeTab === 'shop' && (
          <Suspense fallback={<ShopSkeleton />}>
            <ProfileShop userId={resolvedParams.userId} />
          </Suspense>
        )}
        {activeTab === 'about' && (
          <>
          <ProfileAbout
            user={user}
            team={team}
            organization={
              primaryOrg
                ? {
                    id: primaryOrg.id,
                    name: primaryOrg.name,
                    type: primaryOrg.type,
                    logo: primaryOrg.logo,
                  }
                : null
            }
          />
          <PublishedStudioStories userId={resolvedParams.userId} />
          </>
        )}
      </div>
    </div>
  );
}

async function getPinnedItems(userId: string) {
  const [projects, media, recognition, collaborations] = await Promise.all([
    prisma.project.findMany({
      where: { designerId: userId, pinnedAt: { not: null }, isPublic: true },
      orderBy: { pinOrder: 'asc' },
      include: {
        images: { take: 1, orderBy: { displayOrder: 'asc' } },
      },
    }),
    prisma.media.findMany({
      where: { userId, pinnedAt: { not: null }, publishedAt: { not: null } },
      orderBy: { pinOrder: 'asc' },
    }),
    prisma.recognition.findMany({
      where: { userId, pinnedAt: { not: null }, publishedAt: { not: null } },
      orderBy: { pinOrder: 'asc' },
    }),
    prisma.collaboration.findMany({
      where: { userId, pinnedAt: { not: null }, publishedAt: { not: null } },
      orderBy: { pinOrder: 'asc' },
      include: {
        vendor: { select: { name: true, logo: true } },
        partner: { select: { name: true, profileImage: true } },
      },
    }),
  ]);

  const pinned = [
    ...projects.map(p => ({
      id: p.id,
      type: 'project' as const,
      data: {
        ...p,
        imageUrl: p.images?.[0]?.url,
        saveCount: p.saves || 0,
      },
      pinOrder: p.pinOrder,
    })),
    ...media.map(m => ({
      id: m.id,
      type: 'media' as const,
      data: m,
      pinOrder: m.pinOrder,
    })),
    ...recognition.map(r => ({
      id: r.id,
      type: 'recognition' as const,
      data: r,
      pinOrder: r.pinOrder,
    })),
    ...collaborations.map(c => ({
      id: c.id,
      type: 'collaboration' as const,
      data: {
        ...c,
        partnerName: c.partnerName || c.partner?.name || c.vendor?.name,
        partnerLogo: c.partnerLogoUrl || c.partner?.profileImage || c.vendor?.logo,
      },
      pinOrder: c.pinOrder,
    })),
  ].sort((a, b) => (a.pinOrder || 0) - (b.pinOrder || 0));

  return pinned;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="rounded-xl overflow-hidden animate-pulse"
            style={{ backgroundColor: '#F5F3F0' }}
          >
            <div className="aspect-[4/3]" style={{ backgroundColor: '#E8E4DF' }} />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 rounded" style={{ backgroundColor: '#E8E4DF' }} />
              <div className="h-3 w-1/2 rounded" style={{ backgroundColor: '#E8E4DF' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShopSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div
          className="h-6 w-24 rounded animate-pulse"
          style={{ backgroundColor: '#E8E4DF' }}
        />
      </div>

      {/* Filter skeleton */}
      <div className="flex gap-4 mb-8">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="h-10 w-32 rounded-lg animate-pulse"
            style={{ backgroundColor: '#E8E4DF' }}
          />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div
            key={i}
            className="rounded-xl overflow-hidden animate-pulse"
            style={{ backgroundColor: '#F5F3F0' }}
          >
            <div className="aspect-square" style={{ backgroundColor: '#E8E4DF' }} />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 rounded" style={{ backgroundColor: '#E8E4DF' }} />
              <div className="h-3 w-1/2 rounded" style={{ backgroundColor: '#E8E4DF' }} />
              <div className="h-3 w-1/3 rounded" style={{ backgroundColor: '#E8E4DF' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
