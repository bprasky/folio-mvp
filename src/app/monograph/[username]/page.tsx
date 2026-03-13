import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import Hero from '@/components/monograph/Hero';
import Fingerprint from '@/components/monograph/Fingerprint';
import SelectedWorks from '@/components/monograph/SelectedWorks';
import KnownFor from '@/components/monograph/KnownFor';
import Services from '@/components/monograph/Services';
import Colophon from '@/components/monograph/Colophon';
import EmptyState from '@/components/monograph/EmptyState';
import ConnectButton from '@/components/monograph/ConnectButton';
import {
  getDesignerPublishedProjects,
  getTaggedProductsForDesigner
} from '@/server/queries/getDesignerProjectsWithProducts';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

type Props = {
  params: { username: string } | Promise<{ username: string }>;
  searchParams: { badge?: string; event?: string } | Promise<{ badge?: string; event?: string }>;
};

/**
 * Clean username - handle @ prefix gracefully
 */
function cleanUsername(username: string): string {
  return username.startsWith('@') ? username.slice(1) : username;
}

/**
 * Derive user from username slug
 * Username format: "bradpraskydesign" -> lookup by email prefix or name
 * Works for all user roles (designers, vendors, architects, builders, etc.)
 */
async function getUserByUsername(username: string) {
  const clean = cleanUsername(username);

  // Try to find by email prefix first (e.g., "brad" matches "brad@folio.com")
  const emailMatch = await prisma.user.findFirst({
    where: {
      email: {
        startsWith: clean,
      },
    },
  });

  if (emailMatch) {
    return emailMatch;
  }

  // Try exact name match (case-insensitive)
  const exactNameMatch = await prisma.user.findFirst({
    where: {
      name: {
        equals: clean,
        mode: 'insensitive',
      },
    },
  });

  if (exactNameMatch) {
    return exactNameMatch;
  }

  // Try name match with spaces removed (e.g., "bradpraskydesign" matches "Brad Prasky Design")
  const nameWithoutSpaces = clean.replace(/\s+/g, '').toLowerCase();
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true, location: true, bio: true, profileImage: true, specialties: true, aestheticProfile: true, followers: true },
  });

  for (const user of allUsers) {
    const userNameWithoutSpaces = user.name.replace(/\s+/g, '').toLowerCase();
    if (userNameWithoutSpaces === nameWithoutSpaces) {
      return user;
    }
  }

  // Fallback: try to find by name containing the clean username
  const containsMatch = await prisma.user.findFirst({
    where: {
      name: {
        contains: clean,
        mode: 'insensitive',
      },
    },
  });

  if (containsMatch) {
    return containsMatch;
  }

  return null;
}

/**
 * Get fingerprint tags from designer's specialties or aesthetic profile
 */
function getFingerprintTags(designer: { specialties: string[]; aestheticProfile: any }): string[] {
  // Primary: use specialties if populated
  if (designer.specialties && designer.specialties.length > 0) {
    return designer.specialties;
  }

  // Fallback: parse aestheticProfile for style descriptors
  if (designer.aestheticProfile && typeof designer.aestheticProfile === 'object') {
    const profile = designer.aestheticProfile as Record<string, any>;
    const styles = profile.dominantStyles || profile.styles || profile.tags;
    if (Array.isArray(styles) && styles.length > 0) {
      return styles.map((s: any) => (typeof s === 'string' ? s : String(s)));
    }
  }

  return [];
}

