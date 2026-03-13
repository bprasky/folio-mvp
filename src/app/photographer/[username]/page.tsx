import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { PhotographerProfile } from '@/components/photographer/PhotographerProfile';
import { parseCredits } from '@/lib/posting/creditsSchema';

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
  return decodeURIComponent(username.startsWith('@') ? username.slice(1) : username);
}

/**
 * Find photographer by username slug (name with spaces removed, case-insensitive)
 */
async function getPhotographerByUsername(username: string) {
  const clean = cleanUsername(username);

  // Try exact name match (case-insensitive)
  const exactNameMatch = await prisma.user.findFirst({
    where: {
      name: { equals: clean, mode: 'insensitive' },
      role: 'PHOTOGRAPHER',
    },
  });
  if (exactNameMatch) return exactNameMatch;

  // Try name match with spaces removed
  const nameWithoutSpaces = clean.replace(/\s+/g, '').toLowerCase();
  const allPhotographers = await prisma.user.findMany({
    where: { role: 'PHOTOGRAPHER' },
    select: {
      id: true,
      name: true,
      bio: true,
      profileImage: true,
      location: true,
      website: true,
      instagram: true,
      photographyStyles: true,
      travelRadius: true,
      bookingEmail: true,
      bookingUrl: true,
      views: true,
      createdAt: true,
    },
  });

  for (const photographer of allPhotographers) {
    const photographerSlug = photographer.name.replace(/\s+/g, '').toLowerCase();
    if (photographerSlug === nameWithoutSpaces) {
      return photographer;
    }
  }

  // Fallback: contains match
  const containsMatch = await prisma.user.findFirst({
    where: {
      name: { contains: clean, mode: 'insensitive' },
      role: 'PHOTOGRAPHER',
    },
  });

  return containsMatch;
}

/**
 * Query published projects where this photographer is credited.
 * Uses raw SQL for efficient JSONB array search on PostgreSQL.
 */
async function getPhotographerCreditedProjects(photographerId: string) {
  const projects = await prisma.$queryRaw<
    Array<{
      id: string;
      slug: string;
      excerpt: string | null;
      credits: any;
      publishedAt: Date | null;
      projectId: string;
      projectTitle: string;
      projectDescription: string | null;
      designerName: string | null;
      heroImageUrl: string | null;
    }>
  >`
    SELECT
      pp.id,
      pp.slug,
      pp.excerpt,
      pp.credits,
      pp."publishedAt",
      p.id as "projectId",
      p.title as "projectTitle",
      p.description as "projectDescription",
      u.name as "designerName",
      (
        SELECT pi.url FROM project_images pi
        WHERE pi."projectId" = p.id
        ORDER BY pi."createdAt" ASC
        LIMIT 1
      ) as "heroImageUrl"
    FROM project_posts pp
    JOIN projects p ON p.id = pp."projectId"
    LEFT JOIN users u ON u.id = p."designerId"
    WHERE pp.status = 'PUBLISHED'
    AND pp.credits @> ${JSON.stringify([{ role: "Photographer", userId: photographerId }])}::jsonb
    ORDER BY pp."publishedAt" DESC
  `;

  return projects;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = params instanceof Promise ? await params : params;
  const photographer = await getPhotographerByUsername(resolvedParams.username);

  if (!photographer) {
    return { title: 'Photographer Not Found | Folio' };
  }

  const title = `${photographer.name} | Photographer on Folio`;
  const description = photographer.bio || `View ${photographer.name}'s photography portfolio on Folio.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
    },
  };
}

export default async function PhotographerPage({ params }: Props) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const handle = cleanUsername(resolvedParams.username);

  const photographer = await getPhotographerByUsername(handle);

  if (!photographer || (photographer as any).role !== 'PHOTOGRAPHER') {
    // Also check the full user object if we only got a partial select
    const fullUser = photographer?.id
      ? await prisma.user.findUnique({ where: { id: photographer.id }, select: { role: true } })
      : null;
    if (!fullUser || fullUser.role !== 'PHOTOGRAPHER') {
      notFound();
    }
  }

  const creditedProjects = await getPhotographerCreditedProjects(photographer!.id);

  // Increment view count
  await prisma.user.update({
    where: { id: photographer!.id },
    data: { views: { increment: 1 } },
  }).catch(() => {});

  return (
    <PhotographerProfile
      photographer={photographer as any}
      projects={creditedProjects}
    />
  );
}
