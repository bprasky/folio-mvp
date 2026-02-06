import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Hero from '@/components/monograph/Hero';
import Fingerprint from '@/components/monograph/Fingerprint';
import SelectedWorks from '@/components/monograph/SelectedWorks';
import KnownFor from '@/components/monograph/KnownFor';
import Services from '@/components/monograph/Services';
import Colophon from '@/components/monograph/Colophon';
import EmptyState from '@/components/monograph/EmptyState';
import { 
  getDesignerPublishedProjects, 
  getTaggedProductsForDesigner 
} from '@/server/queries/getDesignerProjectsWithProducts';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

type Props = { 
  params: { username: string } | Promise<{ username: string }>;
};

/**
 * Clean username - handle @ prefix gracefully
 */
function cleanUsername(username: string): string {
  return username.startsWith('@') ? username.slice(1) : username;
}

/**
 * Derive designer from username
 * Username format: "bradpraskydesign" -> lookup by email prefix or name
 */
async function getDesignerByUsername(username: string) {
  const clean = cleanUsername(username);
  
  // Try to find by email prefix first (e.g., "brad" matches "brad@folio.com")
  const emailMatch = await prisma.user.findFirst({
    where: {
      email: {
        startsWith: clean,
      },
      role: 'DESIGNER',
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
      role: 'DESIGNER',
    },
  });

  if (exactNameMatch) {
    return exactNameMatch;
  }

  // Try name match with spaces removed (e.g., "bradpraskydesign" matches "Brad Prasky Design")
  const nameWithoutSpaces = clean.replace(/\s+/g, '').toLowerCase();
  const allDesigners = await prisma.user.findMany({
    where: {
      role: 'DESIGNER',
    },
  });

  for (const designer of allDesigners) {
    const designerNameWithoutSpaces = designer.name.replace(/\s+/g, '').toLowerCase();
    if (designerNameWithoutSpaces === nameWithoutSpaces) {
      return designer;
    }
  }

  // Fallback: try to find by name containing the clean username
  const containsMatch = await prisma.user.findFirst({
    where: {
      name: {
        contains: clean,
        mode: 'insensitive',
      },
      role: 'DESIGNER',
    },
  });

  if (containsMatch) {
    return containsMatch;
  }

  // Last resort: return first designer if no match (for testing)
  // TODO: Remove this in production
  const firstDesigner = await prisma.user.findFirst({
    where: {
      role: 'DESIGNER',
    },
  });

  return firstDesigner || null;
}

/**
 * Get fingerprint tags from designer's projects
 */
async function getFingerprintTags(designerId: string) {
  // For now, return hardcoded fingerprint tags
  // TODO: Replace with real analysis of project data
  return [
    'Warm Neutrals',
    'Textural Contrast',
    'Organic Modernism',
    'Architectural Restraint',
    'Midwestern Soul',
  ];
}

export default async function Monograph({ params }: Props) {
  // Handle both sync and async params (Next.js 15+)
  const resolvedParams = params instanceof Promise ? await params : params;
  const handle = cleanUsername(resolvedParams.username);

  console.log('[Monograph] Looking up designer with username:', handle);

  const designer = await getDesignerByUsername(handle);

  if (!designer || designer.role !== 'DESIGNER') {
    console.log('[Monograph] Designer not found for username:', handle);
    notFound();
  }

  console.log('[Monograph] Found designer:', designer.name, designer.email);

  // Fetch all data in parallel
  const [projects, knownForProducts, fingerprintTags] = await Promise.all([
    getDesignerPublishedProjects(designer.id),
    getTaggedProductsForDesigner(designer.id),
    getFingerprintTags(designer.id),
  ]);

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

  // Calculate metrics (use designer data or seed values for Brad Prasky Design)
  const followers = designer.followers || 18420;
  // Calculate project views from projects
  const projectViews = projects.reduce((sum, p) => sum + (p.views || 0), 0) || 184600;
  const productSaves = knownForProducts.reduce((sum, p) => sum + p.tagCount, 0) || 4247;
  const editorialsFeatured = 12; // TODO: Query from editorial assignments

  return (
    <main className="min-h-screen bg-[#fdfbf8]">
      <Hero 
        imageUrl={heroImage}
        title={designer.name}
        locations={locations}
        establishedYear={establishedYear}
        followers={followers}
      />

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

