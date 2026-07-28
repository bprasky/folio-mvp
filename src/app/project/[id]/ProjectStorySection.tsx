"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, RotateCcw, Pencil } from "lucide-react";
import { InterviewModal } from "@/components/posting/interview/InterviewModal";
import { EditReflectionModal } from "@/components/posting/interview/EditReflectionModal";

type QA = {
  q: string;
  a: string;
  questionId?: string;
  section?: string;
  isFeatured?: boolean;
};

interface ProjectStorySectionProps {
  projectId: string;
  projectName: string;
  images: Array<{
    id: string;
    url: string;
    name?: string | null;
    room?: string | null;
    roomId?: string | null;
    displayOrder?: number | null;
  }>;
}

/**
 * ProjectStorySection — the "Your story so far" region inside the Project
 * Progress Tracker card. It renders only once the designer has saved interview
 * answers, and gives them, right there in the tracker (no navigation, no laggy
 * "Continue to interview" round-trip):
 *
 *  - Resume interview  → opens the interview modal straight to where they left
 *    off (initialIntent="resume" skips the "Welcome back" screen + the Q1 flash).
 *  - Restart interview → clears saved answers and starts fresh.
 *  - An editable list of their saved Q&A. Editing one opens the shared
 *    EditReflectionModal pre-filled on that exact answer (the full interview
 *    modal can't reopen pinned to one past question — its question IDs are
 *    regenerated each session — so this is the reliable in-place editor).
 */
export default function ProjectStorySection({
  projectId,
  projectName,
  images,
}: ProjectStorySectionProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<QA[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [intent, setIntent] = useState<"resume" | "restart" | null>(null);
  const [editing, setEditing] = useState<QA | null>(null);

  const fetchAnswers = useCallback(async () => {
    try {
      const res = await fetch(`/api/posting/project/${projectId}/interview`);
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data.answers) ? data.answers : [];
        const mapped: QA[] = raw
          .map((a: any) => ({
            q: a.question || a.q || a.prompt || "",
            a: a.answer || a.a || "",
            questionId: a.questionId || a.id,
            section: a.section,
            isFeatured: !!a.isFeatured,
          }))
          .filter((qa: QA) => (qa.q || "").trim() || (qa.a || "").trim());
        setAnswers(mapped);
      }
    } catch (err) {
      console.error("[ProjectStorySection] Failed to load answers", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAnswers();
  }, [fetchAnswers]);

  function openResume() {
    setIntent("resume");
    setInterviewOpen(true);
  }

  function openRestart() {
    const ok = window.confirm(
      "This clears your saved interview answers and starts a new interview. Continue?",
    );
    if (!ok) return;
    setIntent("restart");
    setInterviewOpen(true);
  }

  function handleInterviewOpenChange(open: boolean) {
    setInterviewOpen(open);
    if (!open) {
      // Re-sync once the modal closes: answers may have changed (resume added
      // some, restart cleared them). router.refresh() re-derives the tracker /
      // editorial state so this section appears or disappears accordingly.
      setIntent(null);
      fetchAnswers();
      router.refresh();
    }
  }

  const commitEdit = useCallback(
    async (target: QA, nextAnswer: string, nextQuestion: string) => {
      setSaving(true);
      try {
        const next = answers.map((qa) =>
          qa === target ? { ...qa, a: nextAnswer, q: nextQuestion } : qa,
        );
        // POST merges non-destructively by questionId, so sending the full list
        // updates the edited answer and leaves the rest untouched.
        const res = await fetch(`/api/posting/project/${projectId}/interview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: next.map((qa) => ({
              questionId: qa.questionId || qa.q,
              answer: qa.a || "",
              question: qa.q || "",
              isFeatured: !!qa.isFeatured,
            })),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save answer");
        }
        setAnswers(next);
        setEditing(null);
        await fetchAnswers();
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to save answer");
      } finally {
        setSaving(false);
      }
    },
    [answers, projectId, fetchAnswers, router],
  );

  return (
    <div className="px-8 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-folio-gold-ornament">
            Story · In progress
          </p>
          <h3 className="mt-1.5 text-[19px] font-semibold text-folio-text-primary">
            Your story so far
          </h3>
          <p className="mt-1 text-[14px] leading-relaxed text-folio-text-secondary">
            {answers.length > 0
              ? `${answers.length} answer${answers.length !== 1 ? "s" : ""} saved. Resume where you left off, start over, or edit any answer below.`
              : "Your interview is in progress. Resume where you left off or start over."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={openResume}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--accent)] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors duration-[220ms] hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
          >
            <Mic className="h-4 w-4" aria-hidden />
            Resume interview
          </button>
          <button
            type="button"
            onClick={openRestart}
            className="inline-flex items-center gap-2 rounded-[10px] border border-folio-border-subtle px-4 py-2.5 text-[14px] font-medium text-folio-text-secondary transition-colors duration-[220ms] hover:border-folio-border-strong hover:text-folio-text-primary"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Restart
          </button>
        </div>
      </div>

      {/* Saved Q&A — each row opens the pre-filled editor modal */}
      {loading ? (
        <p className="mt-5 text-[14px] text-folio-text-tertiary">Loading your answers…</p>
      ) : answers.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {answers.map((qa, i) => (
            <li key={qa.questionId || i}>
              <button
                type="button"
                onClick={() => setEditing(qa)}
                title="Edit this answer"
                className="group w-full rounded-[12px] border border-folio-border-subtle bg-surface-canvas px-4 py-3 text-left transition-colors duration-[220ms] hover:border-[var(--accent)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-folio-text-primary">
                      {qa.q || "Untitled question"}
                    </p>
                    {(qa.a || "").trim() ? (
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[14px] leading-relaxed text-folio-text-secondary">
                        {qa.a}
                      </p>
                    ) : (
                      <p className="mt-1 text-[14px] italic text-folio-text-tertiary">
                        No answer yet — click to add
                      </p>
                    )}
                  </div>
                  <Pencil
                    className="h-4 w-4 shrink-0 text-folio-text-tertiary transition-colors group-hover:text-[var(--accent)]"
                    aria-hidden
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Full interview flow — resume or restart. Mounted only while open so its
          question-generation hooks (which fetch on mount, not on Dialog-open)
          don't fire LLM calls on every project page load. */}
      {interviewOpen && (
        <InterviewModal
          open
          onOpenChange={handleInterviewOpenChange}
          projectId={projectId}
          projectName={projectName}
          images={images.map((img) => ({
            id: img.id,
            url: img.url,
            name: img.name ?? undefined,
            room: img.room ?? null,
            roomId: img.roomId ?? null,
            displayOrder: img.displayOrder ?? null,
          }))}
          initialIntent={intent}
        />
      )}

      {/* Edit a single saved answer, pre-filled */}
      {editing && (
        <EditReflectionModal
          question={editing.q}
          initialValue={editing.a}
          questionId={editing.questionId || ""}
          section={editing.section || ""}
          saving={saving}
          onCancel={() => setEditing(null)}
          onConfirm={(nextAnswer, nextQuestion) =>
            commitEdit(editing, nextAnswer, nextQuestion)
          }
        />
      )}
    </div>
  );
}
