import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectMediaPage({ params }: { params: { slug: string; moduleId: string } }) {
  if (process.env.FOLIO_EDITORIAL_CHANNELS !== 'true') notFound();
  const module = await prisma.projectModule.findFirst({
    where: { id: params.moduleId, publishedAt: { not: null }, type: { in: ['STORY', 'SHORT_VIDEO', 'LONG_VIDEO'] },
      project: { isPublic: true, post: { status: 'PUBLISHED', slug: params.slug } } },
    select: { title: true, description: true, media: true },
  });
  if (!module) notFound();
  const raw = module.media;
  const assets = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const video = assets.find(asset => asset && typeof asset === 'object' && !Array.isArray(asset) &&
    typeof (asset as Record<string, unknown>).url === 'string');
  const url = video && (video as Record<string, unknown>).url;
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) notFound();
  return <main className="min-h-screen bg-[#171715] px-5 py-8 text-[#f4efe7] sm:px-10">
    <Link href={`/p/${encodeURIComponent(params.slug)}`} className="inline-flex min-h-11 items-center text-sm underline">← Back to project</Link>
    <div className="mx-auto mt-10 max-w-5xl">
      <h1 className="font-serif text-4xl">{module.title || 'Project media'}</h1>
      {module.description && <p className="my-5 max-w-2xl text-white/75">{module.description}</p>}
      <video src={url} controls preload="metadata" playsInline className="mt-8 w-full rounded-lg bg-black" />
    </div>
  </main>;
}
