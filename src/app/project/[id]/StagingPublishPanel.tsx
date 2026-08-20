"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  ArrowRight,
} from "lucide-react";
import { usePublishFlow } from "@/hooks/usePublishFlow";
import { ImmersiveProjectPage } from "@/components/project/ImmersiveProjectPage";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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
  roomId?: string | null;
  displayOrder?: number | null;
  tags: ProductTag[];
}

interface StagingPublishPanelProps {
  projectId: string;
  images: ProjectImage[];
  isOwner: boolean;
  initialPostData: any;
  initialModules: any[];
  editorialState?: EditorialState;
  /**
   * The publish gate, derived server-side by `computePublishReadiness` — the
   * same value `publishEditorial` enforces. The button reads this rather than
   * recomputing: a second definition of "ready" on the client is how the panel
   * came to offer a publish the server refuses.
   */
  canPublish: boolean;
  /** Which gate is closed, for naming the blocker and linking to its step. */
  publishBlockedBy?: 'rooms' | 'tags';
  taggedPhotoCount: number;
  untaggedPhotoCount: number;
  unsortedPhotoCount: number;
}

/**
 * The Tags step's surface, opened on the review panel that lists the photos
 * still to resolve (`action=tag` — the same dispatch the tracker's CTA fires).
 * Without the param this CTA landed on the bare tagger, where the only thing on
 * screen is the work already done: "N photos still to tag" sent the designer to
 * a grid of their own tags and read as a lie.
 */
const tagsHref = (projectId: string) =>
  `/project/${projectId}?view=media&step=tags&action=tag`;
/** The Rooms step's surface. */
const roomsHref = (projectId: string) => `/project/${projectId}?view=media&step=rooms`;
/** The Story step's surface — interview, answers, and generation. */
const storyHref = (projectId: string) => `/project/${projectId}?view=story`;

