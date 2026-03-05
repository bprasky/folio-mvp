"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Sparkles, MapPin, ImageIcon, LayoutGrid } from "lucide-react";
import { usePublishFlow } from "@/hooks/usePublishFlow";
import { InterviewModal } from "@/components/posting/interview/InterviewModal";
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
  const [isGenerating, setIsGenerating] = useState(false);

  const roomCount = project.rooms?.length || 0;
  const location = [project.city, project.regionState].filter(Boolean).join(", ");
  const typeLabel = PROJECT_TYPE_LABELS[project.projectType || ""] || project.projectType || "";

  function handleOpenInterview() {
    setShowInterviewModal(true);
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
      <div className="border-t border-[var(--border-default)] pt-6">
        <h3 className="folio-ui font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
          Ready to publish?
        </h3>
      </div>

      {/* Project Summary Card */}
      <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm overflow-hidden">
        <button
          onClick={() => setSummaryExpanded(!summaryExpanded)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
        >
          <h3 className="folio-h3 text-[var(--text-primary)]">Project Details</h3>
          {summaryExpanded ? (
            <ChevronUp className="w-5 h-5 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />
          )}
        </button>

        {summaryExpanded && (
          <div className="px-6 pb-5 space-y-3">
            {/* Project title */}
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
              <div>
                <p className="folio-meta text-[var(--text-tertiary)]">Title</p>
                <p className="folio-body text-[var(--text-primary)]">{project.title || "Untitled Project"}</p>
              </div>
            </div>

            {/* Project type */}
            {typeLabel && typeLabel !== "Unspecified" && (
              <div className="flex items-start gap-3">
                <LayoutGrid className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                <div>
                  <p className="folio-meta text-[var(--text-tertiary)]">Type</p>
                  <p className="folio-body text-[var(--text-primary)]">{typeLabel}</p>
                </div>
              </div>
            )}

            {/* Location */}
            {location && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                <div>
                  <p className="folio-meta text-[var(--text-tertiary)]">Location</p>
                  <p className="folio-body text-[var(--text-primary)]">{location}</p>
                </div>
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-3 pt-2">
              <ImageIcon className="w-4 h-4 text-[var(--accent)] shrink-0" />
              <div className="flex items-center gap-4">
                <span className="folio-ui text-[var(--text-secondary)]">
                  {imageCount} {imageCount === 1 ? "image" : "images"}
                </span>
                {roomCount > 0 && (
                  <span className="folio-ui text-[var(--text-secondary)]">
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
            className="px-6 py-4 folio-ui font-medium text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border-default)] rounded-2xl hover:bg-[var(--bg-elevated)] transition-colors"
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

      {/* Error */}
      {flow.error && (
        <div className="p-4 bg-stone-100 border border-stone-300 text-[rgb(74,44,59)] rounded-[20px] folio-ui">
          {flow.error}
        </div>
      )}

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
    </div>
  );
}
