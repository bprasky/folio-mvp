import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Metadata } from "next";
import { getPostBySlug } from "@/lib/post/getPostBySlug";
import { StoryRenderer } from "@/components/story/StoryRenderer";
import { titleCase } from "@/lib/utils";

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
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <Suspense>
      <StoryRenderer post={post} />
    </Suspense>
  );
}

