import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CHANNEL_MEDIA_TYPES, normalizeChannelMedia } from '@/lib/project-channel/media';
import { ProjectChannelMedia } from '@/components/story/ProjectChannelMedia';
import { projectChannelHref } from '@/lib/project-channel/links';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectMediaPage({ params }: { params: { slug: string; moduleId: string } }) {
  if (process.env.FOLIO_EDITORIAL_CHANNELS !== 'true') notFound();
  const projectModule = await prisma.projectModule.findFirst({
    where: { id: params.moduleId, publishedAt: { lte: new Date() }, type: { in: [...CHANNEL_MEDIA_TYPES] },
      project: { isPublic: true, post: { is: { status: 'PUBLISHED', slug: params.slug } } } },
    select: { type: true, title: true, description: true, media: true },
  });
  if (!projectModule) notFound();
  const media = normalizeChannelMedia(projectModule.type, projectModule.media);
  if (!media.assets.length) notFound();
  return <main className="min-h-screen bg-[var(--surface-canvas)] px-5 py-8 text-[var(--folio-text-primary)] sm:px-10">
    <Link href={projectChannelHref(params.slug)} className="inline-flex min-h-11 items-center text-sm underline">← Back to project</Link>
    <div className="mx-auto mt-10 max-w-5xl">
      <h1 className="break-words font-serif text-4xl text-[var(--folio-text-primary)]">{projectModule.title || 'Project media'}</h1>
      {projectModule.description && <p className="my-5 max-w-2xl text-[var(--folio-text-secondary)]">{projectModule.description}</p>}
      <ProjectChannelMedia assets={media.assets} title={projectModule.title || 'Project media'} />
    </div>
  </main>;
}
