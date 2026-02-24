"use client";

import { useState, useMemo, useEffect, useCallback } from "react";

export type DraftVersion = {
  id: string;
  createdAt: string;
  status: string;
  slug?: string;
  lead?: { kicker?: string; title?: string; deck?: string };
  sections?: any[];
};

export interface UsePublishFlowReturn {
  // Data
  data: { interview: any; drafts: DraftVersion[] } | null;
  currentPost: DraftVersion | undefined;
  currentLead: { kicker?: string; title?: string; deck?: string } | undefined;
  currentSections: any[];

  // Readiness
  heroAssetId: string | null;
  hasCredits: boolean;
  isLoading: boolean;

  // Actions
  generateDraft: () => Promise<void>;
  publish: () => Promise<{ slug: string | null }>;
  refetch: () => Promise<void>;

  // Action state
  regenBusy: boolean;
  isPublishing: boolean;
  publishSuccess: boolean;
  publishedSlug: string | null;
  error: string | null;
}

export function usePublishFlow(projectId: string): UsePublishFlowReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<{
    interview: any;
    drafts: DraftVersion[];
  } | null>(null);
  const [regenBusy, setRegenBusy] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Readiness state
  const [heroAssetId, setHeroAssetId] = useState<string | null>(null);
  const [hasCredits, setHasCredits] = useState(false);

  // Fetch draft data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/posting/project/${projectId}/drafts`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error("[usePublishFlow] Fetch failed", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Fetch hero asset and credits for readiness checks
  const fetchReadiness = useCallback(async () => {
    try {
      const postRes = await fetch(`/api/posting/project/${projectId}`);
      if (postRes.ok) {
        const postData = await postRes.json();
        setHeroAssetId(postData.post?.heroAssetId || null);
        if (postData.post?.status === "PUBLISHED") {
          setPublishSuccess(true);
          setPublishedSlug(postData.post?.slug || null);
        }
      }

      const creditsRes = await fetch(`/api/posting/project/${projectId}/credits`);
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        setHasCredits(
          (creditsData.credits || []).some(
            (c: any) => c.role.toLowerCase() !== "designer"
          )
        );
      }
    } catch (err) {
      console.error("[usePublishFlow] Readiness fetch failed:", err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
    fetchReadiness();
  }, [fetchData, fetchReadiness]);

  const currentPost = useMemo(() => data?.drafts?.[0], [data]);
  const currentLead = useMemo(() => currentPost?.lead, [currentPost]);
  const currentSections = useMemo(() => {
    const sections = currentPost?.sections ?? [];
    return Array.isArray(sections) ? sections : [];
  }, [currentPost]);

  const generateDraft = useCallback(async () => {
    try {
      setRegenBusy(true);
      setError(null);

      // Fetch latest answers to send as override
      let answersToSend: any[] = [];
      let followupsToSend: any[] = [];

      try {
        const interviewRes = await fetch(
          `/api/posting/project/${projectId}/interview`
        );
        if (interviewRes.ok) {
          const interviewData = await interviewRes.json();
          if (interviewData.answers?.length > 0) {
            answersToSend = interviewData.answers.map((a: any) => ({
              questionId: a.questionId || a.id,
              answer: a.answer || "",
              question: a.question || a.prompt || "",
              section: a.section,
              role: "DESIGNER",
              isFollowUp: false,
            }));
          }
          if (interviewData.followUps?.length > 0) {
            followupsToSend = interviewData.followUps.map((f: any) => ({
              questionId: f.questionId || f.id,
              question: f.question || f.prompt || "",
              answer: f.answer || "",
              role: "DESIGNER",
              isFollowUp: true,
            }));
          }
        }
      } catch (fetchErr) {
        console.warn("[usePublishFlow] Interview fetch failed:", fetchErr);
      }

      const url = `/api/posting/project/${projectId}/interview/generate?forceOverwriteDraft=true&mode=recomposition`;
      const payload: any = {
        source: "guided_publish",
        forceOverwriteDraft: true,
        mode: "recomposition",
      };

      if (answersToSend.length > 0) {
        payload.answersOverride = answersToSend;
      }
      if (followupsToSend.length > 0) {
        payload.followupsOverride = followupsToSend;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      if (res.status === 202) {
        // Draft already exists — that's fine, we'll fetch it
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const errorMessage =
          json?.error || json?.message || `Generation failed (${res.status})`;
        setError(errorMessage);
        return;
      }

      await fetchData();
    } catch (err: any) {
      console.error("[usePublishFlow] Generate failed", err);
      setError(err.message || "Failed to generate draft");
    } finally {
      setRegenBusy(false);
    }
  }, [projectId, fetchData]);

  const publish = useCallback(async (): Promise<{ slug: string | null }> => {
    try {
      setIsPublishing(true);
      setError(null);

      const res = await fetch(
        `/api/projects/${projectId}/approvals/publish-editorial`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to publish");
      }

      const result = await res.json();
      setPublishSuccess(true);
      setPublishedSlug(result.slug || null);
      return { slug: result.slug || null };
    } catch (err: any) {
      console.error("[usePublishFlow] Publish failed:", err);
      setError(err.message || "Failed to publish");
      return { slug: null };
    } finally {
      setIsPublishing(false);
    }
  }, [projectId]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchData(), fetchReadiness()]);
  }, [fetchData, fetchReadiness]);

  return {
    data,
    currentPost,
    currentLead,
    currentSections,
    heroAssetId,
    hasCredits,
    isLoading,
    generateDraft,
    publish,
    refetch,
    regenBusy,
    isPublishing,
    publishSuccess,
    publishedSlug,
    error,
  };
}
