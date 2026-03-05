import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import PublishWorkflow from './PublishWorkflow';

/**
 * Publish Page - Primary entry point for COMPLETED projects
 * 
 * This page guides designers through the publication workflow:
 * 1. Review project summary
 * 2. Preview editorial draft
 * 3. Publish to feed
 * 
 * Completed projects route here first; Overview is the fallback.
 */
export default async function PublishPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;
  const viewerRole = (session as any)?.user?.role ?? 'GUEST';

  // Fetch project with images and tags
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      city: true,
      regionState: true,
      isPublic: true,
      publishedAt: true,
      ownerId: true,
      designerId: true,
      images: {
        select: {
          id: true,
          url: true,
          name: true,
          room: true,
          tags: {
            select: {
              id: true,
              product: {
                select: { id: true, name: true, brand: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
      },
      rooms: {
        select: { id: true, name: true },
      },
      post: {
        select: { id: true, status: true, slug: true },
      },
    },
  });

  if (!project) {
    notFound();
  }

  // Verify ownership
  const isOwner = 
    viewerRole === 'ADMIN' ||
    (!!viewerId && (viewerId === project.ownerId || viewerId === project.designerId));

  if (!isOwner) {
    notFound();
  }

  // If already published, redirect to story view
  // Use ProjectPost.status as the single source of truth (not Project.publishedAt)
  if (project.post?.status === 'PUBLISHED') {
    redirect(`/project/${params.id}?view=story`);
  }

  // Calculate readiness
  const imageCount = project.images.length;
  const tagCount = project.images.reduce((sum, img) => sum + img.tags.length, 0);
  const roomCount = project.rooms.length;

  return (
    <PublishWorkflow 
      project={{
        id: project.id,
        title: project.title,
        description: project.description,
        city: project.city,
        regionState: project.regionState,
        isPublic: project.isPublic,
        publishedAt: project.publishedAt,
      }}
      images={project.images}
      readiness={{
        imageCount,
        tagCount,
        roomCount,
        isReady: imageCount > 0 && tagCount > 0,
      }}
      existingPost={project.post}
    />
  );
}





