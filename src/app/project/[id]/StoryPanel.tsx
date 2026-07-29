"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { CreditsEditor } from "@/components/posting/CreditsEditor";
import type { CreditEntry } from "@/lib/posting/creditsSchema";
import StoryInterviewPanel from "./StoryInterviewPanel";

interface StoryPanelProps {
  projectId: string;
  project: { id: string; title: string };
  images: Array<{ id: string; url: string; name: string | null }>;
  isOwner: boolean;
}

/**
 * StoryPanel — the Story step's surface (step 4).
 *
 * Everything about the designer's words lives here and ONLY here: the
 * interview, the saved answers, what the article can include, and generating
 * the draft. The Tags step owns photos and products; it carries no interview
 * UI. Keeping the two apart is why this panel is deliberately thin — it hosts
 * the interview panel and the credits that ship with the published post.
 */
export default function StoryPanel({ projectId, project, images, isOwner }: StoryPanelProps) {
  const [credits, setCredits] = useState<CreditEntry[]>([]);
  const [creditsSaving, setCreditsSaving] = useState(false);

  // Rooms the last generation withheld because they weren't fully answered.
  // Stashed by InterviewModal in sessionStorage; shown once, then cleared.
  const [excludedRooms, setExcludedRooms] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Key mirrors getExcludedRoomsStorageKey in InterviewModal.
    const key = `folio.interview.excludedRooms.${projectId}`;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const names = JSON.parse(raw);
        if (Array.isArray(names) && names.length > 0) {
          setExcludedRooms(names.filter((n): n is string => typeof n === "string"));
        }
        window.sessionStorage.removeItem(key);
      }
    } catch {
      /* noop */
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/posting/project/${projectId}/credits`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCredits(data.credits || []);
        }
      } catch (error) {
        console.error("[StoryPanel] Credits fetch failed:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleCreditsChange(newCredits: CreditEntry[]) {
    setCredits(newCredits);
    setCreditsSaving(true);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/credits`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: newCredits }),
      });
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits || newCredits);
      }
    } catch (error) {
      console.error("[StoryPanel] Credits save failed:", error);
    } finally {
      setCreditsSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* The interview: progress, answers, coverage, and Generate. */}
      {isOwner && (
        <StoryInterviewPanel
          projectId={projectId}
          projectName={project.title}
          images={images}
        />
      )}

      {/* Rooms left out of the last generation for being unfinished */}
      {isOwner && excludedRooms.length > 0 && (
        <div className="rounded-2xl border border-folio-border-subtle bg-surface-ground p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="folio-ui font-semibold text-folio-text-primary">
                {excludedRooms.join(", ")}
              </p>
              {/* C5 — verbatim: rooms without a write-up now appear as photo-only
                  gallery chapters, not dropped. Published rooms are frozen. */}
              <p className="folio-meta text-folio-text-secondary mt-1">
                Photos from {excludedRooms.length} rooms will appear in the gallery at the bottom of your
                article. Come back anytime to write them up. The rooms you&apos;ve already published won&apos;t
                change.
              </p>
            </div>
            <button
              onClick={() => setExcludedRooms([])}
              className="shrink-0 text-folio-text-tertiary hover:text-folio-text-primary transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Project Credits — ships with the published post. */}
      <div className="rounded-[20px] border border-folio-border-subtle bg-surface-ground p-6 shadow-sm">
        <h2 className="folio-h3 text-folio-text-primary mb-1">Project Credits</h2>
        <p className="folio-meta text-folio-text-tertiary mb-4">
          Who else brought this project to life? Credits appear on your published post.
        </p>
        <CreditsEditor
          credits={credits}
          onChange={handleCreditsChange}
          saving={creditsSaving}
        />
      </div>
    </div>
  );
}