export default async function Monograph({ params, searchParams }: Props) {
  // Handle both sync and async params (Next.js 15+)
  const resolvedParams = params instanceof Promise ? await params : params;
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const handle = cleanUsername(resolvedParams.username);
  const isBadgeScan = resolvedSearchParams.badge === 'true';

  console.log('[Monograph] Looking up user with username:', handle, isBadgeScan ? '(badge scan)' : '');

  const designer = await getUserByUsername(handle);

  if (!designer) {
    console.log('[Monograph] User not found for username:', handle);
    notFound();
  }

  console.log('[Monograph] Found user:', designer.name, designer.email);

  // Fetch all data in parallel
  const [projects, knownForProducts] = await Promise.all([
    getDesignerPublishedProjects(designer.id),
    getTaggedProductsForDesigner(designer.id),
  ]);

  const fingerprintTags = getFingerprintTags(designer);

  const hasProjects = projects.length > 0;

  if (!hasProjects) {
    return <EmptyState username={handle} designer={designer} />;
  }

  // Calculate established year from createdAt
  const establishedYear = designer.createdAt 
    ? new Date(designer.createdAt).getFullYear()
    : 2015;

  // Parse locations from location field (format: "Chicago · New York · Global")
  const locations = designer.location 
    ? designer.location.split('·').map(loc => loc.trim()).filter(Boolean)
    : ['Global'];

  // Get quote from bio or use default
  const quote = designer.bio || 
    "Great design happens in the negative space — between objects, between words, between heartbeats. My job is to get everything else out of the way.";

  // Calculate fingerprint last updated (most recent project update)
  const fingerprintLastUpdated = hasProjects
    ? projects.reduce((latest, project) => {
        const projectDate = project.publishedAt || project.updatedAt || project.createdAt;
        const latestDate = latest.publishedAt || latest.updatedAt || latest.createdAt;
        return projectDate > latestDate ? project : latest;
      })
    : null;

  const fingerprintUpdatedDate = fingerprintLastUpdated
    ? fingerprintLastUpdated.publishedAt || fingerprintLastUpdated.updatedAt
    : null;

  // Get hero image from highest-engagement project
  const heroProject = projects.reduce((prev, current) => {
    const prevImages = prev.images?.length || 0;
    const currentImages = current.images?.length || 0;
    return currentImages > prevImages ? current : prev;
  });

  const heroImage = heroProject?.images?.[0]?.url || 
                    projects[0]?.images?.[0]?.url || 
                    '/images/placeholders/project-16x9.jpg';

  // Calculate metrics from real data
  const followers = designer.followers || 0;
  const projectViews = projects.reduce((sum, p) => sum + (p.views || 0), 0);
  const productSaves = knownForProducts.reduce((sum, p) => sum + p.tagCount, 0);

  // Query real editorial featured count
  const editorialsFeatured = await prisma.projectPost.count({
    where: {
      project: { designerId: designer.id },
      status: 'PUBLISHED',
    },
  });

  // Only check for existing connection when arriving via QR badge scan
  const session = await auth();
  let existingVisit: { id: string; createdAt: Date } | null = null;
  if (isBadgeScan && session?.user?.id && session.user.id !== designer.id) {
    existingVisit = await prisma.visitRecord.findFirst({
      where: {
        OR: [
          { initiatorUserId: session.user.id, recipientUserId: designer.id },
          { initiatorUserId: designer.id, recipientUserId: session.user.id },
        ],
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  return (
    <main className="min-h-screen bg-[#fdfbf8]">
      <Hero
        imageUrl={heroImage}
        title={designer.name}
        locations={locations}
        establishedYear={establishedYear}
        followers={followers}
        profileImageUrl={designer.profileImage}
      >
        {/* ConnectButton only shows when arriving via QR badge scan */}
        {isBadgeScan && session?.user?.id !== designer.id && (
          <ConnectButton
            recipientUserId={designer.id}
            recipientName={designer.name}
            existingVisitDate={existingVisit?.createdAt?.toISOString() || null}
            existingVisitId={existingVisit?.id || null}
          />
        )}
      </Hero>

      <div className="max-w-7xl mx-auto px-6 py-24 space-y-48">
        {/* Opening Quote Spread */}
        {quote && (
          <section className="max-w-3xl mx-auto prose prose-lg">
            <blockquote className="text-2xl md:text-3xl lg:text-4xl font-light italic text-[var(--text-primary)] leading-relaxed font-serif text-center border-none p-0 m-0">
              "{quote}"
            </blockquote>
            <footer className="text-right mt-8 text-sm uppercase tracking-widest text-[var(--text-secondary)]">
              — {designer.name}
            </footer>
          </section>
        )}

        <Fingerprint 
          tags={fingerprintTags}
          projectCount={projects.length}
          lastUpdated={fingerprintUpdatedDate}
          projectViews={projectViews}
        />

        <SelectedWorks projects={projects} />

        {knownForProducts.length > 0 && (
          <KnownFor items={knownForProducts} productSaves={productSaves} />
        )}

        <Services designerName={designer.name} />
      </div>

      <Colophon name={designer.name} editorialsFeatured={editorialsFeatured} />
    </main>
  );
}

