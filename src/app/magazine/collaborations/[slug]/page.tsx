export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CollaborationStoryView } from '@/components/collaboration/CollaborationStoryView';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps) {
  const story = await prisma.collaborationStory.findUnique({
    where: { slug: params.slug },
    select: {
      title: true,
      excerpt: true,
      heroImageUrl: true,
      vendorOrg: { select: { name: true } },
      designer: { select: { name: true } },
    },
  });

  if (!story) {
    return { title: 'Collaboration Not Found' };
  }

  const title = story.title || `${story.vendorOrg.name} × ${story.designer.name}`;
  const description = story.excerpt || `A collaboration story between ${story.vendorOrg.name} and ${story.designer.name}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: story.heroImageUrl ? [{ url: story.heroImageUrl }] : [],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: story.heroImageUrl ? [story.heroImageUrl] : [],
    },
  };
}

export default async function CollaborationStoryPage({ params }: PageProps) {
  const story = await prisma.collaborationStory.findUnique({
    where: { slug: params.slug },
    include: {
      vendorOrg: {
        select: {
          id: true,
          name: true,
          logo: true,
        },
      },
      designer: {
        select: {
          id: true,
          name: true,
          profileImage: true,
        },
      },
    },
  });

  if (!story) {
    notFound();
  }

  // Only show published stories
  if (story.status !== 'PUBLISHED') {
    notFound();
  }

  // Parse the finalContent blocks
  const blocks = (story.finalContent as any[]) || [];

  return (
    <div className="min-h-screen bg-[#F6F4F1]">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <CollaborationStoryView
          story={{
            id: story.id,
            slug: story.slug,
            title: story.title || `${story.vendorOrg.name} × ${story.designer.name}`,
            excerpt: story.excerpt || '',
            heroImageUrl: story.heroImageUrl,
            finalContent: blocks,
            publishedAt: story.publishedAt?.toISOString() || story.createdAt.toISOString(),
            vendorOrg: {
              id: story.vendorOrg.id,
              name: story.vendorOrg.name,
              logo: story.vendorOrg.logo,
            },
            designer: {
              id: story.designer.id,
              name: story.designer.name,
              profileImage: story.designer.profileImage,
            },
          }}
        />
      </div>
    </div>
  );
}
