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
  Tag,
} from "lucide-react";
import { usePublishFlow } from "@/hooks/usePublishFlow";
import { ImmersiveProjectPage } from "@/components/project/ImmersiveProjectPage";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { InterviewModal } from "@/components/posting/interview/InterviewModal";
import { ProjectImageTagger } from "@/components/project/ProjectImageTagger";
import type { EditorialState } from "@/lib/editorial/getEditorialState";
import EditableArticle from "@/components/posting/editing/EditableArticle";
import type { SectionOverride, SectionHistoryEntry } from "@/lib/posting/editingTypes";

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
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showTagger, setShowTagger] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [showRegenDialog, setShowRegenDialog] = useState(false);
  const [regenFeedback, setRegenFeedback] = useState('');
  const [keepEdits, setKeepEdits] = useState(true);

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
    const savedOverrides = keepEdits
      ? ((initialPostData?.sectionOverrides ?? []) as SectionOverride[])
      : [];

    await generateDraft();

    // Re-apply preserved manual edits after regeneration
    if (savedOverrides.length > 0) {
      for (const override of savedOverrides) {
        try {
          await fetch(`/api/posting/project/${projectId}/sections/override`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chapterIndex: override.chapterIndex,
              paragraphIndex: override.paragraphIndex,
              field: override.field,
              editedBody: override.editedBody,
            }),
          });
        } catch {
          // Best-effort: if an override can't be applied (chapter structure changed), skip it
        }
      }
    }

    setShowRegenDialog(false);
    setRegenFeedback('');
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
      <div className="sticky top-0 z-50 border-b border-folio-border-subtle bg-surface-ground/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isPublishedStatus ? (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[rgb(74,44,59)]" />
                  <span className="folio-ui font-medium text-folio-text-primary">Published</span>
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
                <span className="folio-ui font-medium text-folio-text-primary">
                  Preview — not yet published
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Edit / Preview toggle */}
            {initialPostData?.expandedBlocks && (
              <div className="flex rounded-lg border border-folio-border-subtle overflow-hidden">
                <button
                  onClick={() => setViewMode('edit')}
                  className={`flex items-center gap-1 px-3 py-1.5 folio-meta font-medium transition-colors ${
                    viewMode === 'edit'
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-surface-canvas text-folio-text-secondary hover:bg-surface-ground'
                  }`}
                >
                  Edit
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`flex items-center gap-1 px-3 py-1.5 folio-meta font-medium transition-colors ${
                    viewMode === 'preview'
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-surface-canvas text-folio-text-secondary hover:bg-surface-ground'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
              </div>
            )}
            {(editorialState === 'GENERATED' || editorialState === 'UNPUBLISHED') && (
              <button
                onClick={() => setShowInterviewModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 folio-meta font-medium text-folio-text-secondary bg-surface-canvas border border-folio-border-subtle rounded-lg hover:bg-surface-ground transition-colors"
              >
                Redo Interview
              </button>
            )}
            <button
              onClick={() => setShowRegenDialog(true)}
              disabled={regenBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 folio-meta font-medium text-folio-text-secondary bg-surface-canvas border border-folio-border-subtle rounded-lg hover:bg-surface-ground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <div className="flex items-start gap-2 p-4 bg-surface-elevated border border-folio-border-strong text-[rgb(74,44,59)] rounded-[20px] folio-ui">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* UNPUBLISHED STATE BANNER */}
      {editorialState === 'UNPUBLISHED' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-start gap-2 p-4 bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-[20px] folio-ui text-folio-text-primary">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--accent)]" />
            <span>This project was previously published and is now a draft. Review your changes and re-publish when ready.</span>
          </div>
        </div>
      )}

      {/* EDITORIAL CONTEXT TOGGLES */}
      {!isPublishedStatus && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <div className="flex flex-wrap items-center gap-4 folio-meta text-folio-text-tertiary">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={contextToggles.includeBio}
                onChange={(e) => setContextToggle('includeBio', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-folio-border-subtle accent-[var(--accent)]"
              />
              <span>Include my bio</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={contextToggles.includeProjectHistory}
                onChange={(e) => setContextToggle('includeProjectHistory', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-folio-border-subtle accent-[var(--accent)]"
              />
              <span>Reference my other projects</span>
            </label>
          </div>
          {generationMeta?.designerBioMissing && contextToggles.includeBio && (
            <p className="mt-2 folio-meta text-folio-text-tertiary">
              Your bio helps Folio write features that sound like you.{" "}
              <a href="/settings/profile" className="text-[var(--accent)] hover:text-[var(--accent-hover)] underline">
                Add one now
              </a>
            </p>
          )}
        </div>
      )}

      {/* PRODUCT TAG REVIEW — Entry Point C */}
      {!isPublishedStatus && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          {hasTags ? (
            <div className="flex items-center gap-3">
              <Tag className="w-4 h-4 text-[var(--accent)] shrink-0" />
              <span className="folio-meta text-folio-text-secondary">
                {taggedCount} {taggedCount === 1 ? "image" : "images"} tagged
              </span>
              <button
                onClick={() => setShowTagger(true)}
                className="folio-meta text-[var(--accent)] hover:text-[var(--accent-hover)] underline transition-colors"
              >
                Edit Tags
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTagger(true)}
              className="flex items-center gap-2 p-3 w-full rounded-xl border border-dashed border-folio-border-subtle hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all text-left"
            >
              <Tag className="w-4 h-4 text-folio-text-tertiary shrink-0" />
              <span className="folio-meta text-folio-text-secondary">
                No products tagged yet. Tag now to enrich your editorial.
              </span>
            </button>
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
            className="text-3xl font-medium text-folio-text-primary leading-tight"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            {currentLead.title}
          </h2>
          {(currentLead.deck || currentLead.dek) && (
            <p className="mt-2 folio-body text-folio-text-secondary leading-relaxed max-w-3xl">
              {currentLead.deck || currentLead.dek}
            </p>
          )}
        </div>
      )}

      {/* CONTENT AREA — Edit mode or Preview mode */}
      {viewMode === 'edit' && initialPostData?.expandedBlocks ? (
        <div className="bg-surface-canvas">
          <EditableArticle
            projectId={projectId}
            blocks={initialPostData.expandedBlocks}
            overrides={(initialPostData.sectionOverrides ?? []) as SectionOverride[]}
            sectionHistory={(initialPostData.sectionHistory ?? []) as SectionHistoryEntry[]}
            images={images}
          />
        </div>
      ) : (
        <div className="relative">
          <ImmersiveProjectPage post={initialPostData} modules={initialModules} isOwner={isOwner} />
        </div>
      )}

      {/* STAGING FOOTER — sticky at bottom */}
      <div className="sticky bottom-0 z-50 border-t border-folio-border-subtle bg-surface-ground/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {/* Readiness summary + action */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setChecklistExpanded(!checklistExpanded)}
              className="flex items-center gap-2 text-left"
            >
              <span className="folio-ui font-medium text-folio-text-primary">
                Readiness
              </span>
              <span
                className={`folio-meta px-2 py-0.5 rounded-full ${
                  allRequired
                    ? "bg-[rgb(74,44,59)]/10 text-[rgb(74,44,59)]"
                    : "bg-surface-elevated text-folio-text-secondary"
                }`}
              >
                {totalPassed}/{totalChecks}
              </span>
              {checklistExpanded ? (
                <ChevronDown className="w-4 h-4 text-folio-text-tertiary" />
              ) : (
                <ChevronUp className="w-4 h-4 text-folio-text-tertiary" />
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
                    className="px-4 py-2 folio-ui font-medium text-[rgb(74,44,59)] border border-folio-border-strong rounded-lg hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <div className="mt-3 pt-3 border-t border-folio-border-subtle">
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
                  onClick={() => setShowTagger(true)}
                />
                <ReadinessItem done={hasCover} label="Cover image selected" required />
                <ReadinessItem done={hasReflections} label="Story reflections added" recommended />
                <ReadinessItem done={hasCredits} label="Credits added" recommended />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Redo Interview modal — available for GENERATED and UNPUBLISHED states */}
      <InterviewModal
        open={showInterviewModal}
        onOpenChange={setShowInterviewModal}
        projectId={projectId}
        projectName={project.title}
        images={images.map(img => ({ id: img.id, url: img.url, name: img.name }))}
        post={initialPostData}
        onDraftGenerated={() => {
          setShowInterviewModal(false);
          router.refresh();
        }}
      />

      {/* ProjectImageTagger — Entry Point C: post-interview tag editing */}
      {showTagger && (
        <ProjectImageTagger
          projectId={projectId}
          onClose={() => {
            setShowTagger(false);
            router.refresh();
          }}
        />
      )}

      {/* Regeneration dialog with feedback + keep edits */}
      {showRegenDialog && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowRegenDialog(false)} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-ground rounded-lg shadow-xl p-6">
            <h3 className="folio-h3 mb-2">Regenerate Article</h3>
            <p className="folio-meta text-folio-text-tertiary mb-4">
              This will regenerate the entire article using AI. Any unpreserved edits will be lost.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block folio-meta font-medium text-folio-text-primary mb-1">
                  Any direction for the rewrite? (optional)
                </label>
                <input
                  type="text"
                  value={regenFeedback}
                  onChange={(e) => setRegenFeedback(e.target.value)}
                  placeholder="e.g., More conversational tone, focus on the materials"
                  className="w-full border border-folio-border-subtle rounded-md px-3 py-2 folio-meta focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-surface-canvas"
                />
              </div>

              {((initialPostData?.sectionOverrides as SectionOverride[] | undefined)?.length ?? 0) > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepEdits}
                    onChange={(e) => setKeepEdits(e.target.checked)}
                    className="rounded border-folio-border-subtle text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <span className="folio-meta text-folio-text-primary">
                    Keep my manual edits
                  </span>
                </label>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowRegenDialog(false)}
                  className="px-4 py-2 folio-meta text-folio-text-primary border border-folio-border-subtle rounded-md hover:bg-surface-canvas"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenBusy}
                  className="px-4 py-2 folio-meta font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  {regenBusy ? 'Regenerating...' : 'Regenerate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-surface-ground border border-folio-border-subtle flex items-center justify-center">
        <Eye className="w-8 h-8 text-folio-text-tertiary" />
      </div>
      <h2 className="folio-h2 text-folio-text-primary mb-3">No draft yet</h2>
      <p className="folio-body text-folio-text-secondary mb-6">
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
        <div className="mt-4 p-4 bg-surface-elevated border border-folio-border-strong text-[rgb(74,44,59)] rounded-[20px] folio-ui">
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
  onClick,
}: {
  done: boolean;
  label: string;
  required?: boolean;
  recommended?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-folio-text-tertiary shrink-0" />
      )}
      <span
        className={`folio-meta ${
          done ? "text-folio-text-primary" : "text-folio-text-secondary"
        }`}
      >
        {label}
      </span>
      {recommended && !done && (
        <span className="folio-meta text-folio-text-tertiary">(recommended)</span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 py-0.5 hover:text-[var(--accent)] transition-colors cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 py-0.5">
      {content}
    </div>
  );
}
