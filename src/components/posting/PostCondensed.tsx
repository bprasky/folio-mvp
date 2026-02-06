"use client";

import Image from "next/image";
import { TagRail } from "./TagRail";

interface PostCondensedProps {
  payload: any;
}

export function PostCondensed({ payload }: PostCondensedProps) {
  const { post, project, heroImage, tags, designer } = payload;

  return (
    <article className="max-w-4xl mx-auto">
      {heroImage && (
        <div className="relative aspect-[16/9] overflow-hidden rounded-lg mb-6">
          <Image
            src={heroImage.url}
            alt={project.title || "Project"}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          {project.title}
        </h1>
        {post.excerpt && (
          <p className="text-lg text-[var(--text-secondary)]">{post.excerpt}</p>
        )}
        {designer && (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">
            by {designer.name}
            {designer.studio && ` • ${designer.studio}`}
          </p>
        )}
      </header>
      {tags && tags.length > 0 && <TagRail tags={tags} />}
    </article>
  );
}

