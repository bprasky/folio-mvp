"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Sparkles, MapPin, ImageIcon, LayoutGrid, Tag } from "lucide-react";
import { usePublishFlow } from "@/hooks/usePublishFlow";
import { InterviewModal } from "@/components/posting/interview/InterviewModal";
import { FinishScheduleOptionsModal } from "@/components/posting/FinishScheduleOptionsModal";
import { ProjectImageTagger } from "@/components/project/ProjectImageTagger";
import type { EditorialState } from "@/lib/editorial/getEditorialState";

interface GuidedPublishFlowProps {
  project: {
    id: string;
    title: string;
    projectType?: string;
    city?: string | null;
    regionState?: string | null;
    rooms?: any[];
  };
  imageCount: number;
  images: Array<{ id: string; url: string; name?: string }>;
  projectPost?: any;
  editorialState?: EditorialState;
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  UNSPECIFIED: "Unspecified",
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  HOSPITALITY: "Hospitality",
  RETAIL: "Retail",
  OFFICE: "Office",
  HEALTHCARE: "Healthcare",
  EDUCATIONAL: "Educational",
  INDUSTRIAL: "Industrial",
  LANDSCAPE: "Landscape",
  INTERIOR: "Interior",
  ARCHITECTURAL: "Architectural",
};

