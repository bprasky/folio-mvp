"use client";

import { PostExpanded } from "./PostExpanded";
import { PostViewAnalytics } from "./PostViewAnalytics";
import { ProjectMediaHub } from "@/components/project/ProjectMediaHub";

interface PostViewProps {
  payload: any;
}

export function PostView({ payload }: PostViewProps) {
  const modules = payload.modules || [];
  const hasModules = modules.length > 0;

  return (
    <>
      <PostViewAnalytics
        postId={payload.post.id}
        postSlug={payload.post.slug}
        projectId={payload.project.id}
      />
      {hasModules ? (
        <ProjectMediaHub
          post={payload.post}
          modules={modules}
          article={payload.post.expandedBlocks}
          heroImage={payload.heroImage}
          tags={payload.tags}
          author={payload.designer ? { name: payload.designer.name || payload.designer.studio } : undefined}
          projectTitle={payload.project.title}
          images={payload.images}
        />
      ) : (
        <PostExpanded payload={payload} />
      )}
    </>
  );
}
