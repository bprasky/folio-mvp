"use client";

import Image from '@/components/FolioImage';
import { TagRail } from "./TagRail";

interface PostCondensedProps {
  payload: any;
}

export function PostCondensed({ payload }: PostCondensedProps) {
  const { post, project, heroImage, tags, designer } = payload;

  return (
    <article className="max-w-4xl mx-auto">
      {heroImage && (
        <div className="overflow-hidden rounded-lg mb-6">
          <Image
            src={heroImage.url}
            alt={project.title || "Project"}
            width={1200}
            height={675}
            className="w-full h-auto"
            priority
          />
        </div>
      )}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-folio-text-primary mb-2">
          {project.title}
        </h1>
        {post.excerpt && (
          <p className="text-lg text-folio-text-secondary">{post.excerpt}</p>
        )}
        {designer && (
          <p className="mt-4 text-sm text-folio-text-secondary">
            by {designer.name}
            {designer.studio && ` • ${designer.studio}`}
          </p>
        )}
      </header>
      {tags && tags.length > 0 && <TagRail tags={tags} />}
    </article>
  );
}

