import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { InstagramExportEditor } from '@/components/instagram-export/InstagramExportEditor';

export default async function InstagramExportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { export?: string; studio?: string };
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
      key={initialExport?.id ?? project.id}
      initialExport={initialExport ? { ...initialExport, updatedAt: initialExport.updatedAt.toISOString() } : null}
      studioScope={searchParams.studio === 'all' ? 'all' : 'project'}
      project={serializedProject}
      post={serializedPost}
      designer={serializedDesigner}
      images={serializedImages}
      rooms={serializedRooms}
    />
  );
}
