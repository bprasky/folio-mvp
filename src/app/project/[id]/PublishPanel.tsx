"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react";

interface ProductTag {
  id: string;
  x: number;
  y: number;
  product: {
    id: string;
    name: string;
    imageUrl?: string;
  };
}

interface ProjectImage {
  id: string;
  url: string;
  name?: string;
  room?: string;
  tags: ProductTag[];
}

type QA = {
  q?: string;
  a?: string;
  question?: string;
  answer?: string;
  questionId?: string;
  section?: string;
};

type DraftVersion = {
  id: string;
  createdAt: string;
  status: string;
  slug?: string;
  lead?: { kicker?: string; title?: string; deck?: string };
  sections?: any[];
};

interface PublishPanelProps {
  projectId: string;
  project: { id: string; title: string };
  images: ProjectImage[];
  isOwner: boolean;
}

export default function PublishPanel({ projectId, project, images, isOwner }: PublishPanelProps) {
  const router = useRouter();
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
  const [checklistExpanded, setChecklistExpanded] = useState(true);

  // Fetch draft data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/posting/project/${projectId}/drafts`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error("[PublishPanel] Fetch failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch hero asset and credits for readiness checks
  const fetchReadiness = async () => {
    try {
      // Fetch post meta for heroAssetId
      const postRes = await fetch(`/api/posting/project/${projectId}`);
      if (postRes.ok) {
        const postData = await postRes.json();
        setHeroAssetId(postData.post?.heroAssetId || null);
        // If post is already published, show success state
        if (postData.post?.status === "PUBLISHED") {
          setPublishSuccess(true);
          setPublishedSlug(postData.post?.slug || null);
        }
      }

      // Fetch credits
      const creditsRes = await fetch(`/api/posting/project/${projectId}/credits`);
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        // Has credits if there are non-Designer credits
        setHasCredits(
          (creditsData.credits || []).some(
            (c: any) => c.role.toLowerCase() !== "designer"
          )
        );
      }
    } catch (err) {
      console.error("[PublishPanel] Readiness fetch failed:", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchReadiness();
  }, [projectId]);

  const currentPost = useMemo(() => data?.drafts?.[0], [data]);
  const currentLead = useMemo(() => currentPost?.lead, [currentPost]);
  const currentSections = useMemo(() => {
    const sections = currentPost?.sections ?? [];
    return Array.isArray(sections) ? sections : [];
  }, [currentPost]);

  // Readiness checks
  const hasImages = images.length > 0;
  const imageCount = images.length;
  const taggedCount = images.filter((img) => img.tags.length > 0).length;
  const hasTags = taggedCount > 0;
  const hasCover = !!heroAssetId;
  const hasReflections = (data?.interview?.answers?.length || 0) > 0;
  const allRequired = hasImages && hasTags && hasCover;

  // Auto-collapse checklist if all required items are done
  useEffect(() => {
    if (allRequired && hasReflections && hasCredits) {
      setChecklistExpanded(false);
    }
  }, [allRequired, hasReflections, hasCredits]);

  async function handleGenerateDraft() {
    try {
      setRegenBusy(true);
      setError(null);

      // Fetch latest answers to send as override
      let answersToSend: any[] = [];
      let followupsToSend: any[] = [];

      try {
        const interviewRes = await fetch(`/api/posting/project/${projectId}/interview`);
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
        console.warn("[PublishPanel] Interview fetch failed:", fetchErr);
      }

      const url = `/api/posting/project/${projectId}/interview/generate?forceOverwriteDraft=true&mode=recomposition`;
      const payload: any = {
        source: "publish_tab",
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
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Draft already exists.");
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const errorMessage = json?.error || json?.message || `Generation failed (${res.status})`;
        setError(errorMessage);
        return;
      }

      router.refresh();
      fetchData().catch(console.error);
    } catch (err: any) {
      console.error("[PublishPanel] Generate failed", err);
      setError(err.message || "Failed to generate draft");
    } finally {
      setRegenBusy(false);
    }
  }

  async function handlePublish() {
    try {
      setIsPublishing(true);
      setError(null);

      const res = await fetch(`/api/projects/${projectId}/approvals/publish-editorial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to publish");
      }

      const result = await res.json();
      setPublishSuccess(true);
      setPublishedSlug(result.slug || null);
      router.refresh();
    } catch (err: any) {
      console.error("[PublishPanel] Publish failed:", err);
      setError(err.message || "Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Readiness Checklist */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm overflow-hidden">
        <button
          onClick={() => setChecklistExpanded(!checklistExpanded)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
        >
          <h2 className="folio-h3 text-[var(--text-primary)]">Readiness</h2>
          {checklistExpanded ? (
            <ChevronUp className="w-5 h-5 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />
          )}
        </button>

        {checklistExpanded && (
          <div className="px-6 pb-5 space-y-2">
            {/* Required items */}
            <ReadinessItem
              done={hasImages}
              label={`Photos uploaded${hasImages ? ` (${imageCount})` : ""}`}
              required
            />
            <ReadinessItem
              done={hasTags}
              label={`Products tagged${hasTags ? ` (${taggedCount})` : ""}`}
              required
            />
            <ReadinessItem done={hasCover} label="Cover image selected" required />

            {/* Recommended items */}
            <div className="border-t border-[var(--border-default)] pt-2 mt-3">
              <ReadinessItem
                done={hasReflections}
                label="Story reflections added"
                recommended
              />
              <ReadinessItem
                done={hasCredits}
                label="Credits added"
                recommended
              />
            </div>
          </div>
        )}
      </div>

      {/* Draft Section */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-sm">
        <h2 className="folio-h3 text-[var(--text-primary)] mb-4">Draft</h2>

        {currentLead?.kicker || currentLead?.title ? (
          <div className="space-y-3">
            {/* Status Badge */}
            {currentPost?.status && (
              <div className="mb-3">
                <span
                  className={`px-2 py-1 rounded folio-meta font-medium shadow-sm ${
                    currentPost.status === "PUBLISHED"
                      ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "bg-[var(--bg-base)] text-[var(--text-secondary)]"
                  }`}
                >
                  {currentPost.status}
                </span>
              </div>
            )}

            <p className="folio-body font-medium text-[var(--text-primary)]">
              {currentLead.kicker || currentLead.title}
            </p>
            {(currentLead.deck || (currentLead as any).dek) && (
              <p className="folio-ui text-[var(--text-secondary)] leading-relaxed">
                {currentLead.deck || (currentLead as any).dek}
              </p>
            )}

            <div className="mt-4 space-y-2 folio-ui text-[var(--text-secondary)]">
              {currentSections
                .filter((s: any) => s.type === "narrative" && s.body)
                .slice(0, 3)
                .map((s: any, i: number) => (
                  <p key={i} className="leading-relaxed opacity-90">
                    {s.body}
                  </p>
                ))}
            </div>

            {currentSections.filter((s: any) => s.type === "narrative" && s.body)
              .length === 0 && (
              <p className="folio-ui text-[var(--text-tertiary)] italic">
                No narrative sections yet. Generate a draft to see preview.
              </p>
            )}

            {/* Published post link */}
            {currentPost?.status === "PUBLISHED" && currentPost?.slug && (
              <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
                <a
                  href={`/p/${currentPost.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="folio-ui text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1"
                >
                  View Post <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Draft Action Buttons */}
            <div className="flex gap-3 mt-4 pt-4 border-t border-[var(--border-default)]">
              <button
                onClick={handleGenerateDraft}
                disabled={regenBusy}
                className="px-4 py-2 folio-ui font-medium text-[var(--text-primary)] bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-elevated)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {regenBusy ? "Generating..." : "Regenerate"}
              </button>
              <button
                onClick={() =>
                  router.push(`/designer/projects/${projectId}/preview`)
                }
                className="px-4 py-2 folio-ui font-medium text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg hover:bg-[var(--accent)]/20 transition-colors"
              >
                View Full Preview
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="folio-body text-[var(--text-tertiary)] mb-4">
              Your post is ready to be written.
            </p>
            <button
              onClick={handleGenerateDraft}
              disabled={regenBusy}
              className="px-6 py-3 folio-ui font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {regenBusy ? "Generating..." : "Generate Draft"}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg folio-ui">
          {error}
        </div>
      )}

      {/* Publish Actions */}
      {publishSuccess ? (
        <div className="rounded-2xl border border-[var(--ridge-outer)] bg-[var(--bg-elevated)] p-6 shadow-sm text-center">
          <CheckCircle2 className="w-8 h-8 text-[var(--accent)] mx-auto mb-3" />
          <h3 className="folio-h3 text-[var(--text-primary)] mb-2">Published!</h3>
          <p className="folio-body text-[var(--text-secondary)] mb-4">
            Your project post is now live.
          </p>
          {publishedSlug && (
            <a
              href={`/p/${publishedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 folio-ui font-medium text-[var(--accent)] border border-[var(--accent)]/20 rounded-lg hover:bg-[var(--accent)]/10 transition-colors"
            >
              View Post <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-sm">
          <button
            onClick={handlePublish}
            disabled={isPublishing || !currentPost}
            className="w-full px-6 py-3 folio-ui font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPublishing ? "Publishing..." : "Publish to Folio"}
          </button>
          {!currentPost && (
            <p className="folio-meta text-[var(--text-tertiary)] text-center mt-2">
              Generate a draft before publishing.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ReadinessItem({
  done,
  label,
  required,
  recommended,
}: {
  done: boolean;
  label: string;
  required?: boolean;
  recommended?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
      )}
      <span
        className={`folio-ui ${
          done ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
        }`}
      >
        {label}
      </span>
      {recommended && !done && (
        <span className="folio-meta text-[var(--text-tertiary)]">(recommended)</span>
      )}
    </div>
  );
}
