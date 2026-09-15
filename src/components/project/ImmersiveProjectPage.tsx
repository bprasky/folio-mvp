"use client";

import { Suspense } from "react";
import { StoryRenderer } from "@/components/story/StoryRenderer";
import { ShareToInstagramButton } from "@/components/instagram-export/ShareToInstagramButton";

type MediaModule = {
  id: string;
  type: "LONG_VIDEO" | string;
  title: string | null;
  description: string | null;
  media: any;
  publishedAt: string | Date | null;
  isAiCompiled?: boolean | null;
};

type Props = {
  post: any;
  modules: MediaModule[];
  isOwner?: boolean;
  showOwnerTools?: boolean;
};

export function ImmersiveProjectPage({ post, modules, isOwner = false, showOwnerTools = true }: Props) {
  return (
    <div className="relative min-h-screen bg-white">
      {/* Instagram export button — floated top-right */}
      {showOwnerTools && <div className="fixed top-4 right-4 z-40">
        <ShareToInstagramButton
          projectId={post.projectId}
          designerId={post.project?.designerId}
          postStatus={post.status}
        />
      </div>}

      {/* Story Format renderer */}
      <Suspense fallback={<StoryFallback />}>
        <StoryRenderer post={post} />
      </Suspense>
    </div>
  );
}

function StoryFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[rgba(87,75,67,0.3)] border-t-[rgba(87,75,67,0.8)] rounded-full animate-spin" />
    </div>
  );
}
