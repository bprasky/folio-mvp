import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPostBySlug } from "@/lib/post/getPostBySlug";
import { ImmersiveProjectPage } from "@/components/project/ImmersiveProjectPage";
import { titleCase } from "@/lib/utils";

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

  return <ImmersiveProjectPage post={post} modules={post.modules} />;
}

