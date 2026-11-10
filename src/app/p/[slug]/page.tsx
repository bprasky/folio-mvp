import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Metadata } from "next";
import { getPostBySlug } from "@/lib/post/getPostBySlug";
import { StoryRenderer } from "@/components/story/StoryRenderer";
import { ProjectChannelLanding } from "@/components/story/ProjectChannelLanding";
import { titleCase } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import type { ChannelTile } from "@/lib/project-channel/curation";

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
  const designerLabel = titleCase(designer?.studio || designer?.name || "Folio");
  const title = `${project.title} | ${designerLabel} on Folio`;
  const description = excerpt || project.description || "Every room. Every source. The story behind the design.";
  const ogImageUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://folio.ad'}/api/og/project/${params.slug}`;

  return {
    title,
    description,
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
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://folio.ad'}/p/${params.slug}`,
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
  searchParams?: { room?: string; product?: string; ref?: string };
}) {
  const post = await getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  if (process.env.FOLIO_EDITORIAL_CHANNELS === 'true') {
    // Preserve existing room/product deep links by opening the nested feature.
    if (searchParams?.room || searchParams?.product) {
      const query = new URLSearchParams();
      for (const key of ['room', 'product', 'ref'] as const) {
        const value = searchParams?.[key];
        if (value) query.set(key, value);
      }
      redirect(`/p/${encodeURIComponent(params.slug)}/feature?${query.toString()}`);
    }
    const [modules, session, projectOwner] = await Promise.all([
      prisma.projectModule.findMany({
        where: { projectId: post.project.id, publishedAt: { not: null }, type: { in: ['STORY', 'SHORT_VIDEO', 'LONG_VIDEO'] } },
        select: { id: true, title: true, description: true, media: true, pinned: true },
        orderBy: { publishedAt: 'desc' }, take: 24,
      }),
      getServerSession(authOptions),
      prisma.project.findUnique({ where: { id: post.project.id }, select: { ownerId: true, designerId: true, designerOrgId: true } }),
    ]);
    const userId = session?.user?.id;
    const isDirectOwner = Boolean(userId && (projectOwner?.ownerId === userId || projectOwner?.designerId === userId));
    const isOrgOwner = Boolean(userId && projectOwner?.designerOrgId && await prisma.organizationUser.findFirst({
      where: { organizationId: projectOwner.designerOrgId, userId, isActive: true, role: { in: ['OWNER', 'ADMIN'] } },
      select: { id: true },
    }));
    const media: ChannelTile[] = modules.flatMap(module => {
      const raw = module.media;
      const assets = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
      const cover = assets.find(asset => asset && typeof asset === 'object' && !Array.isArray(asset) &&
        (typeof (asset as Record<string, unknown>).thumbnailUrl === 'string' || typeof (asset as Record<string, unknown>).imageUrl === 'string'));
      const candidate = cover as Record<string, unknown> | undefined;
      const imageUrl = candidate && (typeof candidate.thumbnailUrl === 'string' ? candidate.thumbnailUrl :
        typeof candidate.imageUrl === 'string' ? candidate.imageUrl : null);
      // Don't advertise a media player until a public playback destination exists.
      // Media metadata alone is not a working public link.
      if (!imageUrl) return [];
      return [{ id: module.id, kind: 'media' as const, title: module.title || 'Project media',
        imageUrl, href: `/p/${encodeURIComponent(params.slug)}/feature`, pinned: module.pinned }];
    });
    return <ProjectChannelLanding post={post} media={media} ownerView={isDirectOwner || isOrgOwner} />;
  }

  return <Suspense><StoryRenderer post={post} /></Suspense>;
}

