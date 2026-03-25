"use client";

import { CreditsSection } from "@/components/project/CreditsSection";

interface Props {
  post: any;
}

export function StoryCredits({ post }: Props) {
  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-0 py-12">
      <div className="story-glass-card p-6 md:p-8">
        <CreditsSection post={post} />
      </div>
    </div>
  );
}