export default function StagingPublishPanel({
  projectId,
  images,
  isOwner,
  initialPostData,
  initialModules,
  editorialState,
  canPublish,
  publishBlockedBy,
  taggedPhotoCount,
  untaggedPhotoCount,
  unsortedPhotoCount,
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
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [showRegenDialog, setShowRegenDialog] = useState(false);
  const [keepEdits, setKeepEdits] = useState(true);

  const isPublishedStatus = initialPostData?.status === "PUBLISHED" || publishSuccess;
  const slug = initialPostData?.slug || publishedSlug;

  // Readiness display. The two REQUIRED rows mirror the server gate exactly
  // (`computePublishReadiness`: every included photo sorted into a room, and
  // every included photo either tagged or marked product-free) so the checklist
  // and the button can't tell different stories. Cover, reflections and credits
  // are recommended — they never gate the publish.
  const imageCount = images.length;
  const roomsReady = unsortedPhotoCount === 0;
  const tagsReady = untaggedPhotoCount === 0;
  const hasCover = !!heroAssetId;
  const hasReflections = (data?.interview?.answers?.length || 0) > 0;

  const requiredChecks = [roomsReady, tagsReady];
  const recommendedChecks = [hasCover, hasReflections, hasCredits];
  const totalPassed = [...requiredChecks, ...recommendedChecks].filter(Boolean).length;
  const totalChecks = requiredChecks.length + recommendedChecks.length;

  // Auto-expand the checklist while the gate is closed, so the reason the
  // Publish button is disabled is on screen without a click.
  useEffect(() => {
    if (!canPublish) {
      setChecklistExpanded(true);
    }
  }, [canPublish]);

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
            {/* The interview belongs to the Story step, so this links there
                rather than opening it over the draft. Hosting it here gave the
                project two places to answer the same questions, and left the
                Story surface — which owns the answers, the coverage and the
                Generate action — looking optional. */}
            {(editorialState === 'GENERATED' || editorialState === 'UNPUBLISHED') && (
              <Link
                href={storyHref(projectId)}
                className="flex items-center gap-1.5 px-3 py-1.5 folio-meta font-medium text-folio-text-secondary bg-surface-canvas border border-folio-border-subtle rounded-lg hover:bg-surface-ground transition-colors"
              >
                Edit your story
              </Link>
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
          <div className="flex items-start gap-2 p-4 bg-stone-100 border border-stone-300 text-[rgb(74,44,59)] rounded-[20px] folio-ui">
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

      {/* PRODUCT TAG STATUS — a read-out, not a tagging surface. The tagger used
          to open in a modal from here, which put the Tags step inside the
          Publish step and gave tagging two homes with two different UIs. This
          reports the count and links to the step that owns the work. */}
      {!isPublishedStatus && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <div className="flex items-center gap-3">
            <Tag
              className={`w-4 h-4 shrink-0 ${
                tagsReady ? "text-[var(--accent)]" : "text-folio-text-tertiary"
              }`}
            />
            <span className="folio-meta text-folio-text-secondary">
              {taggedPhotoCount} {taggedPhotoCount === 1 ? "photo" : "photos"} tagged
              {untaggedPhotoCount > 0 && ` · ${untaggedPhotoCount} still to review`}
            </span>
            <Link
              href={tagsHref(projectId)}
              className="folio-meta text-[var(--accent)] hover:text-[var(--accent-hover)] underline transition-colors"
            >
              {tagsReady ? "Edit tags" : "Finish tagging"}
            </Link>
          </div>
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
                  canPublish
                    ? "bg-[rgb(74,44,59)]/10 text-[rgb(74,44,59)]"
                    : "bg-stone-100 text-stone-600"
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
                    className="px-4 py-2 folio-ui font-medium text-[rgb(74,44,59)] border border-stone-300 rounded-lg hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUnpublishing ? "Unpublishing..." : "Unpublish"}
                  </button>
                </>
              ) : canPublish ? (
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
              ) : (
                // The gate is closed. Offering "Publish to Folio" here fired a
                // request the server rejects, so the designer met a red error
                // banner instead of the work that was actually outstanding.
                // Send them to it.
                <Link
                  href={
                    publishBlockedBy === 'rooms'
                      ? roomsHref(projectId)
                      : tagsHref(projectId)
                  }
                  className="flex items-center gap-2 px-6 py-2 folio-ui font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                >
                  {publishBlockedBy === 'rooms'
                    ? `Sort rooms (${unsortedPhotoCount} left)`
                    : `Tag products (${untaggedPhotoCount} left)`}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          {/* Expanded readiness checklist */}
          {checklistExpanded && (
            <div className="mt-3 pt-3 border-t border-folio-border-subtle">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                <ReadinessItem
                  done={roomsReady}
                  label={
                    roomsReady
                      ? `Photos sorted into rooms (${imageCount})`
                      : `${unsortedPhotoCount} ${
                          unsortedPhotoCount === 1 ? "photo" : "photos"
                        } still to sort`
                  }
                  required
                  href={roomsReady ? undefined : roomsHref(projectId)}
                />
                <ReadinessItem
                  done={tagsReady}
                  label={
                    tagsReady
                      ? `Products tagged (${taggedPhotoCount})`
                      : `${untaggedPhotoCount} ${
                          untaggedPhotoCount === 1 ? "photo" : "photos"
                        } still to tag`
                  }
                  required
                  href={tagsReady ? undefined : tagsHref(projectId)}
                />
                <ReadinessItem done={hasCover} label="Cover image selected" recommended />
                <ReadinessItem
                  done={hasReflections}
                  label="Story reflections added"
                  recommended
                  href={hasReflections ? undefined : storyHref(projectId)}
                />
                <ReadinessItem
                  done={hasCredits}
                  label="Credits added"
                  recommended
                  href={hasCredits ? undefined : storyHref(projectId)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* No interview modal and no tagger here by design: the Story step owns the
          interview and the Tags step owns tagging. Every route into them from
          this surface is a link to that step. */}

      {/* Regeneration dialog with feedback + keep edits */}
      {showRegenDialog && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowRegenDialog(false)} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-ground rounded-lg shadow-xl p-6">
            <h3 className="folio-h3 mb-2">Regenerate Article</h3>
            <p className="folio-meta text-folio-text-tertiary mb-4">
              This will regenerate the entire article using AI. Any unpreserved edits will be lost.
            </p>

            {/* Deliberately no "direction for the rewrite" input here. Whole-article
                regeneration is the wrong instrument for steering: it is a ~2 minute
                call that rewrites every room and drops unpreserved edits. Direction
                belongs where it is targeted and cheap — the per-section feedback
                control in Edit Article, which regenerates one chapter with the
                designer's note in its prompt. */}
            <div className="space-y-4">
              <p className="folio-meta text-folio-text-secondary">
                To steer the writing, use the feedback control on an individual
                section in Edit Article — it rewrites just that section.
              </p>

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

/**
 * No-draft empty state, shown if the Publish tab is reached with no ProjectPost.
 *
 * It offers a link, not a Generate button. Generation is the Story step's final
 * act — it runs from the interview's own answers and coverage, which live there
 * — and a second Generate entry point here meant the article could be written
 * from a surface that shows none of its inputs.
 */
export function NoDraftState({ projectId }: { projectId: string }) {
  return (
    <div className="max-w-xl mx-auto text-center py-16 px-4">
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-surface-ground border border-folio-border-subtle flex items-center justify-center">
        <Eye className="w-8 h-8 text-folio-text-tertiary" />
      </div>
      <h2 className="folio-h2 text-folio-text-primary mb-3">No draft yet</h2>
      <p className="folio-body text-folio-text-secondary mb-6">
        Answer the interview and generate your draft on the Story step. It lands
        here the moment it's written.
      </p>
      <Link
        href={storyHref(projectId)}
        className="inline-flex items-center gap-2 px-6 py-3 folio-ui font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
      >
        Go to your story
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function ReadinessItem({
  done,
  label,
  required,
  recommended,
  href,
}: {
  done: boolean;
  label: string;
  required?: boolean;
  recommended?: boolean;
  /** The step that owns this item's work. Rows never do the work themselves. */
  href?: string;
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
      {required && !done && (
        <span className="folio-meta text-folio-text-tertiary">(required)</span>
      )}
      {recommended && !done && (
        <span className="folio-meta text-folio-text-tertiary">(recommended)</span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-2 py-0.5 hover:text-[var(--accent)] transition-colors"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 py-0.5">
      {content}
    </div>
  );
}
