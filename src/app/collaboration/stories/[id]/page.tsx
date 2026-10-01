import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertCollaborationStoryEdit } from '@/lib/collaboration/auth';
import { CollaborationInterviewWorkspace } from '@/components/collaboration/CollaborationInterviewWorkspace';

export const dynamic = 'force-dynamic';
export default async function CollaborationInterviewPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=' + encodeURIComponent(`/collaboration/stories/${params.id}`));
  const access = await assertCollaborationStoryEdit(session.user.id, params.id).catch(() => null);
  if (!access || (access.role !== 'vendor' && access.role !== 'designer')) notFound();
  const story = await prisma.collaborationStory.findUnique({ where: { id: params.id }, include: {
    vendorOrg: { select: { id: true, name: true, logo: true, description: true } }, designer: { select: { name: true } },
  } });
  if (!story || story.status === 'ARCHIVED') notFound();
  return <main className="mx-auto max-w-5xl px-4 py-8"><CollaborationInterviewWorkspace storyId={story.id} role={access.role}
    status={story.status} vendorOrg={story.vendorOrg} designerName={story.designer.name || 'Designer'} invitedAt={story.invitedAt.toISOString()} /></main>;
}
