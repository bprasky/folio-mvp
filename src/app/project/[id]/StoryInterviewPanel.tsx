"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Mic, RotateCcw, Pencil, Check, Sparkles } from "lucide-react";
import { InterviewModal } from "@/components/posting/interview/InterviewModal";
import { EditReflectionModal } from "@/components/posting/interview/EditReflectionModal";

type QA = {
  q: string;
  a: string;
  questionId?: string;
  roomId?: string | null;
  section?: string;
  isFeatured?: boolean;
};

/** Per-room interview coverage, computed server-side by the interview GET. */
type Coverage = {
  roomId: string;
  roomName: string;
  answered: number;
  total: number;
  complete: boolean;
};

interface StoryInterviewPanelProps {
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
 * StoryInterviewPanel — the interview surface on the Story tab.
 *
 * This is where the designer's story progress lives, deliberately separate from
 * the Tags progress in the header tracker: the interview has its own arc
 * (answer → review → generate) and its own advisory about what the article can
 * and can't include yet.
 *
 * It owns four things:
 *  - Resume / Restart the interview (the modal opens straight to the right place).
 *  - The saved Q&A, editable — clicking one reopens the interview modal on that
 *    exact question, pre-filled, and saves-and-closes.
 *  - Coverage: which rooms are answered (and will be written up) vs which aren't
 *    (their photos still appear as gallery chapters).
 *  - Generate the draft. On success the Publish tab opens with that draft.
 */
export default function StoryInterviewPanel({
  projectId,
  projectName,
  images,
}: StoryInterviewPanelProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<QA[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [intent, setIntent] = useState<"resume" | "restart" | null>(null);
  // Set when editing one answer: opens the full interview modal jumped to that
  // question, pre-filled. Falls back to the reflection editor only for answers
  // with no questionId to jump to.
  const [jumpQuestionId, setJumpQuestionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<QA | null>(null);

  const fetchAnswers = useCallback(async () => {
    try {
      const res = await fetch(`/api/posting/project/${projectId}/interview`);
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data.answers) ? data.answers : [];
        const mapped: QA[] = raw
          .map((a: any) => ({
            // The GET backfills `prompt` from the persisted question set, so
            // answers saved before question text was stored still read correctly.
            q: a.prompt || a.question || a.q || "",
            a: a.answer || a.a || "",
            questionId: a.questionId || a.id,
            roomId: a.roomId ?? null,
            section: a.section,
            isFeatured: !!a.isFeatured,
          }))
          .filter((qa: QA) => (qa.q || "").trim() || (qa.a || "").trim());
        setAnswers(mapped);
        setCoverage(Array.isArray(data.coverage) ? data.coverage : []);
      }
    } catch (err) {
      console.error("[StoryInterviewPanel] Failed to load answers", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAnswers();
  }, [fetchAnswers]);

  // Rooms whose write-up the article can actually include vs those it can't yet.
  const { included, pending } = useMemo(
    () => ({
      included: coverage.filter((c) => c.complete),
      pending: coverage.filter((c) => !c.complete),
    }),
    [coverage],
  );

  const hasAnswers = answers.length > 0;
  const canGenerate = hasAnswers && included.length > 0 && !generating;

  function openResume() {
    setJumpQuestionId(null);
    setIntent("resume");
    setInterviewOpen(true);
  }

  function editAnswer(qa: QA) {
    if (qa.questionId) {
      // Open the full interview modal jumped to this question, pre-filled.
      setIntent(null);
      setJumpQuestionId(qa.questionId);
      setInterviewOpen(true);
    } else {
      // No id to jump to — fall back to the standalone pre-filled editor.
      setEditing(qa);
    }
  }

  function openRestart() {
    const ok = window.confirm(
      "This clears your saved interview answers and starts a new interview. Continue?",
    );
    if (!ok) return;
    setJumpQuestionId(null);
    setIntent("restart");
    setInterviewOpen(true);
  }

  function handleInterviewOpenChange(open: boolean) {
    setInterviewOpen(open);
    if (!open) {
      // Re-sync once the modal closes: answers may have changed (resume added
      // some, restart cleared them, an edit updated one). router.refresh()
      // re-derives the tracker / editorial state to match.
      setIntent(null);
      setJumpQuestionId(null);
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
              prompt: qa.q || "",
              roomId: qa.roomId ?? null,
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

  /**
   * Generate the draft from the answers already saved on the server, then open
   * the Publish tab on it. Only complete rooms are composed into the story —
   * the server withholds images for rooms outside completedRoomIds, so partly
   * answered rooms become gallery chapters rather than thin write-ups.
   */
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const completedRoomIds = included.map((c) => c.roomId);
      const res = await fetch(
        `/api/posting/project/${projectId}/interview/generate?forceOverwriteDraft=true&mode=recomposition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            forceOverwriteDraft: true,
            mode: "recomposition",
            completedRoomIds,
          }),
        },
      );

      // 202 = generation accepted and still running; the Publish tab shows its
      // own progress/empty state until the draft lands.
      if (!res.ok && res.status !== 202) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Draft generation failed. Please try again.");
      }

      router.push(`/project/${projectId}?view=publish`);
      router.refresh();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Draft generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [projectId, included, router]);

  return (
    <div className="space-y-6">
      {/* Header + interview actions */}
      <div className="rounded-[20px] border border-folio-border-subtle bg-surface-ground p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="folio-h3 text-folio-text-primary">Your story</h2>
            <p className="folio-meta text-folio-text-tertiary mt-1">
              {hasAnswers
                ? `${answers.length} answer${answers.length !== 1 ? "s" : ""} saved. Resume where you left off, or edit any answer below.`
                : "Answer a few questions about this project and we'll write the draft for you."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openResume}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--accent)] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            >
              <Mic className="h-4 w-4" aria-hidden />
              {hasAnswers ? "Resume interview" : "Start interview"}
            </button>
            {hasAnswers && (
              <button
                type="button"
                onClick={openRestart}
                className="inline-flex items-center gap-2 rounded-[10px] border border-folio-border-subtle px-4 py-2.5 text-[14px] font-medium text-folio-text-secondary transition-colors hover:border-folio-border-strong hover:text-folio-text-primary"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Restart
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Coverage + generate */}
      {hasAnswers && coverage.length > 0 && (
        <div className="rounded-[20px] border border-folio-border-subtle bg-surface-ground p-6 shadow-sm">
          <h2 className="folio-h3 text-folio-text-primary">Ready to write</h2>
          <p className="folio-meta text-folio-text-tertiary mt-1">
            Here&apos;s what your article can include right now.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-folio-text-tertiary">
                Will be written up ({included.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {included.length === 0 && (
                  <li className="folio-ui text-folio-text-tertiary italic">
                    Nothing fully answered yet.
                  </li>
                )}
                {included.map((c) => (
                  <li
                    key={c.roomId}
                    className="flex items-center gap-2 text-[14px] text-folio-text-primary"
                  >
                    <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
                    {c.roomName}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-folio-text-tertiary">
                Not yet ({pending.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {pending.length === 0 && (
                  <li className="folio-ui text-folio-text-tertiary italic">
                    Everything is answered.
                  </li>
                )}
                {pending.map((c) => (
                  <li key={c.roomId} className="text-[14px] text-folio-text-secondary">
                    {c.roomName}{" "}
                    <span className="text-folio-text-tertiary tabular-nums">
                      ({c.answered}/{c.total})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {pending.length > 0 && (
            <p className="folio-meta text-folio-text-secondary mt-4">
              Photos from unanswered rooms still appear in the gallery at the bottom of your
              article — they just aren&apos;t written up. You can come back and add them anytime.
            </p>
          )}

          {generateError && (
            <p className="folio-meta mt-4 text-[rgb(74,44,59)]">{generateError}</p>
          )}

          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--accent)] px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {generating ? "Generating draft…" : "Generate draft"}
            </button>
            {!canGenerate && !generating && (
              <span className="folio-meta text-folio-text-tertiary">
                Finish at least one room to generate.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Saved Q&A — each row opens the interview modal on that question */}
      <div className="rounded-[20px] border border-folio-border-subtle bg-surface-ground p-6 shadow-sm">
        <h2 className="folio-h3 text-folio-text-primary mb-1">Your answers</h2>
        <p className="folio-meta text-folio-text-tertiary mb-4">
          Click any answer to edit it in the interview.
        </p>

        {loading ? (
          <p className="folio-ui text-folio-text-tertiary">Loading your answers…</p>
        ) : answers.length === 0 ? (
          <p className="folio-ui text-folio-text-tertiary italic">
            No answers yet. Start the interview to build your story.
          </p>
        ) : (
          <ul className="space-y-2">
            {answers.map((qa, i) => (
              <li key={qa.questionId || i}>
                <button
                  type="button"
                  onClick={() => editAnswer(qa)}
                  title="Edit this answer"
                  className="group w-full rounded-[12px] border border-folio-border-subtle bg-surface-canvas px-4 py-3 text-left transition-colors hover:border-[var(--accent)]"
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
        )}
      </div>

      {/* Full interview flow — resume, restart, or edit-jump. Mounted only while
          open so its question-generation hooks (which fetch on mount, not on
          Dialog-open) don't fire on every Story tab view. */}
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
          jumpToQuestionId={jumpQuestionId}
        />
      )}

      {/* Edit a single saved answer, pre-filled (answers with no id to jump to) */}
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