export default function GuidedPublishFlow({ project, imageCount, images, projectPost, editorialState }: GuidedPublishFlowProps) {
  const router = useRouter();
  const flow = usePublishFlow(project.id);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showFinishScheduleModal, setShowFinishScheduleModal] = useState(false);
  const [showSkipDecision, setShowSkipDecision] = useState(false);
  const [showTagger, setShowTagger] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tagCount, setTagCount] = useState(0);

  const roomCount = project.rooms?.length || 0;
  const location = [project.city, project.regionState].filter(Boolean).join(", ");
  const typeLabel = PROJECT_TYPE_LABELS[project.projectType || ""] || project.projectType || "";

  // Fetch tag count on mount and after tagger closes
  const fetchTagCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/tag-product-to-image?projectId=${project.id}`);
      if (res.ok) {
        const tags = await res.json();
        setTagCount(Array.isArray(tags) ? tags.length : 0);
      }
    } catch {
      // ignore
    }
  }, [project.id]);

  useEffect(() => {
    fetchTagCount();
  }, [fetchTagCount]);

  function handleOpenInterview() {
    // Entry Point A: show finish schedule gate before interview
    setShowFinishScheduleModal(true);
  }

  function handleFinishScheduleComplete(option: 'uploaded' | 'later' | 'skip') {
    setShowFinishScheduleModal(false);
    if (option === 'skip') {
      // Show decision branch: continue to interview or tag manually
      setShowSkipDecision(true);
    } else {
      // 'uploaded' or 'later' → proceed to interview
      setShowInterviewModal(true);
    }
  }

  function handleSkipDecisionInterview() {
    setShowSkipDecision(false);
    setShowInterviewModal(true);
  }

  function handleSkipDecisionTag() {
    setShowSkipDecision(false);
    setShowTagger(true);
  }

  function handleTaggerClose() {
    setShowTagger(false);
    fetchTagCount();
  }

  async function handleGenerateStory() {
    // INTERVIEWED state: generate from existing answers, then navigate to publish tab
    setIsGenerating(true);
    try {
      await flow.generateDraft();
      router.push(`/project/${project.id}?view=publish`);
      router.refresh();
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDraftGenerated() {
    // Interview completed and draft was generated — navigate to the Publish tab staging view
    router.push(`/project/${project.id}?view=publish`);
  }

  return (
    <div className="mt-8 space-y-4">
      {/* Divider */}
      <div className="border-t border-folio-border-subtle pt-6">
        <h3 className="folio-ui font-semibold text-folio-text-secondary uppercase tracking-wider mb-4">
          Ready to publish?
        </h3>
      </div>

      {/* Project Summary Card */}
      <div className="rounded-[20px] border border-folio-border-subtle bg-surface-ground shadow-sm overflow-hidden">
        <button
          onClick={() => setSummaryExpanded(!summaryExpanded)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
        >
          <h3 className="folio-h3 text-folio-text-primary">Project Details</h3>
          {summaryExpanded ? (
            <ChevronUp className="w-5 h-5 text-folio-text-tertiary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-folio-text-tertiary" />
          )}
        </button>

        {summaryExpanded && (
          <div className="px-6 pb-5 space-y-3">
            {/* Project title */}
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
              <div>
                <p className="folio-meta text-folio-text-tertiary">Title</p>
                <p className="folio-body text-folio-text-primary">{project.title || "Untitled Project"}</p>
              </div>
            </div>

            {/* Project type */}
            {typeLabel && typeLabel !== "Unspecified" && (
              <div className="flex items-start gap-3">
                <LayoutGrid className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                <div>
                  <p className="folio-meta text-folio-text-tertiary">Type</p>
                  <p className="folio-body text-folio-text-primary">{typeLabel}</p>
                </div>
              </div>
            )}

            {/* Location */}
            {location && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                <div>
                  <p className="folio-meta text-folio-text-tertiary">Location</p>
                  <p className="folio-body text-folio-text-primary">{location}</p>
                </div>
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-3 pt-2">
              <ImageIcon className="w-4 h-4 text-[var(--accent)] shrink-0" />
              <div className="flex items-center gap-4">
                <span className="folio-ui text-folio-text-secondary">
                  {imageCount} {imageCount === 1 ? "image" : "images"}
                </span>
                {roomCount > 0 && (
                  <span className="folio-ui text-folio-text-secondary">
                    {roomCount} {roomCount === 1 ? "room" : "rooms"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Publish CTAs — state-driven (spec: 17_EDITORIAL_FLOW_SPEC.md §2)
          Only EMPTY and INTERVIEWED render here; GENERATED/UNPUBLISHED use the Publish tab. */}
      {/* Skip decision branch — shown after declining finish schedule upload */}
      {showSkipDecision && (
        <div className="rounded-[20px] border border-folio-border-subtle bg-surface-ground p-6 space-y-3">
          <h4 className="folio-ui font-semibold text-folio-text-primary">What would you like to do?</h4>
          <p className="folio-meta text-folio-text-secondary">
            You can tag products on your images now, or go straight to the interview.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleSkipDecisionInterview}
              className="flex-1 px-4 py-3 folio-ui font-semibold text-white bg-[var(--accent)] rounded-2xl hover:bg-[var(--accent-hover)] transition-colors"
            >
              Continue to Interview
            </button>
            <button
              onClick={handleSkipDecisionTag}
              className="flex-1 px-4 py-3 folio-ui font-medium text-folio-text-primary bg-surface-canvas border border-folio-border-subtle rounded-2xl hover:bg-surface-ground transition-colors flex items-center justify-center gap-2"
            >
              <Tag className="w-4 h-4" />
              Tag Products First
            </button>
          </div>
        </div>
      )}

      {editorialState === 'INTERVIEWED' ? (
        <div className="flex gap-3">
          <button
            onClick={handleGenerateStory}
            disabled={isGenerating || flow.regenBusy}
            className="flex-1 px-6 py-4 folio-ui font-semibold text-white bg-[var(--accent)] rounded-2xl hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isGenerating || flow.regenBusy ? "Generating..." : "Generate Story"}
          </button>
          <button
            onClick={handleOpenInterview}
            className="px-6 py-4 folio-ui font-medium text-folio-text-secondary bg-surface-canvas border border-folio-border-subtle rounded-2xl hover:bg-surface-ground transition-colors"
          >
            Redo Interview
          </button>
        </div>
      ) : (
        /* EMPTY or no editorialState — default "Proceed to Publish" opens interview */
        <button
          onClick={handleOpenInterview}
          className="w-full px-6 py-4 folio-ui font-semibold text-white bg-[var(--accent)] rounded-2xl hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
        >
          Proceed to Publish
        </button>
      )}

      {/* Entry Point B: Tag Products secondary button — always visible */}
      <button
        onClick={() => setShowTagger(true)}
        className="w-full px-4 py-3 folio-ui font-medium text-folio-text-secondary bg-transparent border border-folio-border-subtle rounded-2xl hover:bg-surface-ground transition-colors flex items-center justify-center gap-2"
      >
        <Tag className="w-4 h-4" />
        Tag Products
        {tagCount > 0 && (
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
            {tagCount} tagged
          </span>
        )}
      </button>

      {/* Error */}
      {flow.error && (
        <div className="p-4 bg-surface-elevated border border-folio-border-strong text-[rgb(74,44,59)] rounded-[20px] folio-ui">
          {flow.error}
        </div>
      )}

      {/* Entry Point A: Finish Schedule gate — shown before interview */}
      <FinishScheduleOptionsModal
        open={showFinishScheduleModal}
        onOpenChange={setShowFinishScheduleModal}
        projectId={project.id}
        onComplete={handleFinishScheduleComplete}
      />

      {/* Interview Modal — the guided interview is the path to publishing */}
      <InterviewModal
        open={showInterviewModal}
        onOpenChange={(open) => setShowInterviewModal(open)}
        projectId={project.id}
        projectName={project.title}
        images={images}
        post={projectPost}
        onDraftGenerated={handleDraftGenerated}
      />

      {/* ProjectImageTagger — opened from skip decision or Tag Products button */}
      {showTagger && (
        <ProjectImageTagger
          projectId={project.id}
          onClose={handleTaggerClose}
        />
      )}
    </div>
  );
}
