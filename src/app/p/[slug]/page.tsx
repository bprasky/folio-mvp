import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Metadata } from "next";
import { getPostBySlug } from "@/lib/post/getPostBySlug";
import { StoryRenderer } from "@/components/story/StoryRenderer";
import { ProjectChannelLanding } from "@/components/story/ProjectChannelLanding";
import { titleCase } from "@/lib/utils";
import { getPublicProjectModules } from '@/lib/modules/getProjectModules';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import type { ChannelTile } from "@/lib/project-channel/curation";
import { canPreviewProjectShop } from '@/lib/project-channel/access';
import { projectChannelHref, withChannelQuery, type ChannelSearchParams } from '@/lib/project-channel/links';
import { ProjectChannelShareTracking } from '@/components/story/ProjectChannelShareTracking';

// A published article is mutable after it is built: the designer edits its
// headline, deck, prose and pull quotes in place, and any of that can happen
// long after the page first rendered.
//
// Without these, the render lands in the Full Route Cache and is served from
// there indefinitely — there is no revalidation window, so the only thing that
// clears it is the next deployment. The page then looks like it "catches up
// with the database" whenever something is deployed, which is not a schedule
// anyone chose.
//
// Same three lines as /monograph/[username] and /photographer/[username], the
// other public pages backed by data their owner keeps changing.
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);

  if (!post) {
    return {
      title: "Project Not Found | Folio",
    };
  }

  const { project, excerpt } = post;
  const designer = project.designer;
  const designerLabel = titleCase(project.designerOrg?.name || designer?.studio || designer?.name || "Folio");
  const title = `${project.title} | ${designerLabel} on Folio`;
  const description = excerpt || project.description || "Every room. Every source. The story behind the design.";
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://folioad.com';
  const ogImageUrl = `${origin}/api/og/project/${encodeURIComponent(params.slug)}`;

  return {
    title,
    description,
    alternates: { canonical: `${origin}${projectChannelHref(params.slug)}` },
    openGraph: {
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${project.title}${designer?.name ? ` by ${designer.name}` : ''}`,
        },
      ],
      type: 'article',
      url: `${origin}${projectChannelHref(params.slug)}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function PostPage({
  params, searchParams,
}: {
  params: { slug: string };
  searchParams?: ChannelSearchParams;
}) {
  const post = await getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  if (process.env.FOLIO_EDITORIAL_CHANNELS === 'true') {
    // Preserve existing room/product deep links by opening the nested feature.
    if (searchParams?.room || searchParams?.product) {
      redirect(withChannelQuery(`${projectChannelHref(params.slug)}/feature`, searchParams));
    }
    const [modules, session] = await Promise.all([
      getPublicProjectModules(post.project.id, params.slug),
      getServerSession(authOptions),
    ]);
    const ownerView = await canPreviewProjectShop(post.project.id, session?.user?.id);
    const media: ChannelTile[] = modules.map(module => ({ id: module.id, kind: 'media', title: module.title || 'Project media',
      imageUrl: module.thumbnail, href: module.href, pinned: module.pinned || module.isPrimary, unoptimized: true }));
    return <><Suspense><ProjectChannelShareTracking projectId={post.project.id} slug={post.slug} /></Suspense>
      <ProjectChannelLanding post={post} media={media} ownerView={ownerView} searchParams={searchParams} /></>;
  }

  return <Suspense><StoryRenderer post={post} /></Suspense>;
}

