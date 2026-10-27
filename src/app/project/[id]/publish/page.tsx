import { assertProjectView, assertProjectWrite, assertProjectPublish } from '@/lib/authz/access';
import { computePublishReadiness, isDocumentImage } from '@/lib/publish/computePublishReadiness';
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
          room: true, roomId: true, inclusion: true, noProducts: true,
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

  if (!viewerId) notFound();
  try { await assertProjectView(viewerId, project.id); }
  catch (error) { if (error instanceof Error && error.message === 'Forbidden') notFound(); throw error; }
  let canEdit = false, canPublish = false;
  try { await assertProjectWrite(viewerId, project.id); canEdit = true; }
  catch (error) { if (!(error instanceof Error) || error.message !== 'Forbidden') throw error; }
  try { await assertProjectPublish(viewerId, project.id); canPublish = true; }
  catch (error) { if (!(error instanceof Error) || error.message !== 'Forbidden') throw error; }

  // If already published, redirect to story view
  // Use ProjectPost.status as the single source of truth (not Project.publishedAt)
  if (project.post?.status === 'PUBLISHED') {
    redirect(`/project/${params.id}?view=story`);
  }

  // Calculate readiness
  const photos = project.images.filter(image => !isDocumentImage(image.name) && image.inclusion !== 'EXCLUDED');
  const canonical = computePublishReadiness({ photos: photos.map(image => ({ ...image, tagCount: image.tags.length })),
    roomCount: project.rooms.length, storyComplete: !!project.post });
  const imageCount = photos.length;
  const tagCount = photos.reduce((sum, img) => sum + img.tags.length, 0);
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
      images={photos}
      canEdit={canEdit}
      canPublish={canPublish}
      readiness={{
        imageCount,
        tagCount,
        roomCount,
        isReady: canonical.canPublish,
      }}
      existingPost={project.post}
    />
  );
}





