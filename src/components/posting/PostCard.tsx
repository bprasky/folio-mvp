"use client";

import Image from "next/image";
import Link from "next/link";

interface PostCardProps {
  post: any;
  project: any;
  heroImage: any;
  designer: any;
}

export function PostCard({ post, project, heroImage, designer }: PostCardProps) {
  return (
    <Link href={`/p/${post.slug}`} className="block group">
      <div className="overflow-hidden rounded-lg bg-[var(--bg-elevated)]">
        {heroImage?.url && (
          <Image
            src={heroImage.url}
            alt={project.title || "Project"}
            width={800}
            height={600}
            className="w-full h-auto transition-transform duration-200 group-hover:scale-105"
          />
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">
          {project.title}
        </h3>
        {post.excerpt && (
          <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2">
            {post.excerpt}
          </p>
        )}
        {designer && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            by {designer.name}
          </p>
        )}
      </div>
    </Link>
  );
}

