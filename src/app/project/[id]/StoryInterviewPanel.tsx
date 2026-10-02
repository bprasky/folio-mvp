"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown } from "lucide-react";
import { InterviewModal } from "@/components/posting/interview/InterviewModal";
import { AnswerModal } from "@/components/posting/interview/AnswerModal";
import { useProjectConversation } from '@/components/interviews/ProjectConversationHost';
import GenerationContextOptions, { useGenerationContext, type ContextChoice } from "@/components/posting/GenerationContextOptions";

type QA = { q: string; a: string; questionId?: string; roomId: string | null; isFeatured?: boolean };
type Coverage = { roomId: string; answered: number; total: number };
type PanelImage = { id: string; url: string; name?: string | null; room?: string | null; roomId?: string | null; displayOrder?: number | null };
interface StoryInterviewPanelProps {
  projectId: string;
  projectName: string;
  images: PanelImage[];
  rooms: Array<{ id: string; name: string }>;
  untaggedPhotoCount: number;
  taggedPhotoCount: number;
}

const primaryButton = "rounded-sm bg-folio-text-primary px-5 py-3 text-folio-ui font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold disabled:cursor-not-allowed disabled:opacity-40";
const quietButton = "rounded-sm px-3 py-2 text-folio-ui text-folio-text-secondary underline underline-offset-4 hover:text-folio-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold disabled:opacity-40";
const dialogClass = "fixed left-1/2 top-1/2 z-[81] max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-folio-border-subtle bg-surface-canvas p-6 shadow-folio3 focus:outline-none";

