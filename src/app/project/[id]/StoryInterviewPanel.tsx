"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Mic, RotateCcw, Pencil, Check, Sparkles } from "lucide-react";
import { InterviewModal } from "@/components/posting/interview/InterviewModal";
import {
  EditReflectionModal,
  parseCategoryLabel,
} from "@/components/posting/interview/EditReflectionModal";

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

/** One room's worth of saved answers, in the order the interview asked them. */
type AnswerGroup = {
  key: string;
  name: string;
  answers: QA[];
  /** Per-room coverage, when the interview knows the room's question budget. */
  coverage?: Coverage;
};

/** The pseudo-room every project-level answer belongs to. */
const PROJECT_GROUP_KEY = "project";
const PROJECT_GROUP_NAME = "About This Project";

/**
 * Which room an answer belongs to. `roomId` is first-class on saved answers, and
 * the interview stores project-level answers with none (the 'project'
 * pseudo-room collapses to null on save), so a missing roomId means "about the
 * project as a whole".
 */
function groupKeyFor(qa: QA): string {
  if (typeof qa.roomId === "string" && qa.roomId) return qa.roomId;
  return PROJECT_GROUP_KEY;
}

/**
 * Group the saved answers by room: About This Project first, then the project's
 * rooms in their own order, then anything whose room no longer exists. Rooms
 * come from the Room rows (passed in from the page), not from the interview's
 * question set — that set is regenerated whenever the project is retagged, so it
 * can't be trusted to still name every room the answers refer to.
 */
function groupAnswers(
  answers: QA[],
  rooms: Array<{ id: string; name: string }>,
  coverage: Coverage[],
): AnswerGroup[] {
  const byKey = new Map<string, QA[]>();
  for (const qa of answers) {
    const key = groupKeyFor(qa);
    const list = byKey.get(key);
    if (list) list.push(qa);
    else byKey.set(key, [qa]);
  }

  const coverageByRoom = new Map(coverage.map((c) => [c.roomId, c]));
  const nameFor = (key: string) =>
    key === PROJECT_GROUP_KEY
      ? PROJECT_GROUP_NAME
      : rooms.find((r) => r.id === key)?.name ??
        coverageByRoom.get(key)?.roomName ??
        "Another room";

  const ordered = [PROJECT_GROUP_KEY, ...rooms.map((r) => r.id)];
  const groups: AnswerGroup[] = [];
  for (const key of ordered) {
    const list = byKey.get(key);
    if (!list?.length) continue;
    byKey.delete(key);
    groups.push({ key, name: nameFor(key), answers: list, coverage: coverageByRoom.get(key) });
  }
  // Whatever is left belongs to a room that has since been renamed away or
  // deleted. Keep the answers — losing them from the list would read as data loss.
  for (const [key, list] of Array.from(byKey.entries())) {
    groups.push({ key, name: nameFor(key), answers: list, coverage: coverageByRoom.get(key) });
  }
  return groups;
}

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
  /** The project's rooms, in project order — used to group the saved answers. */
  rooms: Array<{ id: string; name: string }>;
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
 *  - The saved Q&A, grouped by room and editable — clicking one opens the
 *    single-answer editor pre-filled on that question.
 *  - Coverage: which rooms are answered (and will be written up) vs which aren't
 *    (their photos still appear as gallery chapters).
 *  - Generate the draft. On success the Publish tab opens with that draft.
 */
export default function StoryInterviewPanel({
  projectId,
  projectName,
  images,
  rooms,
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
  // The one answer being edited. Editing goes through the standalone editor, NOT
  // the interview modal: the modal owns the whole flow (it regenerates the
  // question set, fires the rooms-generation phase, and resumes/finishes the
  // interview), so opening it to change one saved answer restarted the interview
  // and landed the designer on the generation screen instead of their answer.
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

  // The saved answers, grouped by the room they were asked about.
  const groups = useMemo(
    () => groupAnswers(answers, rooms, coverage),
    [answers, rooms, coverage],
  );

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
      // some, restart cleared them, an edit updated one). router.refresh()
      // re-derives the tracker / editorial state to match.
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

      {/* Saved Q&A, grouped by room — each row opens the single-answer editor */}
      <div className="rounded-[20px] border border-folio-border-subtle bg-surface-ground p-6 shadow-sm">
        <h2 className="folio-h3 text-folio-text-primary mb-1">Your answers</h2>
        <p className="folio-meta text-folio-text-tertiary mb-5">
          Grouped by room, in the order we asked. Click any answer to edit it.
        </p>

        {loading ? (
          <p className="folio-ui text-folio-text-tertiary">Loading your answers…</p>
        ) : answers.length === 0 ? (
          <p className="folio-ui text-folio-text-tertiary italic">
            No answers yet. Start the interview to build your story.
          </p>
        ) : (
          <div className="space-y-7">
            {groups.map((group) => (
              <section key={group.key}>
                <div className="mb-2.5 flex items-baseline justify-between gap-3 border-b border-folio-border-subtle pb-2">
                  <h3 className="font-serif text-[17px] text-folio-text-primary">
                    {group.name}
                  </h3>
                  {/* Counted from the rows actually listed below, so the header
                      can never disagree with what's on screen; the denominator
                      is the room's question budget when the interview knows it. */}
                  <span className="folio-meta shrink-0 text-folio-text-tertiary tabular-nums">
                    {group.coverage && group.coverage.total > 0
                      ? `${group.answers.length} of ${group.coverage.total} answered`
                      : `${group.answers.length} answer${group.answers.length !== 1 ? "s" : ""}`}
                  </span>
                </div>

                <ul className="space-y-2">
                  {group.answers.map((qa, i) => (
                    <li key={qa.questionId || `${group.key}-${i}`}>
                      <AnswerRow qa={qa} onEdit={() => setEditing(qa)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Full interview flow — resume or restart. Mounted only while open so its
          question-generation hooks (which fetch on mount, not on Dialog-open)
          don't fire on every Story tab view. */}
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

      {/* Edit one saved answer, pre-filled. No question generation, no LLM call,
          no interview flow — it saves this answer by questionId and closes. */}
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

/**
 * One saved answer. The question it answers is the point of the row, so it leads
 * with the question text and the category the questionId encodes
 * (`room-<roomId>-MATERIALS-<uuid>` → "Materials"). Answers saved before the
 * interview persisted its prompts have no text to show — the category still
 * places them, and the editor lets the designer write the question in.
 */
function AnswerRow({ qa, onEdit }: { qa: QA; onEdit: () => void }) {
  const category = parseCategoryLabel(qa.questionId || "");
  const question = (qa.q || "").trim();
  const answer = (qa.a || "").trim();

  return (
    <button
      type="button"
      onClick={onEdit}
      title="Edit this answer"
      className="group w-full rounded-[12px] border border-folio-border-subtle bg-surface-canvas px-4 py-3 text-left transition-colors hover:border-[var(--accent)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {category && (
            <p className="folio-meta uppercase tracking-wider text-folio-text-tertiary">
              {category}
            </p>
          )}
          {question ? (
            <p className="mt-0.5 text-[14px] font-medium text-folio-text-primary">
              {question}
            </p>
          ) : (
            <p className="mt-0.5 text-[14px] italic text-folio-text-tertiary">
              Question text wasn&apos;t saved — click to add it
            </p>
          )}
          {answer ? (
            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[14px] leading-relaxed text-folio-text-secondary">
              {answer}
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
  );
}
