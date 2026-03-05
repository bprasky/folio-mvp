"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  RefreshCw,
  Eye,
  AlertCircle,
} from "lucide-react";
import { usePublishFlow } from "@/hooks/usePublishFlow";
import { ImmersiveProjectPage } from "@/components/project/ImmersiveProjectPage";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { EditorialState } from "@/lib/editorial/getEditorialState";

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

interface StagingPublishPanelProps {
  projectId: string;
  project: { id: string; title: string };
  images: ProjectImage[];
  isOwner: boolean;
  initialPostData: any;
  initialModules: any[];
  editorialState?: EditorialState;
}

export default function StagingPublishPanel({
  projectId,
  project,
  images,
  isOwner,
  initialPostData,
  initialModules,
  editorialState,
}: StagingPublishPanelProps) {
  const router = useRouter();
  const {
    data,
    currentLead,
    heroAssetId,
    hasCredits,
    isLoading: flowLoading,
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
    contextToggles,
    setContextToggle,
    generationMeta,
  } = usePublishFlow(projectId);

  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);

  const isPublishedStatus = initialPostData?.status === "PUBLISHED" || publishSuccess;
  const slug = initialPostData?.slug || publishedSlug;

  // Readiness checks
  const hasImages = images.length > 0;
  const imageCount = images.length;
  const taggedCount = images.filter((img) => img.tags.length > 0).length;
  const hasTags = taggedCount > 0;
  const hasCover = !!heroAssetId;
  const hasReflections = (data?.interview?.answers?.length || 0) > 0;

  const requiredChecks = [hasImages, hasTags, hasCover];
  const recommendedChecks = [hasReflections, hasCredits];
  const requiredPassed = requiredChecks.filter(Boolean).length;
  const totalPassed = [...requiredChecks, ...recommendedChecks].filter(Boolean).length;
  const totalChecks = requiredChecks.length + recommendedChecks.length;
  const allRequired = requiredChecks.every(Boolean);

  // Auto-expand checklist if something is missing
  useEffect(() => {
    if (!allRequired) {
      setChecklistExpanded(true);
    }
  }, [allRequired]);

  async function handleRegenerate() {
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

  return (
    <div className="relative">
      {/* PREVIEW BANNER — sticky at top */}
      <div className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isPublishedStatus ? (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[rgb(74,44,59)]" />
                  <span className="folio-ui font-medium text-[var(--text-primary)]">Published</span>
                </span>
                {slug && (
                  <a
                    href={`/p/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="folio-meta text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1 transition-colors"
                  >
                    View live post <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border-2 border-[var(--text-tertiary)] bg-transparent" />
                <span className="folio-ui font-medium text-[var(--text-primary)]">
                  Preview — not yet published
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 folio-meta font-medium text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-elevated)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenBusy ? "animate-spin" : ""}`} />
              {regenBusy ? "Regenerating..." : "Regenerate"}
            </button>
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-start gap-2 p-4 bg-stone-100 border border-stone-300 text-[rgb(74,44,59)] rounded-[20px] folio-ui">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* UNPUBLISHED STATE BANNER */}
      {editorialState === 'UNPUBLISHED' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-start gap-2 p-4 bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-[20px] folio-ui text-[var(--text-primary)]">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--accent)]" />
            <span>This project was previously published and is now a draft. Review your changes and re-publish when ready.</span>
          </div>
        </div>
      )}

      {/* EDITORIAL CONTEXT TOGGLES */}
      {!isPublishedStatus && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <div className="flex flex-wrap items-center gap-4 folio-meta text-[var(--text-tertiary)]">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={contextToggles.includeBio}
                onChange={(e) => setContextToggle('includeBio', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[var(--border-default)] accent-[var(--accent)]"
              />
              <span>Include my bio</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={contextToggles.includeProjectHistory}
                onChange={(e) => setContextToggle('includeProjectHistory', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[var(--border-default)] accent-[var(--accent)]"
              />
              <span>Reference my other projects</span>
            </label>
          </div>
          {generationMeta?.designerBioMissing && contextToggles.includeBio && (
            <p className="mt-2 folio-meta text-[var(--text-tertiary)]">
              Your bio helps Folio write features that sound like you.{" "}
              <a href="/settings/profile" className="text-[var(--accent)] hover:text-[var(--accent-hover)] underline">
                Add one now
              </a>
            </p>
          )}
        </div>
      )}

      {/* GENERATED STORY TITLE — surfaced above the preview */}
      {(currentLead?.kicker || currentLead?.title) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
          {currentLead?.kicker && currentLead.kicker !== currentLead.title && (
            <p
              className="text-sm uppercase tracking-widest text-[var(--accent)] mb-1"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              {currentLead.kicker}
            </p>
          )}
          <h2
            className="text-3xl font-medium text-[var(--text-primary)] leading-tight"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            {currentLead.title}
          </h2>
          {(currentLead.deck || currentLead.dek) && (
            <p className="mt-2 folio-body text-[var(--text-secondary)] leading-relaxed max-w-3xl">
              {currentLead.deck || currentLead.dek}
            </p>
          )}
        </div>
      )}

      {/* IMMERSIVE PREVIEW — renders exactly as readers see it */}
      <div className="relative">
        <ImmersiveProjectPage post={initialPostData} modules={initialModules} />
      </div>

      {/* STAGING FOOTER — sticky at bottom */}
      <div className="sticky bottom-0 z-50 border-t border-[var(--border-default)] bg-[var(--bg-elevated)]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {/* Readiness summary + action */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setChecklistExpanded(!checklistExpanded)}
              className="flex items-center gap-2 text-left"
            >
              <span className="folio-ui font-medium text-[var(--text-primary)]">
                Readiness
              </span>
              <span
                className={`folio-meta px-2 py-0.5 rounded-full ${
                  allRequired
                    ? "bg-[rgb(74,44,59)]/10 text-[rgb(74,44,59)]"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                {totalPassed}/{totalChecks}
              </span>
              {checklistExpanded ? (
                <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
              ) : (
                <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" />
              )}
            </button>

            <div className="flex items-center gap-3">
              {isPublishedStatus ? (
                <>
                  {slug && (
                    <a
                      href={`/p/${slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 folio-ui font-medium text-[var(--accent)] border border-[var(--accent)]/20 rounded-lg hover:bg-[var(--accent)]/10 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Post
                    </a>
                  )}
                  <button
                    onClick={() => setShowUnpublishDialog(true)}
                    disabled={isUnpublishing}
                    className="px-4 py-2 folio-ui font-medium text-[rgb(74,44,59)] border border-stone-300 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUnpublishing ? "Unpublishing..." : "Unpublish"}
                  </button>
                </>
              ) : (
                <button
                  onClick={handlePublish}
                  disabled={isPublishing || !initialPostData?.expandedBlocks}
                  className="px-6 py-2 folio-ui font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPublishing
                    ? "Publishing..."
                    : editorialState === 'UNPUBLISHED'
                    ? "Re-Publish to Folio"
                    : "Publish to Folio"}
                </button>
              )}
            </div>
          </div>

          {/* Expanded readiness checklist */}
          {checklistExpanded && (
            <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
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
                <ReadinessItem done={hasReflections} label="Story reflections added" recommended />
                <ReadinessItem done={hasCredits} label="Credits added" recommended />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unpublish confirmation dialog */}
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
  );
}

/** No-draft empty state shown when Publish tab is accessed but no ProjectPost exists */
export function NoDraftState({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { generateDraft, regenBusy, error } = usePublishFlow(projectId);

  async function handleGenerate() {
    await generateDraft();
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto text-center py-16 px-4">
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center">
        <Eye className="w-8 h-8 text-[var(--text-tertiary)]" />
      </div>
      <h2 className="folio-h2 text-[var(--text-primary)] mb-3">No draft yet</h2>
      <p className="folio-body text-[var(--text-secondary)] mb-6">
        Generate a draft to preview your article exactly as readers will see it.
      </p>
      <button
        onClick={handleGenerate}
        disabled={regenBusy}
        className="px-6 py-3 folio-ui font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {regenBusy ? "Generating..." : "Generate Draft"}
      </button>
      {error && (
        <div className="mt-4 p-4 bg-stone-100 border border-stone-300 text-[rgb(74,44,59)] rounded-[20px] folio-ui">
          {error}
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
    <div className="flex items-center gap-2 py-0.5">
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
      )}
      <span
        className={`folio-meta ${
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
