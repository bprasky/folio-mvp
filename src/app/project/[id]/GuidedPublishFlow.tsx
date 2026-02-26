"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Sparkles, MapPin, ImageIcon, LayoutGrid } from "lucide-react";
import { usePublishFlow } from "@/hooks/usePublishFlow";
import { InterviewModal } from "@/components/posting/interview/InterviewModal";
import PublishPreviewModal from "./PublishPreviewModal";

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

export default function GuidedPublishFlow({ project, imageCount, images, projectPost }: GuidedPublishFlowProps) {
  const router = useRouter();
  const flow = usePublishFlow(project.id);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const roomCount = project.rooms?.length || 0;
  const location = [project.city, project.regionState].filter(Boolean).join(", ");
  const typeLabel = PROJECT_TYPE_LABELS[project.projectType || ""] || project.projectType || "";

  // Does a draft already exist from a previous session?
  const hasDraft = !!flow.currentPost && !!(flow.currentLead?.title || flow.currentLead?.kicker);

  function handleProceedToPublish() {
    setShowInterviewModal(true);
  }

  function handlePreviewAndPublish() {
    // Skip interview — go straight to preview modal with existing draft
    setShowPreviewModal(true);
  }

  async function handleDraftGenerated() {
    // Interview completed and draft was generated — refetch draft data, then show preview
    await flow.refetch();
    setShowPreviewModal(true);
  }

  function handlePublishSuccess() {
    setShowPreviewModal(false);
    router.refresh();
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
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm overflow-hidden">
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

      {/* Publish CTAs */}
      {hasDraft ? (
        <div className="flex gap-3">
          <button
            onClick={handlePreviewAndPublish}
            className="flex-1 px-6 py-4 folio-ui font-semibold text-white bg-[var(--accent)] rounded-2xl hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
          >
            Preview &amp; Publish
          </button>
          <button
            onClick={handleProceedToPublish}
            className="px-6 py-4 folio-ui font-medium text-[var(--text-secondary)] bg-[var(--bg-base)] border border-[var(--border-default)] rounded-2xl hover:bg-[var(--bg-elevated)] transition-colors"
          >
            Redo Interview
          </button>
        </div>
      ) : (
        <button
          onClick={handleProceedToPublish}
          className="w-full px-6 py-4 folio-ui font-semibold text-white bg-[var(--accent)] rounded-2xl hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
        >
          Proceed to Publish
        </button>
      )}

      {/* Error */}
      {flow.error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg folio-ui">
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

      {/* Preview Modal — shown after interview completes and draft is generated */}
      {showPreviewModal && (
        <PublishPreviewModal
          projectId={project.id}
          flow={flow}
          onClose={() => setShowPreviewModal(false)}
          onPublishSuccess={handlePublishSuccess}
        />
      )}
    </div>
  );
}