/** A paused interview has one next action. Review and draft choices are deliberate disclosures. */
export default function StoryInterviewPanel({ projectId, projectName, images, rooms, untaggedPhotoCount, taggedPhotoCount }: StoryInterviewPanelProps) {
  const conversation = useProjectConversation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const consumedEntryRef = useRef(false);
  const readSequence = useRef(0);
  const [answers, setAnswers] = useState<QA[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [guided, setGuided] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showRestart, setShowRestart] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [editing, setEditing] = useState<QA | null>(null);
  const [interview, setInterview] = useState<{ intent: "resume" | "restart"; roomId?: string | null; mode?: "realtime" } | null>(null);
  const contextAvailability = useGenerationContext(projectId);
  const [contextChoice, setContextChoice] = useState<ContextChoice>({ includeBio: true, includeProjectHistory: true });

  const fetchAnswers = useCallback(async () => {
    const sequence = ++readSequence.current;
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch(`/api/posting/project/${projectId}/interview?savedOnly=1`);
      if (!response.ok) throw new Error("Saved answers unavailable");
      const data = await response.json();
      const mapped: QA[] = (Array.isArray(data.answers) ? data.answers : []).map((answer: Record<string, unknown>) => ({
        q: String(answer.prompt || answer.question || answer.q || ""),
        a: typeof answer.answer === "string" ? answer.answer : typeof answer.a === "string" ? answer.a : "",
        questionId: typeof answer.questionId === "string" ? answer.questionId : typeof answer.id === "string" ? answer.id : undefined,
        roomId: typeof answer.roomId === "string" ? answer.roomId : null,
        isFeatured: !!answer.isFeatured,
      })).filter((answer: QA) => answer.a.trim().length > 0);
      if (sequence !== readSequence.current) return;
      setAnswers(mapped);
      setCoverage(Array.isArray(data.coverage) ? data.coverage : []);
      setGuided(data.guided === true);
      setResetId(typeof data.resetId === "string" ? data.resetId : null);
      setStarted(mapped.length > 0 || data.guided === true || (data.selectedQuestionIds?.length ?? 0) > 0);
    } catch {
      if (sequence === readSequence.current) setLoadError(true);
    } finally {
      if (sequence === readSequence.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void fetchAnswers(); return () => { readSequence.current++; }; }, [fetchAnswers, conversation?.revision]);

  // Explicit project CTAs still open immediately, without waiting for this review read.
  const entryAction = searchParams.get("action");
  const entryRoomId = searchParams.get("room");
  useEffect(() => {
    if (conversation?.managed) return;
    if (entryAction !== "interview") { consumedEntryRef.current = false; return; }
    if (consumedEntryRef.current) return;
    consumedEntryRef.current = true;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("action"); params.delete("room");
    router.replace(`/project/${projectId}?${params.toString()}`, { scroll: false });
    setInterview({ intent: "resume", roomId: entryRoomId && rooms.some(room => room.id === entryRoomId) ? entryRoomId : undefined });
  }, [conversation?.managed, entryAction, entryRoomId, projectId, rooms, router, searchParams]);

  const hasAnswers = answers.length > 0;
  const writeUpRoomIds = useMemo(() => Array.from(new Set(answers.map(answer => answer.roomId).filter((id): id is string => !!id && id !== "project"))), [answers]);
  const canPrepareDraft = writeUpRoomIds.length > 0 && !loading && !loadError;
  const partialRooms = coverage.filter(room => writeUpRoomIds.includes(room.roomId) && room.total > room.answered);
  const contextFor = (answer: QA) => rooms.find(room => room.id === answer.roomId)?.name ?? (answer.roomId && answer.roomId !== "project" ? "Another room" : "About this project");

  function closeInterview(open: boolean) {
    if (open) return;
    setInterview(null);
    void fetchAnswers();
    router.refresh();
  }

  async function saveEdit(nextAnswer: string) {
    if (!editing) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/posting/project/${projectId}/interview`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetId, answers: [{ questionId: editing.questionId || editing.q, answer: nextAnswer, question: editing.q, prompt: editing.q, roomId: editing.roomId, isFeatured: editing.isFeatured }] }),
      });
      if (!response.ok) throw new Error("Could not save your change. Open the interview to correct this answer.");
      setEditing(null);
      await fetchAnswers();
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not save your change."); }
    finally { setSaving(false); }
  }

  async function generateDraft() {
    if (!canPrepareDraft || generating) return;
    setGenerating(true); setGenerateError(null);
    try {
      const response = await fetch(`/api/posting/project/${projectId}/interview/generate?forceOverwriteDraft=true&mode=recomposition`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceOverwriteDraft: true, mode: "recomposition", ...contextChoice, writeUpRoomIds }),
      });
      if (!response.ok && response.status !== 202) throw new Error("Draft generation failed. Please try again.");
      router.push(`/project/${projectId}?view=publish`); router.refresh();
    } catch (error) { setGenerateError(error instanceof Error ? error.message : "Draft generation failed."); }
    finally { setGenerating(false); }
  }

  return (
    <section aria-label="Your interview" className="max-w-3xl space-y-6">
      <div className={conversation?.managed ? 'space-y-3' : 'rounded-md border border-folio-border-subtle bg-surface-ground p-6 sm:p-8'}>
        <h2 className="font-headline text-folio-h3 text-folio-text-primary">{conversation?.managed ? 'Saved answers' : 'Your interview'}</h2>
        <p className="mt-2 text-folio-body text-folio-text-secondary" aria-live="polite">
          {loading ? "Loading your answers…" : loadError ? "Your saved answers could not be loaded." : hasAnswers
            ? `${answers.length} ${answers.length === 1 ? "answer" : "answers"} saved. Pick up where you left off.`
            : "Tell the story behind this project. You can pause whenever you like."}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {!conversation?.managed ? <button type="button" className={primaryButton} disabled={generating} onClick={() => setInterview({ intent: "resume" })}>
            {started || loading || loadError ? "Resume interview" : "Start interview"}
          </button> : null}
          {loadError && <button type="button" className={quietButton} onClick={() => void fetchAnswers()}>Retry loading answers</button>}
          {!conversation?.managed && (
            <Dialog.Root open={showRestart} onOpenChange={setShowRestart}>
              {started && !loading && !loadError && <Dialog.Trigger asChild><button type="button" className={quietButton} disabled={generating}>Start over</button></Dialog.Trigger>}
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
                <Dialog.Content className={dialogClass} onOpenAutoFocus={event => { event.preventDefault(); document.getElementById("keep-interview")?.focus(); }}>
                  <Dialog.Title className="font-headline text-folio-h4">Start this interview over?</Dialog.Title>
                  <Dialog.Description className="mt-3 text-folio-body text-folio-text-secondary">
                    This permanently clears your interview answers and conversation so you can begin with the first question. Photos, rooms, tags and any existing draft stay in place.
                  </Dialog.Description>
                  <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <Dialog.Close asChild><button id="keep-interview" type="button" className={quietButton}>Keep my answers</button></Dialog.Close>
                    <button type="button" className={primaryButton} onClick={() => { setShowRestart(false); setInterview({ intent: "restart" }); }}>Clear answers and start over</button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </div>
      </div>

      {hasAnswers && !loading && !loadError && (
        <details className="group border-b border-folio-border-subtle pb-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2 text-folio-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold">
            Review saved answers <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="divide-y divide-folio-border-subtle">
            {answers.map((answer, index) => (
              <li key={answer.questionId || index} className="py-5">
                <p className="text-folio-meta text-folio-text-tertiary">{contextFor(answer)}</p>
                <h3 className="mt-1 text-folio-body font-medium">{answer.q || "Saved answer"}</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-folio-body text-folio-text-secondary">{answer.a}</p>
                {!guided && <button type="button" className={`${quietButton} mt-2`} onClick={() => setEditing(answer)}>Edit answer</button>}
              </li>
            ))}
          </ul>
          {guided && <p className="text-folio-meta text-folio-text-secondary">To make a correction, resume the interview and choose “Correct this answer” in the conversation.</p>}
        </details>
      )}

      {canPrepareDraft && (
        <Dialog.Root open={showDraft} onOpenChange={open => { if (!generating) setShowDraft(open); }}>
          <Dialog.Trigger asChild><button type="button" className={quietButton}>Prepare draft</button></Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
            <Dialog.Content className={dialogClass} onEscapeKeyDown={event => { if (generating) event.preventDefault(); }} onPointerDownOutside={event => { if (generating) event.preventDefault(); }}>
              <Dialog.Title className="font-headline text-folio-h4">Prepare your draft</Dialog.Title>
              <Dialog.Description className="mt-3 text-folio-body text-folio-text-secondary">Turn your saved answers into an editable story. You’ll review it before publishing.</Dialog.Description>
              <div className="mt-5"><GenerationContextOptions availability={contextAvailability} value={contextChoice} onChange={setContextChoice} /></div>
              {untaggedPhotoCount > 0 && <p className="mt-4 text-folio-meta text-folio-text-secondary">{taggedPhotoCount} of {taggedPhotoCount + untaggedPhotoCount} photos are tagged. You can generate now, or <button type="button" className="underline underline-offset-4" disabled={generating} onClick={() => router.push(`/project/${projectId}?view=media&step=tags&action=tag`)}>finish tagging first</button>.</p>}
              {partialRooms.length > 0 && <p className="mt-3 text-folio-meta text-folio-text-secondary">Some rooms have fewer answers, so their sections may be shorter.</p>}
              {generateError && <p role="alert" className="mt-4 text-folio-meta text-folio-accent-700">{generateError}</p>}
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Dialog.Close asChild><button type="button" className={quietButton} disabled={generating}>Cancel</button></Dialog.Close>
                <button type="button" className={primaryButton} disabled={generating} onClick={() => void generateDraft()}>{generating ? "Generating draft…" : "Generate draft"}</button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {interview && <InterviewModal open onOpenChange={closeInterview} projectId={projectId} projectName={projectName}
        images={images.map(image => ({ ...image, name: image.name ?? undefined }))} disableLive={conversation?.manual} initialIntent={interview.intent} initialRoomId={interview.roomId ?? null} initialMode={interview.mode} />}
      {editing && <AnswerModal contextLabel={contextFor(editing)} position={{ index: answers.indexOf(editing) + 1, total: answers.length }} question={editing.q} initialValue={editing.a} saving={saving}
        onCancel={() => setEditing(null)} onSave={saveEdit} onReRecord={() => { setInterview({ intent: "resume", roomId: editing.roomId, mode: "realtime" }); setEditing(null); }} />}
    </section>
  );
}
