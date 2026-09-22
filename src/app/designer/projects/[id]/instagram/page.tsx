import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getStudioData, StudioAccessError } from '@/lib/publishing-studio/data';
import { preparedConfig } from '@/lib/publishing-studio/feed';
import { InstagramExportEditor } from '@/components/instagram-export/InstagramExportEditor';

export default async function InstagramExportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { export?: string; studio?: string; proposal?: string; revision?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      images: {
        include: {
          tags: { include: { product: true } },
        },
        orderBy: { displayOrder: 'asc' },
      },
      post: true,
      rooms: true,
    },
  });

  if (!project || !project.post || project.post.status !== 'PUBLISHED') {
    redirect('/designer');
  }

  try {
    await assertProjectWrite(session.user.id, project.id);
  } catch {
    redirect(`/p/${project.post.slug}`);
  }

  const designer = await prisma.user.findUnique({
    where: { id: project.designerId || project.ownerId },
    include: { brandProfile: true },
  });

  const initialExport = searchParams.export ? await prisma.instagramExport.findFirst({
    where: { id: searchParams.export, projectId: project.id, designerId: session.user.id },
    select: { id: true, config: true, headline: true, bioText: true, caption: true, updatedAt: true },
  }) : null;
  if (searchParams.export && !initialExport) notFound();

  let initialPreview = null;
  if (!initialExport && searchParams.proposal) {
    try {
      const studio = await getStudioData(session.user.id, project.id);
      const card = studio.feed.find(item => item.id === searchParams.proposal);
      if (!card || card.revision !== searchParams.revision || card.kind !== 'suggestion' || !card.canPolish || !card.imageUrl || card.projectIds.length !== 1 || card.projectIds[0] !== project.id) notFound();
      initialPreview = { config: { ...preparedConfig(card), studioRevision: card.revision }, headline: card.title, caption: card.caption };
    } catch (error) {
      if (error instanceof StudioAccessError) notFound();
      throw error;
    }
  }

  // Older prepared drafts predate the pitch/options fields. Reuse exactly the
  // source-backed proposal shown in Studio, without replacing any saved edits.
  const savedConfig = initialExport?.config && typeof initialExport.config === 'object' && !Array.isArray(initialExport.config)
    ? { ...initialExport.config } as Record<string, unknown> : {};
  for (const field of ['headlineOptions', 'captionOptions', 'beats'] as const) {
    if (Array.isArray(savedConfig[field])) {
      savedConfig[field] = savedConfig[field].filter((value): value is string => typeof value === 'string' && value.length <= 5000).slice(0, 10);
    }
  }
  const proposalFields = ['pitch', 'rationale', 'beats', 'headlineOptions', 'captionOptions'] as const;
  if (initialExport && proposalFields.some((field) => savedConfig[field] == null)) {
    try {
      const studio = await getStudioData(session.user.id, project.id);
      const card = studio.feed.find((item) => item.exportId === initialExport.id);
      if (card) for (const field of proposalFields) {
        if (savedConfig[field] == null && card[field] !== undefined) savedConfig[field] = card[field];
      }
    } catch (error) {
      // A direct project link can remain authorized outside the active Studio
      // workspace. It must not reveal that workspace's proposal metadata.
      if (!(error instanceof StudioAccessError)) throw error;
    }
  }

  // Serialize data for client component
  const serializedProject = {
    id: project.id,
    title: project.title,
    description: project.description,
    designerId: project.designerId,
    ownerId: project.ownerId,
  };

  const serializedPost = {
    id: project.post.id,
    slug: project.post.slug,
    status: project.post.status,
    expandedBlocks: project.post.expandedBlocks,
    excerpt: project.post.excerpt,
  };

  const serializedDesigner = designer
    ? {
        id: designer.id,
        name: designer.name,
        studio: designer.studio,
        companyName: designer.companyName,
        title: designer.title,
        bio: designer.bio,
        profileImage: designer.profileImage,
        specialties: designer.specialties,
      }
    : null;

  const serializedImages = project.images.map((img) => ({
    id: img.id,
    url: img.url,
    name: img.name,
    room: img.room,
    roomId: img.roomId,
  }));

  const serializedRooms = project.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    type: room.type,
  }));

  return (
    <InstagramExportEditor
      key={initialExport?.id ?? (initialPreview ? `${searchParams.proposal}:${searchParams.revision}` : project.id)}
      initialPreview={initialPreview}
      initialExport={initialExport ? { ...initialExport, config: savedConfig, updatedAt: initialExport.updatedAt.toISOString() } : null}
      studioScope={searchParams.studio === 'all' ? 'all' : 'project'}
      project={serializedProject}
      post={serializedPost}
      designer={serializedDesigner}
      images={serializedImages}
      rooms={serializedRooms}
    />
  );
}
