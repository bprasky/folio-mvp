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
      <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-gray-100">
        {heroImage?.url && (
          <Image
            src={heroImage.url}
            alt={project.title || "Project"}
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-105"
          />
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-gray-700">
          {project.title}
        </h3>
        {post.excerpt && (
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
            {post.excerpt}
          </p>
        )}
        {designer && (
          <p className="mt-2 text-xs text-gray-500">
            by {designer.name}
          </p>
        )}
      </div>
    </Link>
  );
}

