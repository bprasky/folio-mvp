"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react";
import { usePublishFlow } from "@/hooks/usePublishFlow";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

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

interface PublishPanelProps {
  projectId: string;
  project: { id: string; title: string };
  images: ProjectImage[];
  isOwner: boolean;
}

export default function PublishPanel({ projectId, project, images, isOwner }: PublishPanelProps) {
  const router = useRouter();
  const {
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
    isUnpublishing,
    publishSuccess,
    publishedSlug,
    unpublish,
    error,
  } = usePublishFlow(projectId);

  const [checklistExpanded, setChecklistExpanded] = useState(true);
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);

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
    await generateDraft();
    router.refresh();
  }

  async function handlePublish() {
    await publish();
    router.refresh();
  }

  async function handleUnpublish() {
    setShowUnpublishDialog(false);
    const result = await unpublish();
    if (result.ok) {
      router.refresh();
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-folio-text-secondary">Loading...</div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Readiness Checklist */}
      <div className="rounded-[20px] border border-folio-border-subtle bg-surface-ground shadow-sm overflow-hidden">
        <button
          onClick={() => setChecklistExpanded(!checklistExpanded)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
        >
          <h2 className="folio-h3 text-folio-text-primary">Readiness</h2>
          {checklistExpanded ? (
            <ChevronUp className="w-5 h-5 text-folio-text-tertiary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-folio-text-tertiary" />
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
            <div className="border-t border-folio-border-subtle pt-2 mt-3">
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
      <div className="rounded-[20px] border border-folio-border-subtle bg-surface-ground p-6 shadow-sm">
        <h2 className="folio-h3 text-folio-text-primary mb-4">Draft</h2>

        {currentLead?.kicker || currentLead?.title ? (
          <div className="space-y-3">
            {/* Status Badge */}
            {currentPost?.status && (
              <div className="mb-3">
                <span
                  className={`px-2 py-1 rounded folio-meta font-medium ${
                    currentPost.status === "PUBLISHED"
                      ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "bg-surface-canvas text-folio-text-secondary"
                  }`}
                >
                  {currentPost.status}
                </span>
              </div>
            )}

            <p className="folio-body font-medium text-folio-text-primary">
              {currentLead.kicker || currentLead.title}
            </p>
            {(currentLead.deck || (currentLead as any).dek) && (
              <p className="folio-ui text-folio-text-secondary leading-relaxed">
                {currentLead.deck || (currentLead as any).dek}
              </p>
            )}

            <div className="mt-4 space-y-2 folio-ui text-folio-text-secondary">
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
              <p className="folio-ui text-folio-text-tertiary italic">
                No narrative sections yet. Generate a draft to see preview.
              </p>
            )}

            {/* Published post link */}
            {currentPost?.status === "PUBLISHED" && currentPost?.slug && (
              <div className="mt-4 pt-4 border-t border-folio-border-subtle">
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
            <div className="flex gap-3 mt-4 pt-4 border-t border-folio-border-subtle">
              <button
                onClick={handleGenerateDraft}
                disabled={regenBusy}
                className="px-4 py-2 folio-ui font-medium text-folio-text-primary bg-surface-canvas border border-folio-border-subtle rounded-lg hover:bg-surface-ground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <p className="folio-body text-folio-text-tertiary mb-4">
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
        <div className="p-4 bg-stone-100 border border-stone-300 text-[rgb(74,44,59)] rounded-[20px] folio-ui">
          {error}
        </div>
      )}

      {/* Publish Actions */}
      {publishSuccess ? (
        <div className="rounded-[20px] border border-folio-border-subtle bg-surface-ground p-6 shadow-sm text-center">
          <CheckCircle2 className="w-8 h-8 text-[var(--accent)] mx-auto mb-3" />
          <h3 className="folio-h3 text-folio-text-primary mb-2">Published!</h3>
          <p className="folio-body text-folio-text-secondary mb-4">
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

          <div className="mt-6 pt-4 border-t border-folio-border-subtle">
            <button
              onClick={() => setShowUnpublishDialog(true)}
              disabled={isUnpublishing}
              className="folio-ui text-sm font-medium text-[rgb(74,44,59)] hover:text-[rgb(74,44,59)]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUnpublishing ? "Unpublishing..." : "Unpublish"}
            </button>
          </div>

          <ConfirmDialog
            open={showUnpublishDialog}
            title="Unpublish this post?"
            description="This will take your post offline. Your story and interview answers are preserved and you can republish anytime."
            confirmText={isUnpublishing ? "Unpublishing..." : "Unpublish"}
            confirmVariant="destructive"
            onCancel={() => setShowUnpublishDialog(false)}
            onConfirm={handleUnpublish}
          />
        </div>
      ) : (
        <div className="rounded-[20px] border border-folio-border-subtle bg-surface-ground p-6 shadow-sm">
          <button
            onClick={handlePublish}
            disabled={isPublishing || !currentPost}
            className="w-full px-6 py-3 folio-ui font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPublishing ? "Publishing..." : "Publish to Folio"}
          </button>
          {!currentPost && (
            <p className="folio-meta text-folio-text-tertiary text-center mt-2">
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
        <Circle className="w-4 h-4 text-folio-text-tertiary shrink-0" />
      )}
      <span
        className={`folio-ui ${
          done ? "text-folio-text-primary" : "text-folio-text-secondary"
        }`}
      >
        {label}
      </span>
      {recommended && !done && (
        <span className="folio-meta text-folio-text-tertiary">(recommended)</span>
      )}
    </div>
  );
}
