"use client";

import { useEffect } from "react";
import { logPostView } from "@/app/actions/posting";

interface PostViewAnalyticsProps {
  postId: string;
  postSlug: string;
  projectId: string;
}

export function PostViewAnalytics({ postId, postSlug, projectId }: PostViewAnalyticsProps) {
  useEffect(() => {
    logPostView(postId, postSlug, projectId);
  }, [postId, postSlug, projectId]);

  return null;
}

