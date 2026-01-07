// src/app/feed/ui/cards.tsx

"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";

type Post = {
  id: string;
  slug: string | null;
  title: string | null;
  deck: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  designer: {
    id: string;
    name: string;
    studio: string | null;
    profileImage: string | null;
    location: string | null;
  } | null;
  project: { id: string; name: string | null; heroImage: string | null } | null;
};

function DesignerLogoChip({
  url,
  name,
}: {
  url?: string | null;
  name?: string | null;
}) {
  if (!url) return null; // no logo? no chip.

  return (
    <div className="absolute right-3 top-3 rounded-xl bg-white/80 backdrop-blur-lg shadow-md ring-1 ring-white/30 p-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={name ? `${name} logo` : "Designer logo"}
        className="h-8 w-8 object-contain"
        decoding="async"
        loading="lazy"
      />
    </div>
  );
}

export function FeedHeroCard({ post, 'data-demo-id': dataDemoId }: { post: Post; 'data-demo-id'?: string }) {
  const img = post.coverImage ?? post.project?.heroImage ?? "";
  const bylineName = post?.designer?.studio || post?.designer?.name || null;
  const projectId = post.project?.id;

  return (
    <article className="group" data-demo-id={dataDemoId}>
      <Link href={projectId ? `/project/${projectId}` : "#"} className="block">
        <GlassCard 
          variant="default" 
          padding="none" 
          rounded="2xl"
          className="overflow-hidden hover:shadow-xl transition-shadow duration-300"
        >
          <div className="relative aspect-[3/2] w-full overflow-hidden">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={post.title ?? post.project?.name ?? "Project"}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                decoding="async"
              />
            ) : (
              <div className="h-full w-full bg-gray-100" />
            )}
            {/* Optional logo chip (only if profileImage exists) */}
            <DesignerLogoChip
              url={post?.designer?.profileImage}
              name={bylineName || undefined}
            />
          </div>
          <div className="p-5 space-y-2">
            <h2 className="font-serif text-xl italic text-gray-900 line-clamp-1">
              {post.title ?? post.project?.name ?? "Untitled Project"}
            </h2>
            {bylineName && post?.designer?.id ? (
              <Link
                href={`/designer/${post.designer.id}`}
                className="text-sm italic text-gray-600 hover:text-gray-900 transition-colors block"
                onClick={(e) => e.stopPropagation()}
              >
                by {bylineName}
              </Link>
            ) : bylineName ? (
              <p className="text-sm italic text-gray-600">by {bylineName}</p>
            ) : null}
            {post.deck && (
              <p className="text-sm text-gray-600 line-clamp-2 mt-2">{post.deck}</p>
            )}
            {/* Badges can be injected later (e.g., Folio House, Awards, AI Recommended) */}
          </div>
        </GlassCard>
      </Link>
    </article>
  );
}

export function FeedGridCard({ post }: { post: Post }) {
  const img = post.coverImage ?? post.project?.heroImage ?? "";
  const bylineName = post?.designer?.studio || post?.designer?.name || null;
  const projectId = post.project?.id;

  return (
    <article className="group">
      <Link href={projectId ? `/project/${projectId}` : "#"} className="block">
        <GlassCard 
          variant="default" 
          padding="none" 
          rounded="2xl"
          className="overflow-hidden hover:shadow-xl transition-shadow duration-300"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={post.title ?? post.project?.name ?? "Project"}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                decoding="async"
              />
            ) : (
              <div className="h-full w-full bg-gray-100" />
            )}
            {/* Optional logo chip (only if profileImage exists) */}
            <DesignerLogoChip
              url={post?.designer?.profileImage}
              name={bylineName || undefined}
            />
          </div>
          <div className="p-5 space-y-2">
            <h3 className="font-serif text-lg italic text-gray-900 line-clamp-1">
              {post.title ?? post.project?.name ?? "Untitled Project"}
            </h3>
            {bylineName && post?.designer?.id ? (
              <Link
                href={`/designer/${post.designer.id}`}
                className="text-sm italic text-gray-600 hover:text-gray-900 transition-colors block"
                onClick={(e) => e.stopPropagation()}
              >
                by {bylineName}
              </Link>
            ) : bylineName ? (
              <p className="text-sm italic text-gray-600">by {bylineName}</p>
            ) : null}
            {post.deck && (
              <p className="text-sm text-gray-600 line-clamp-2 mt-2">{post.deck}</p>
            )}
            {/* Reserved badge slot */}
          </div>
        </GlassCard>
      </Link>
    </article>
  );
}

