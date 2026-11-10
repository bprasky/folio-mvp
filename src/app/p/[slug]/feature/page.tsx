import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { getPostBySlug } from '@/lib/post/getPostBySlug';
import { StoryRenderer } from '@/components/story/StoryRenderer';
import { projectChannelHref, withChannelQuery, type ChannelSearchParams } from '@/lib/project-channel/links';
import { generateMetadata as channelMetadata } from '../page';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const metadata = await channelMetadata({ params });
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://folioad.com'}${projectChannelHref(params.slug)}/feature`;
  return { ...metadata, alternates: { canonical: url }, openGraph: { ...metadata.openGraph, url } };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectFeaturePage({ params, searchParams }: { params: { slug: string }; searchParams?: ChannelSearchParams }) {
  // Preserve the original publication URL while the new channel is disabled.
  if (process.env.FOLIO_EDITORIAL_CHANNELS !== 'true') redirect(withChannelQuery(projectChannelHref(params.slug), searchParams));
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();
  return (
    <main className="min-h-screen">
      <nav aria-label="Project navigation" className="sticky top-0 z-20 flex min-h-14 items-center border-b border-white/10 bg-[#171715] px-5 text-[#f4efe7] sm:px-10">
        <Link href={`/p/${encodeURIComponent(params.slug)}`} className="inline-flex min-h-11 items-center text-sm hover:underline focus-visible:outline focus-visible:outline-2">
          <span aria-hidden="true" className="mr-3">←</span> Back to project
        </Link>
        <span className="ml-auto max-w-[45%] truncate font-serif text-sm sm:text-lg">{post.project.title}</span>
      </nav>
      <Suspense><StoryRenderer post={post} /></Suspense>
    </main>
  );
}
