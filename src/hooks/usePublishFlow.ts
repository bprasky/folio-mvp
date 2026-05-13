"use client";

import { useState, useMemo, useEffect, useCallback } from "react";

export type DraftVersion = {
  id: string;
  createdAt: string;
  status: string;
  slug?: string;
  lead?: { kicker?: string; title?: string; deck?: string; dek?: string };
  sections?: any[];
};

export interface UsePublishFlowReturn {
  // Data
  data: { interview: any; drafts: DraftVersion[] } | null;
  currentPost: DraftVersion | undefined;
  currentLead: { kicker?: string; title?: string; deck?: string; dek?: string } | undefined;
  currentSections: any[];

  // Readiness
  heroAssetId: string | null;
  hasCredits: boolean;
  isLoading: boolean;

  // Actions
  generateDraft: () => Promise<void>;
  publish: () => Promise<{ slug: string | null }>;
  unpublish: () => Promise<{ ok: boolean }>;
  refetch: () => Promise<void>;

  // Context toggles
  contextToggles: {
    includeBio: boolean;
    includeProjectHistory: boolean;
  };
  setContextToggle: (key: 'includeBio' | 'includeProjectHistory', value: boolean) => void;
  generationMeta: {
    designerBioMissing?: boolean;
    hasProjectHistory?: boolean;
    hasAtelierFingerprint?: boolean;
  } | null;

  // Action state
  regenBusy: boolean;
  isPublishing: boolean;
  isUnpublishing: boolean;
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
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Context toggles for editorial generation
  const [contextToggles, setContextToggles] = useState({
    includeBio: true,
    includeProjectHistory: true,
  });
  const [generationMeta, setGenerationMeta] = useState<{
    designerBioMissing?: boolean;
    hasProjectHistory?: boolean;
    hasAtelierFingerprint?: boolean;
  } | null>(null);

  const setContextToggle = useCallback((key: 'includeBio' | 'includeProjectHistory', value: boolean) => {
    setContextToggles(prev => ({ ...prev, [key]: value }));
  }, []);

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
  // Normalize lead: composeEditorialHard generates { kicker, deck } but
  // downstream consumers (PublishPreviewModal) expect { title, deck }.
  // Map kicker → title and dek → deck so hasDraft checks work correctly.
  const currentLead = useMemo(() => {
    const lead = currentPost?.lead;
    if (!lead) return lead;
    return {
      ...lead,
      title: lead.title || lead.kicker,
      deck: lead.deck || lead.dek,
    };
  }, [currentPost]);
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
              prompt: a.prompt || a.question || "",
              section: a.section,
              role: "DESIGNER",
              isFollowUp: false,
            }));
          }
          if (interviewData.followUps?.length > 0) {
            followupsToSend = interviewData.followUps.map((f: any) => ({
              questionId: f.questionId || f.id,
              prompt: f.prompt || f.question || "",
              answer: f.answer || "",
              section: f.section,
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
        includeBio: contextToggles.includeBio,
        includeProjectHistory: contextToggles.includeProjectHistory,
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
        const json = await res.json().catch(() => ({}));
        console.warn("[usePublishFlow] Generate returned 202 (no-op)", json);
        setError(
          `Regenerate did not run: ${json?.status || "in_progress"}. Wait a moment and try again. [HTTP 202]`,
        );
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("[usePublishFlow] Generation failed", {
          status: res.status,
          code: json?.code,
          error: json?.error,
          message: json?.message,
        });
        const baseMessage =
          json?.message || json?.error || `Generation failed (${res.status})`;
        const codeSuffix = json?.code ? ` [${json.code}]` : ` [HTTP ${res.status}]`;
        setError(`${baseMessage}${codeSuffix}`);
        return;
      }

      // Capture generation meta (bio missing, project history, fingerprint flags)
      const responseJson = await res.json().catch(() => ({}));
      if (responseJson?.meta) {
        setGenerationMeta(responseJson.meta);
      }

      await fetchData();
    } catch (err: any) {
      console.error("[usePublishFlow] Generate failed", err);
      setError(err.message || "Failed to generate draft");
    } finally {
      setRegenBusy(false);
    }
  }, [projectId, fetchData, contextToggles]);

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

  const unpublish = useCallback(async (): Promise<{ ok: boolean }> => {
    try {
      setIsUnpublishing(true);
      setError(null);

      const res = await fetch(
        `/api/posting/project/${projectId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unpublish" }),
        }
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || json.message || "Failed to unpublish");
      }

      setPublishSuccess(false);
      setPublishedSlug(null);
      return { ok: true };
    } catch (err: any) {
      console.error("[usePublishFlow] Unpublish failed:", err);
      setError(err.message || "Failed to unpublish");
      return { ok: false };
    } finally {
      setIsUnpublishing(false);
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
    contextToggles,
    setContextToggle,
    generationMeta,
    generateDraft,
    publish,
    unpublish,
    refetch,
    regenBusy,
    isPublishing,
    isUnpublishing,
    publishSuccess,
    publishedSlug,
    error,
  };
}
