"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FollowUpsForm } from "./FollowUpsForm";
import { FooterBar } from "./FooterBar";
import { QuestionCard } from "./QuestionCard";
import { InterviewModeSelector } from "./InterviewModeSelector";
import { RealtimeInterviewView } from "./RealtimeInterviewView";
import { flags, realtimeInterviewConfig } from "@/lib/flags";
import type { InterviewQuestion } from "@/lib/posting/interviewSchemas";
import type {
  InterviewAnswer,
  SixWCategory,
} from "@/lib/posting/interviewSchemas";
import { useInterviewQuestions } from "@/hooks/useInterviewQuestions";
import { useRoomInterviewQuestions } from "@/hooks/useRoomInterviewQuestions";
import { useRoomInterviewFlow } from "@/hooks/useRoomInterviewFlow";
import { useBackgroundEvaluation } from "@/hooks/useBackgroundEvaluation";
import { RoomChips } from "./RoomChips";
import { RoomPhoto, computeRoomHeroImage } from "./RoomPhoto";
import { GenerationProgress } from "@/components/ui/GenerationProgress";
import { computeRoundBudget } from "@/lib/editorial/roomPacing";
import type { RoomProgressStatus } from "@/lib/editorial/roomPacing";
import type { InterviewQuestion as ContextualQuestion } from "@/types/interview";

interface InterviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  images: Array<{
    id: string;
    url: string;
    name?: string;
    /** Free-text room (Room.id or room name), used to scope the room photo strip. */
    room?: string | null;
    /** FK to the Room model — the reliable way to match an image to its room. */
    roomId?: string | null;
    /** Sort key mirroring the generator's `orderBy: displayOrder asc`. */
    displayOrder?: number | null;
  }>;
  post?: any;
  hasVendors?: boolean;
  tags?: Array<{
    product?: {
      id: string;
      name: string;
      imageUrl?: string;
      vendor?: {
        name?: string;
      };
    };
  }>;
  /** When provided, called instead of router.push on successful draft generation. */
  onDraftGenerated?: () => void;
  /**
   * When set, the caller has already presented the resume/restart choice (e.g.
   * the Project Progress Tracker's "Your story so far" section), so the modal
   * skips its own "Welcome back" screen and acts on the intent directly:
   *  - 'resume'  → jump straight to where the designer left off (no Q1 flash).
   *  - 'restart' → clear saved answers and begin a fresh interview.
   */
  initialIntent?: 'resume' | 'restart' | null;
}

const SIX_W_SECTIONS = new Set(["why", "who", "what", "where", "when", "how"]);

// Minimum number of questions before coverage-based skipping is allowed
const MIN_QUESTIONS = 5;
const MAX_GENERATION_ATTEMPTS = 3;

type SaveResult = { ok: boolean; savedCount: number; totalCount: number };

// --- Editorial v1 hardening: helpers ---
type FollowupsApiResponse = {
  ok: boolean;
  followups: Array<{ id: string; text: string; source?: string; dedupeKey?: string; questionId: string }> | [];
  error?: 'llm_unavailable' | 'llm_error' | 'disabled' | string;
};

type QuestionUpdate = {
  id: string;
  status: 'covered' | 'morphed';
  morphedText?: string;
};

type SingleFollowUpApiResponse = {
  ok: boolean;
  followups: Array<{ id: string; text: string; source?: string; dedupeKey?: string; questionId: string }>;
  acknowledgment?: string;
  coveredQuestionIds?: string[];
  questionUpdates?: QuestionUpdate[];
  error?: string;
};

async function checkLLMHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health/llm', { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    console.info('[InterviewModal] LLM health:', data);
    return !!data?.ok;
  } catch (e) {
    console.warn('[InterviewModal] LLM health check failed:', e);
    return false;
  }
}

function logClient(event: string, payload?: unknown) {
  try {
    // Keep this lightweight to avoid leaking PII; payload is fine-grained.
    console.info(`[InterviewModal] ${event}`, payload ?? '');
  } catch { /* noop */ }
}

export function InterviewModal({
  open,
  onOpenChange,
  projectId,
  projectName = "your project",
  images,
  post,
  hasVendors = false,
  tags = [],
  onDraftGenerated,
  initialIntent = null,
}: InterviewModalProps) {
  const router = useRouter();
  // Interview mode: 'select' shows mode picker, 'realtime' for voice, 'text' for traditional
  const [interviewMode, setInterviewMode] = useState<"select" | "realtime" | "text">(
    flags.realtimeInterview && realtimeInterviewConfig.enabled ? "select" : "text"
  );
  // Phase: question → followup → complete (pick phase removed — all questions auto-selected)
  const [phase, setPhase] = useState<"question" | "followup" | "complete">("question");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Draft resume: when reopening with an existing draft, show a choice
  const [showDraftResume, setShowDraftResume] = useState(false);
  const [draftAnswerCount, setDraftAnswerCount] = useState(0);
  // Gates the initial question render until the preload GET resolves, so the
  // modal never flashes "About Q1" before it knows the designer already has
  // saved progress — the "first question pops up, then a minute to register my
  // progress" report. Reset to false on each open; set true when preload lands.
  const [preloadComplete, setPreloadComplete] = useState(false);
  // Set when the designer picks "Continue where I left off" — arms the resume
  // navigation effect (which then jumps to the room they actually reached).
  const [resumeRequested, setResumeRequested] = useState(false);
  // Keep step for backward compatibility during transition
  const [step, setStep] = useState<"answer" | "followups">("answer");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [followUps, setFollowUps] = useState<
    Array<{ questionId: string; acknowledgment?: string; followUps: Array<{ id: string; prompt: string }> }>
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lockedTotal, setLockedTotal] = useState<number | null>(null);
  const [generationStep, setGenerationStep] = useState(0);
  const [generationAttempts, setGenerationAttempts] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Phase A: Sequential flow
  const [isClearing, setIsClearing] = useState(false);
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [followupsTried, setFollowupsTried] = useState(false);
  const [cachedFollowups, setCachedFollowups] = useState<
    Array<{ questionId: string; acknowledgment?: string; followUps: Array<{ id: string; prompt: string }> }>
  >([]);

  // Morphed question texts — dynamically rewritten based on prior answers
  const [morphedQuestions, setMorphedQuestions] = useState<Map<string, string>>(new Map());

  // Background evaluation: pre-compute morphed questions while user types
  const { evaluate: bgEvaluate, flush: bgFlush, cancel: bgCancel } = useBackgroundEvaluation(projectId);

  const saveAbortRef = useRef<AbortController | null>(null);
  const bannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Answer-change detection: snapshot answers when navigating backward
  const answerSnapshotsRef = useRef<Map<string, string>>(new Map());
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [pendingResubmitQuestionId, setPendingResubmitQuestionId] = useState<string | null>(null);

  // Quality gate: rooms that aren't fully answered are withheld from generation
  // so no placeholder prose leaks into the story. This prompt confirms the
  // exclusion before we spend the generation call.
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const generateConfirmedRef = useRef(false);

  // Skip (A2): the choice sheet has two views — the initial choice, and the
  // "skip this room" confirmation. `false` means closed.
  const [skipSheet, setSkipSheet] = useState<false | "choice" | "confirmRoom">(false);
  // Room status persistence (C0, generalizes A3's roomSkips): roomId → status.
  // Hydrated from server roomProgress and the localStorage draft; sent back to
  // the server whenever a room finalizes ('complete') or is skipped ('skipped').
  const [roomStatuses, setRoomStatuses] = useState<Record<string, RoomProgressStatus>>({});
  const serverRoomProgressRef = useRef<Record<string, any> | null>(null);
  // Bumped when the preload GET populates serverRoomProgressRef, so the status
  // hydration effect re-runs even if it already settled before the GET resolved.
  const [serverProgressVersion, setServerProgressVersion] = useState(0);
  // inputModality (Pass B fold-in): per-question source flags. `hasVoice` = a
  // Whisper transcript was merged; `hasTyping` = a real keystroke fired. Resolved
  // to 'mixed' | 'voice' | 'text' at persist time and carried in the draft so a
  // reload never silently downgrades a spoken answer to 'text'.
  const [answerModality, setAnswerModality] = useState<
    Record<string, { hasVoice: boolean; hasTyping: boolean }>
  >({});
  // Per-answer roomId (D5): the room an answer was given in, captured at answer
  // time. Bulk saves and answersOverride must NOT re-derive from the current room
  // (which is the LAST room by then) — they'd stamp every answer with it and
  // corrupt provenance. Keyed by questionId; carried in the draft; hydrated from
  // server answers (which carry roomId post-D5) on load.
  const [answerRoomIds, setAnswerRoomIds] = useState<Record<string, string | null>>({});
  // Latest "persist a single room status" fn — kept in a ref so the callback we
  // hand the flow hook stays stable while still closing over fresh answers.
  const persistRoomStatusRef = useRef<
    ((roomId: string, status: RoomProgressStatus) => void) | null
  >(null);
  const handleRoomStatusChange = useCallback(
    (roomId: string, status: RoomProgressStatus) => {
      setRoomStatuses((prev) => (prev[roomId] === status ? prev : { ...prev, [roomId]: status }));
      persistRoomStatusRef.current?.(roomId, status);
    },
    [],
  );

  // Cinematic backdrop source — the reference photo currently shown in the left
  // column, reported up from RoomPhoto and mirrored blurred behind the modal.
  const [activeRefImageUrl, setActiveRefImageUrl] = useState<string | null>(null);
  const handleActiveRefImage = useCallback(
    (img: { url: string } | null) => setActiveRefImageUrl(img?.url ?? null),
    [],
  );

  const baseAnswers = useMemo(() => answers.filter((answer) => !answer.isFollowUp), [answers]);
  const followUpAnswersState = useMemo(() => answers.filter((answer) => answer.isFollowUp), [answers]);
  
  // Debug logging
  useEffect(() => {
    if (open) {
      console.log('[InterviewModal] State:', {
        totalAnswers: answers.length,
        baseAnswers: baseAnswers.length,
        followUpAnswers: followUpAnswersState.length,
        step,
        selectedQuestionIds: selectedQuestionIds.length,
      });
    }
  }, [open, answers.length, baseAnswers.length, followUpAnswersState.length, step, selectedQuestionIds.length]);

  useEffect(() => {
    return () => {
      if (saveAbortRef.current) {
        saveAbortRef.current.abort();
      }
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  // Autosave to localStorage (debounced)
  useEffect(() => {
    if (!open) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      const draftKey = `interviewDraft:${projectId}`;
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          answers: answers.filter(a => a.answer.trim().length > 0),
          followups: followUps,
          currentQuestionIndex,
          phase,
          roomStatuses,
          answerModality,
          answerRoomIds,
        }));
      } catch (error) {
        console.warn('[InterviewModal] Failed to autosave to localStorage', error);
      }
    }, 400);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [open, projectId, answers, followUps, currentQuestionIndex, phase, roomStatuses, answerModality, answerRoomIds]);

  // Preload answers from server and localStorage on open
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    // Re-arm the render gate: hold the question phase on a spinner until this
    // GET resolves so Q1 never flashes ahead of the resume decision.
    setPreloadComplete(false);

    (async () => {
      try {
        const res = await fetch(`/api/posting/project/${projectId}/interview`, { method: 'GET' });
        if (cancelled) return;
        
        if (res.ok) {
          const data = await res.json();
          console.log('[InterviewModal] Preloaded data:', { 
            answerCount: data?.answers?.length || 0, 
            followUpsCount: data?.followUps?.length || 0,
            selectedQuestionIdsCount: data?.selectedQuestionIds?.length || 0,
            contextualQuestionsCount: data?.contextualQuestions?.length || 0
          });
          
          // Skip persistence (A3): stash server roomProgress so the hydration
          // effect can re-apply persisted skips once room groups have loaded.
          serverRoomProgressRef.current =
            data?.roomProgress && typeof data.roomProgress === 'object'
              ? data.roomProgress
              : null;
          // Signal that the server snapshot is populated. The ref alone can't
          // trigger a re-render, so without this the hydration effect (keyed on
          // rooms.length) may have already run and settled before this GET
          // resolves — leaving persisted statuses un-hydrated and resurfacing
          // the resume bug under network latency. Bumping this state re-runs it.
          if (!cancelled) setServerProgressVersion((v) => v + 1);

          // Contextual questions are now loaded via useInterviewQuestions hook
          // No need to load from this endpoint anymore
          
          const serverAnswers = normalizeIncomingAnswers(data?.answers || []);
          const serverFollowUps = Array.isArray(data?.followUps) ? data.followUps : [];

          // D5: hydrate the per-answer roomId map from server answers (which
          // carry roomId post-D5). Merge under any draft-restored values (prev
          // wins) so a local edit isn't clobbered by a stale server read.
          if (Array.isArray(data?.answers)) {
            const serverRoomIds: Record<string, string | null> = {};
            for (const a of data.answers) {
              if (a && a.questionId != null && 'roomId' in a) {
                serverRoomIds[String(a.questionId)] = (a as any).roomId ?? null;
              }
            }
            if (Object.keys(serverRoomIds).length > 0 && !cancelled) {
              setAnswerRoomIds((prev) => ({ ...serverRoomIds, ...prev }));
            }
          }
          
          if (cancelled) return;
          
          console.log('[InterviewModal] Setting answers:', serverAnswers.length);
          
          // Include all questionIds from loaded answers in selectedQuestionIds
          // This ensures all answered questions are shown in the form
          const loadedQuestionIds = serverAnswers.map(a => a.questionId);
          const allQuestionIds = Array.from(new Set([
            ...(data?.selectedQuestionIds || []),
            ...loadedQuestionIds,
          ]));
          
          // Check localStorage draft (declare in broader scope)
          const draftKey = `interviewDraft:${projectId}`;
          let draft: string | null = null;
          
          // Only set selectedQuestionIds if there are actually answers or selected questions
          // If everything is cleared, start fresh
          if (allQuestionIds.length > 0 || serverAnswers.length > 0) {
            setSelectedQuestionIds(allQuestionIds);
            setAnswers(serverAnswers);
            setFollowUps(serverFollowUps);
            
            // Restore draft from localStorage if exists (only if server has data - don't restore if cleared)
            draft = localStorage.getItem(draftKey);
            if (draft && !cancelled) {
              try {
                const { answers: da = [], followups: df = [] } = JSON.parse(draft);
                if (da.length || df.length) {
                  console.log('[InterviewModal] Found localStorage draft:', { da: da.length, df: df.length });
                  // Merge draft with server data
                  const draftAnswers = normalizeIncomingAnswers(da);
                  const merged = [...serverAnswers];
                  for (const draftAnswer of draftAnswers) {
                    const idx = merged.findIndex(a => a.questionId === draftAnswer.questionId);
                    if (idx >= 0) {
                      merged[idx] = draftAnswer;
                    } else {
                      merged.push(draftAnswer);
                    }
                  }
                  if (!cancelled) {
                    console.log('[InterviewModal] Setting merged answers:', merged.length);
                    setAnswers(merged);
                    
                    if (Array.isArray(df) && df.length > 0) {
                      setFollowUps(df);
                    }
                  }
                }
              } catch (parseError) {
                console.warn('[InterviewModal] Failed to parse localStorage draft', parseError);
              }
            }
          } else {
            // Everything is cleared - reset to fresh state
            setSelectedQuestionIds([]);
            setAnswers([]);
            setFollowUps([]);
            console.log('[InterviewModal] All data cleared - starting fresh');
            
            // Server data is cleared - also clear localStorage to ensure fresh start
            localStorage.removeItem(draftKey);
            console.log('[InterviewModal] Cleared localStorage draft - starting fresh');
            draft = null; // Explicitly set to null since we cleared it
          }

          // If no server answers but we have localStorage, use that
          if (serverAnswers.length === 0 && !draft && !cancelled) {
            console.warn('[InterviewModal] No answers found from server or localStorage');
          }

          // Set step based on what we have
          const finalAnswers = serverAnswers.length > 0 ? serverAnswers : (draft ? normalizeIncomingAnswers(JSON.parse(draft).answers || []) : []);
          const hasBaseAnswers = finalAnswers.filter((a: any) => !a.isFollowUp).length > 0;
          const hasFollowUps = finalAnswers.filter((a: any) => a.isFollowUp).length > 0 || serverFollowUps.length > 0;

          // Restore saved question index from draft
          let savedQuestionIndex = 0;
          let savedPhase: "question" | "followup" | "complete" | null = null;
          if (draft) {
            try {
              const parsed = JSON.parse(draft);
              if (typeof parsed.currentQuestionIndex === 'number') {
                savedQuestionIndex = parsed.currentQuestionIndex;
              }
              if (parsed.phase === 'question' || parsed.phase === 'followup' || parsed.phase === 'complete') {
                savedPhase = parsed.phase;
              }
            } catch { /* ignore */ }
          }

          console.log('[InterviewModal] Step decision:', {
            finalAnswersCount: finalAnswers.length,
            hasBaseAnswers,
            hasFollowUps,
            selectedQuestionIdsCount: allQuestionIds.length,
            serverAnswersCount: serverAnswers.length,
            savedQuestionIndex,
            savedPhase,
            currentStep: step,
          });

          // If no answers exist, start in question phase (all questions auto-selected)
          if (!hasBaseAnswers && !hasFollowUps && !cancelled) {
            setStep("answer");
            setPhase("question");
            setCurrentQuestionIndex(0);
            setShowDraftResume(false);
            startingFreshRef.current = false;
            console.log('[InterviewModal] Starting fresh in question phase');
          } else if (startingFreshRef.current && !cancelled) {
            // User just clicked "Start over" — skip draft resume even if stale
            // server data arrived (race condition). The clear POST is in flight.
            startingFreshRef.current = false;
            setStep("answer");
            setPhase("question");
            setCurrentQuestionIndex(0);
            setShowDraftResume(false);
            setAnswers([]);
            setFollowUps([]);
            console.log('[InterviewModal] Skipping draft resume (starting fresh)');
          } else if (hasBaseAnswers && !cancelled) {
            // Pre-set the resume state (used whether we auto-resume or prompt).
            const baseCount = finalAnswers.filter((a: any) => !a.isFollowUp).length;
            setDraftAnswerCount(baseCount);
            setStep("answer");
            if (savedPhase === 'complete') {
              setPhase("complete");
            } else if (savedPhase === 'followup') {
              setStep("followups");
              setPhase("followup");
            } else {
              setPhase("question");
              setCurrentQuestionIndex(savedQuestionIndex);
            }
            if (initialIntent === 'resume') {
              // The caller (tracker "Your story so far") already offered the
              // resume/restart choice — skip our own "Welcome back" screen and
              // jump straight to where they left off.
              setShowDraftResume(false);
              setResumeRequested(true);
              console.log('[InterviewModal] Auto-resuming (initialIntent=resume):', { baseCount, savedQuestionIndex, savedPhase });
            } else {
              // Show draft resume prompt so user can choose: continue or start over
              setShowDraftResume(true);
              console.log('[InterviewModal] Showing draft resume prompt:', { baseCount, savedQuestionIndex, savedPhase });
            }
          } else if (hasFollowUps && !cancelled) {
            setStep("followups");
            setPhase("followup");
            setShowDraftResume(false);
            console.log('[InterviewModal] Resuming at followups phase');
          }
        } else {
          console.warn('[InterviewModal] Failed to fetch answers', res.status);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[InterviewModal] Failed to preload answers', error);
        }
      } finally {
        // Preload settled (success or failure) — lift the render gate so the
        // question phase (or resume nav) can proceed instead of hanging.
        if (!cancelled) setPreloadComplete(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, projectId, initialIntent]);

  // inputModality: restore per-question source flags from the draft on open, so
  // a reload doesn't downgrade a previously-spoken answer to 'text'.
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(`interviewDraft:${projectId}`);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.answerModality && typeof d.answerModality === 'object') {
          setAnswerModality(d.answerModality);
        }
        // D5: restore per-answer roomId map so a reload doesn't lose room
        // attribution before the next persist.
        if (d?.answerRoomIds && typeof d.answerRoomIds === 'object') {
          setAnswerRoomIds(d.answerRoomIds);
        }
      }
    } catch { /* ignore */ }
  }, [open, projectId]);

  useEffect(() => {
    if (open) {
      setIsChecking(true);
      setBanner(null);
      setFollowupsTried(false);
      // Don't clear cachedFollowups - keep them for the session
      checkLLMHealth()
        .then((ok) => {
          setLlmAvailable(ok);
          if (!ok) {
            setBanner('AI assistant is currently unavailable. You can continue and Folio will create a base story draft.');
          }
        })
        .finally(() => setIsChecking(false));
    }
  }, [open]);

  // Reset to question phase when modal opens with no answers AND no draft
  useEffect(() => {
    if (!open) return;

    // Give a small delay to let data load, then check if we should reset
    const timer = setTimeout(() => {
      const hasAnswers = answers.filter(a => !a.isFollowUp).length > 0;
      const hasFollowUps = answers.filter(a => a.isFollowUp).length > 0;
      const draftKey = `interviewDraft:${projectId}`;
      const hasDraft = !!localStorage.getItem(draftKey);

      // Only reset if truly fresh — no answers AND no localStorage draft
      if (!hasAnswers && !hasFollowUps && !hasDraft) {
        console.log('[InterviewModal] Modal opened with no answers and no draft - starting fresh');
        setStep("answer");
        setPhase("question");
        setCurrentQuestionIndex(0);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [open, projectId]); // Only depend on open and projectId, not answers (to avoid loops)

  const handleBaseAnswersChange = useCallback((nextBase: InterviewAnswer[]) => {
    setAnswers((prev) => {
      const followUps = prev.filter((answer) => answer.isFollowUp);
      return [...nextBase, ...followUps];
    });
  }, []);

  const handleFollowUpsChange = useCallback((updated: InterviewAnswer[]) => {
    setAnswers(updated);
  }, []);

  const handleBanner = useCallback((message: string) => {
    setBanner(message);
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    bannerTimeoutRef.current = setTimeout(() => setBanner(null), 4000);
  }, []);

  // Cache signature: re-use generated questions across opens, but regenerate when
  // the project's photos or tags change (which is what the questions are built
  // from). Keeps re-opens instant and avoids re-burning the LLM call.
  const questionsCacheSignature = `${images.length}:${tags.length}`;

  // Fetch questions using the new hook
  const { questions: fetchedQuestions, loading: questionsLoading, context: questionsContext } = useInterviewQuestions(projectId, questionsCacheSignature);

  // Room pacing: fetch room-grouped questions (Phase B).
  // Two-phase generation: phase 1 delivers only the "About This Project" group,
  // so pacing must activate on a single (project) group when real rooms are
  // known to be coming (roomCount >= 1) — not just when rooms.length > 1.
  const roomData = useRoomInterviewQuestions(projectId, questionsCacheSignature);
  const hasRoomPacing =
    !roomData.loading &&
    roomData.rooms.length > 0 &&
    (roomData.rooms.length > 1 || (roomData.projectSize?.roomCount ?? 0) >= 1);

  // While room groups are still being generated (and haven't failed), the
  // interview must not be finishable — otherwise canFinish flips true with
  // only the project group present and the interview ends after About.
  const roomsBlocked = hasRoomPacing && roomData.roomsPending && !roomData.roomsError;

  // The flat questions endpoint returns fast (and room-first), while the grouped
  // room-paced endpoint is slow. Without this guard the modal renders the flat
  // questions (e.g. "Dining Room") for the whole time the grouped call is
  // generating, then jarringly reorders to "About This Project". When the flat
  // context says the project has multiple rooms, room pacing IS coming — so hold
  // on the loading state until the grouped questions resolve instead of showing
  // the soon-to-be-replaced flat questions.
  const expectRoomPacing = (questionsContext?.projectSize?.roomCount ?? 0) > 1;
  const roomQuestionsPending = expectRoomPacing && roomData.loading;
  const roomFlow = useRoomInterviewFlow(
    roomData.rooms,
    roomData.crossRoomQuestions,
    roomData.globalGates,
    { onRoomStatusChange: handleRoomStatusChange },
  );

  // Two-phase generation: the designer finished About This Project but the
  // room groups (generated from those answers) haven't arrived yet — hold on
  // an interstitial rather than re-showing the last question or offering Finish.
  const waitingForRooms =
    roomsBlocked &&
    !roomFlow.pendingRoundTransition &&
    roomFlow.currentRoom?.roomId === 'project' &&
    roomFlow.roomProgress['project']?.status === 'complete';

  // Room-completeness signal for the quality gate. A room counts as "complete"
  // only when all its questions are answered (roomProgress status 'complete').
  // The project pseudo-room ('project') never maps to image chapters, so it's
  // irrelevant to what gets withheld and is excluded from the "left out" list.
  const completedRoomIds = useMemo(() => {
    if (!hasRoomPacing) return undefined;
    return Object.entries(roomFlow.roomProgress)
      .filter(([, p]) => p?.status === 'complete')
      .map(([roomId]) => roomId);
  }, [hasRoomPacing, roomFlow.roomProgress]);

  const excludedRoomNames = useMemo(() => {
    if (!hasRoomPacing) return [] as string[];
    return roomFlow.rooms
      .filter(
        (r) =>
          r.roomId !== 'project' &&
          (roomFlow.roomProgress[r.roomId]?.status ?? 'not_started') !== 'complete',
      )
      .map((r) => r.roomName);
  }, [hasRoomPacing, roomFlow.rooms, roomFlow.roomProgress]);

  // Answer-driven resume plan. The earlier fix relied on roomProgress to decide
  // where to resume, but roomProgress lives in a SEPARATE EditorialInterview
  // record that is frequently null or stale (its column is even read behind a
  // "migration may not be applied" guard) — so on reopen it gave nothing and the
  // designer stayed pinned on About Q1. The persisted ANSWERS are the reliable
  // ground truth (stored in post provenance), and each carries a first-class
  // roomId (D5); every room declares a baseQuestions budget. So we reconstruct
  // progress from the answers: a room is "done" when its status is terminal OR it
  // already holds >= baseQuestions answers. Resume lands on the furthest room the
  // designer actually reached — and never on About once About is answered, no
  // matter what roomProgress says. (Question IDs can't be matched directly: they
  // carry a regenerated uuid, so we attribute by roomId + count, not by id.)
  const resumePlan = useMemo(() => {
    if (!hasRoomPacing || roomsBlocked) return null;
    const rooms = roomFlow.rooms;
    if (rooms.length === 0) return null;

    const roomKeyOf = (qid: string): string | null => {
      const rid = answerRoomIds[qid];
      if (typeof rid === 'string' && rid) return rid;
      if (qid.startsWith('project-')) return 'project';
      return null;
    };
    const baseCountByRoom: Record<string, number> = {};
    for (const a of baseAnswers) {
      const key = roomKeyOf(a.questionId);
      if (key) baseCountByRoom[key] = (baseCountByRoom[key] || 0) + 1;
    }

    const isTerminal = (roomId: string) => {
      const s = roomFlow.roomProgress[roomId]?.status;
      return s === 'complete' || s === 'skipped';
    };
    const isTouched = (r: (typeof rooms)[number]) =>
      (baseCountByRoom[r.roomId] || 0) > 0 || isTerminal(r.roomId);
    const isDone = (r: (typeof rooms)[number]) => {
      if (isTerminal(r.roomId)) return true;
      const need = r.budget.baseQuestions;
      return need > 0 && (baseCountByRoom[r.roomId] || 0) >= need;
    };

    let lastTouched = -1;
    for (let i = 0; i < rooms.length; i++) {
      if (isTouched(rooms[i])) lastTouched = i;
    }
    if (lastTouched < 0) {
      return { hasProgress: false, allDone: false, targetIndex: 0 };
    }
    // If the furthest room is finished, resume at the NEXT room; otherwise land
    // back in the partially-answered room the designer stopped in.
    const target = isDone(rooms[lastTouched]) ? lastTouched + 1 : lastTouched;
    if (target >= rooms.length) {
      return { hasProgress: true, allDone: true, targetIndex: rooms.length - 1 };
    }
    return { hasProgress: true, allDone: false, targetIndex: target };
  }, [hasRoomPacing, roomsBlocked, roomFlow.rooms, roomFlow.roomProgress, baseAnswers, answerRoomIds]);


  // Convert fetched questions to InterviewQuestion format for compatibility
  const contextualQuestions = useMemo(() => {
    return fetchedQuestions
      .filter(q => q.questionType === 'contextual')
      .map(q => ({
        id: q.id,
        role: 'DESIGNER' as const,
        section: 'what' as const, // Contextual questions are about "what" they chose
        prompt: q.questionText,
      }));
  }, [fetchedQuestions]);
  
  // Question metadata by id, for saving. This is what makes an answer analysable
  // later: which photo and product the question was about, which classified
  // attribute it was testing, where it came from.
  //
  // It used to be built from the FLAT list alone, so in a room-paced interview —
  // the normal case — every answer saved with those fields null, and the whole
  // "why was this asked" side of the record was lost at the save boundary even
  // though the grouped endpoint had sent it. Same failure as the empty prompts,
  // one map over.
  const questionMetadataMap = useMemo(() => {
    const map = new Map<string, ContextualQuestion>();
    const add = (q: ContextualQuestion) => {
      if (q?.id && !map.has(q.id)) map.set(q.id, q);
    };
    fetchedQuestions.forEach(add);
    for (const room of roomData.rooms) (room.questions ?? []).forEach(add);
    (roomData.crossRoomQuestions ?? []).forEach(add);
    return map;
  }, [fetchedQuestions, roomData.rooms, roomData.crossRoomQuestions]);
  
  // Use contextual questions only — no legacy fallback.
  // The contextual system already includes base fallbacks for low-context projects.
  const allQuestions = useMemo(() => {
    return contextualQuestions;
  }, [contextualQuestions]);

  // Question text by id, across EVERY source the designer can be asked from.
  // The flat contextual list is only part of the picture: in a room-paced
  // interview the questions actually asked come from the grouped endpoint via
  // roomFlow, so resolving the prompt from `allQuestions` alone saved every room
  // answer with an empty prompt — which is why saved answers listed as
  // "Untitled question" on the Story tab. The answer has to carry its own text:
  // the question set is regenerated (with fresh ids) whenever the project is
  // retagged, so read-time recovery by id can't be relied on.
  const questionTextById = useMemo(() => {
    const map = new Map<string, string>();
    const add = (id?: string, text?: string) => {
      if (id && text && text.trim() && !map.has(id)) map.set(id, text.trim());
    };
    for (const q of allQuestions) add(q.id, q.prompt);
    for (const room of roomData.rooms) {
      for (const q of room.questions ?? []) add(q.id, q.questionText);
    }
    for (const q of roomData.crossRoomQuestions ?? []) add(q.id, q.questionText);
    // Follow-ups are asked from their own queue, never from the question set.
    for (const group of followUps) {
      for (const f of group.followUps) add(f.id, f.prompt);
    }
    return map;
  }, [allQuestions, roomData.rooms, roomData.crossRoomQuestions, followUps]);

  // Follow-up → the answer that produced it. A follow-up only exists because of
  // something the designer said, which makes this the one causal edge the
  // interview itself observes — worth persisting, since "what did that answer
  // provoke" is exactly the shape of question we want to ask across projects.
  const parentQuestionIdByFollowUp = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of followUps) {
      for (const f of group.followUps) map.set(f.id, group.questionId);
    }
    return map;
  }, [followUps]);

  // Auto-select all questions when they load (no pick phase)
  // Also re-select when the question set changes (e.g. contextual questions load
  // after initial render) to avoid a stale-ID mismatch
  // that leaves selectedQuestions empty and the modal blank.
  useEffect(() => {
    if (allQuestions.length === 0) return;

    if (selectedQuestionIds.length === 0) {
      // Fresh start — select all
      const ids = allQuestions.map(q => q.id);
      setSelectedQuestionIds(ids);
      console.log('[InterviewModal] Auto-selected all questions:', ids.length);
      return;
    }

    // Validate existing selection against available questions
    const availableIds = new Set(allQuestions.map(q => q.id));
    const validCount = selectedQuestionIds.filter(id => availableIds.has(id)).length;
    if (validCount === 0) {
      // All selected IDs are from a stale question set — re-select
      const ids = allQuestions.map(q => q.id);
      setSelectedQuestionIds(ids);
      setCurrentQuestionIndex(0);
      console.log('[InterviewModal] Re-selected all questions (question set changed):', ids.length);
    }
  }, [allQuestions, selectedQuestionIds.length]);
  
  // Phase A: Sequential flow helpers
  // Derive selected questions from merged question bank
  const selectedQuestions = useMemo(() => {
    return selectedQuestionIds
      .map((id) => allQuestions.find((q) => q.id === id))
      .filter((q): q is InterviewQuestion => q !== undefined);
  }, [selectedQuestionIds, allQuestions]);

  // When room pacing is active, derive currentQuestion from the room flow hook
  // (which tracks per-room question index) instead of the flat selectedQuestions list.
  const currentQuestion = hasRoomPacing
    ? (roomFlow.currentQuestion
        ? {
            id: roomFlow.currentQuestion.id,
            role: 'DESIGNER' as const,
            section: 'what' as const,
            prompt: roomFlow.currentQuestion.questionText,
            contextLevel: roomFlow.currentQuestion.contextLevel,
          }
        : undefined)
    : selectedQuestions[currentQuestionIndex];
  const totalQuestions = hasRoomPacing ? roomFlow.totalQuestionsInRoom : selectedQuestions.length;
  const displayTotal = lockedTotal ?? totalQuestions;
  const isLastQuestion = hasRoomPacing
    ? roomFlow.currentQuestionIndex >= roomFlow.totalQuestionsInRoom - 1
    : currentQuestionIndex >= totalQuestions - 1;
  // isInterviewComplete: true only when ALL rooms/rounds are done AND we're on the last question.
  // Never while room groups are still pending (two-phase generation).
  const isInterviewComplete = hasRoomPacing
    ? roomFlow.canFinish && !roomsBlocked && isLastQuestion
    : isLastQuestion;
  const isNearFinish = !isLastQuestion && totalQuestions > 1 && (hasRoomPacing
    ? roomFlow.canFinish && !roomsBlocked && roomFlow.currentQuestionIndex >= roomFlow.totalQuestionsInRoom - 2
    : currentQuestionIndex >= totalQuestions - 2);

  // Auto-generate: when the last question answer is saved, trigger generation automatically
  const autoGenerateRef = useRef(false);
  // When true, the preload effect skips draft resume (user just clicked "Start over")
  const startingFreshRef = useRef(false);

  // Lock the question count denominator on first population
  useEffect(() => {
    if (selectedQuestions.length > 0 && lockedTotal === null) {
      setLockedTotal(selectedQuestions.length);
    }
  }, [selectedQuestions.length, lockedTotal]);

  // Scroll to top when question changes
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [currentQuestionIndex]);

  // Sequential generation progress messages
  const GENERATION_MESSAGES = useMemo(() => [
    "Analyzing your images…",
    "Detecting rooms and products…",
    "Writing your story…",
    "Finalizing draft…",
  ], []);

  useEffect(() => {
    if (!isGenerating) { setGenerationStep(0); return; }
    const interval = setInterval(() => {
      setGenerationStep(prev => Math.min(prev + 1, GENERATION_MESSAGES.length - 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [isGenerating, GENERATION_MESSAGES.length]);

  // Get current answer for the current question
  const currentAnswer = useMemo(() => {
    if (!currentQuestion) return "";
    const answer = baseAnswers.find((a) => a.questionId === currentQuestion.id);
    return answer?.answer || "";
  }, [currentQuestion, baseAnswers]);

  // inputModality: record the source of input against the current question.
  // Flags are keyed by questionId, so switching questions starts fresh and
  // revisiting a question keeps its resolved modality.
  const handleInputSource = useCallback(
    (source: "voice" | "typing") => {
      const qid = currentQuestion?.id;
      if (!qid) return;
      setAnswerModality((prev) => {
        const cur = prev[qid] ?? { hasVoice: false, hasTyping: false };
        const next = source === "voice"
          ? { ...cur, hasVoice: true }
          : { ...cur, hasTyping: true };
        if (cur.hasVoice === next.hasVoice && cur.hasTyping === next.hasTyping) return prev;
        return { ...prev, [qid]: next };
      });
    },
    [currentQuestion?.id],
  );

  const resolveInputModality = useCallback(
    (questionId: string): "text" | "voice" | "mixed" => {
      const m = answerModality[questionId];
      if (!m) return "text";
      if (m.hasVoice && m.hasTyping) return "mixed";
      if (m.hasVoice) return "voice";
      return "text";
    },
    [answerModality],
  );

  // Display question with morphed text overlay (if LLM rewrote it based on prior answers)
  const displayQuestion = useMemo(() => {
    if (!currentQuestion) return null;
    const morphedText = morphedQuestions.get(currentQuestion.id);
    if (morphedText) {
      return { ...currentQuestion, prompt: morphedText };
    }
    return currentQuestion;
  }, [currentQuestion, morphedQuestions]);

  // Background evaluation: trigger when user types 50+ chars
  useEffect(() => {
    if (!currentQuestion || currentAnswer.trim().length < 50) return;

    const answeredIds = new Set(baseAnswers.map(a => a.questionId));
    answeredIds.add(currentQuestion.id);
    const remaining = selectedQuestions
      .filter(q => !answeredIds.has(q.id))
      .map(q => ({ id: q.id, question: morphedQuestions.get(q.id) || q.prompt }));

    if (!remaining.length) return;

    // Build summaries from completed answers + current in-progress answer
    const summaries = [
      ...baseAnswers
        .filter(a => a.answer?.trim())
        .map(a => ({ questionId: a.questionId, summary: a.answer.slice(0, 200) })),
      { questionId: currentQuestion.id, summary: currentAnswer.trim().slice(0, 200) },
    ];

    bgEvaluate(summaries, remaining);
  }, [currentAnswer, currentQuestion, baseAnswers, selectedQuestions, morphedQuestions, bgEvaluate]);

  // Cancel background evaluation on unmount or modal close
  useEffect(() => {
    if (!open) bgCancel();
    return () => bgCancel();
  }, [open, bgCancel]);

  // Phase B: Generate follow-ups + evaluate/morph remaining questions
  const generateSingleFollowUp = useCallback(async (questionId: string, answerText: string): Promise<{ followUps: Array<{ id: string; prompt: string }>; questionUpdates: QuestionUpdate[] }> => {
    setIsLoadingFollowUps(true);
    logClient('followups-single:request:begin', { projectId, questionId });

    try {
      // Include previous answers so follow-ups build on context and don't repeat topics
      const previousAnswers = baseAnswers
        .filter(a => a.questionId !== questionId && a.answer?.trim())
        .map(a => ({
          question: allQuestions.find(q => q.id === a.questionId)?.prompt || a.questionId,
          answer: a.answer,
        }));

      // Build remaining questions list — use morphed text if available
      const answeredIds = new Set(baseAnswers.map(a => a.questionId));
      answeredIds.add(questionId);
      const remainingQuestions = selectedQuestions
        .filter(q => !answeredIds.has(q.id))
        .map(q => ({ id: q.id, question: morphedQuestions.get(q.id) || q.prompt }));

      // Room pacing: include room context for scoped follow-ups
      const roomPayload = hasRoomPacing && roomFlow.currentRoom
        ? {
            roomId: roomFlow.currentRoom.roomId,
            roomName: roomFlow.currentRoom.roomName,
            roomAnswers: baseAnswers
              .filter(a => {
                // Filter to just this room's answers using question metadata
                const meta = questionMetadataMap.get(a.questionId);
                return meta?.roomId === roomFlow.currentRoom?.roomId;
              })
              .map(a => ({
                question: allQuestions.find(q => q.id === a.questionId)?.prompt || a.questionId,
                answer: a.answer,
              })),
          }
        : {};

      const resp = await fetch(`/api/posting/project/${projectId}/interview/followups/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          answer: answerText,
          previousAnswers,
          remainingQuestions,
          ...roomPayload,
        }),
      });

      logClient('followups-single:response:status', { status: resp.status });
      const data = await resp.json() as SingleFollowUpApiResponse;
      logClient('followups-single:response:body', {
        ok: data?.ok, error: data?.error,
        followups: (data?.followups || []).length,
        updates: data?.questionUpdates?.length || 0,
      });

      if (!resp.ok || data?.ok === false) {
        console.warn('[followups-single] Failed to generate follow-ups:', data?.error);
        return { followUps: [], questionUpdates: [] };
      }

      // Transform to format expected by followUps state (with acknowledgment)
      const followUpsGroup: { questionId: string; acknowledgment?: string; followUps: Array<{ id: string; prompt: string }> } = {
        questionId,
        followUps: (data.followups || []).map((fu) => ({
          id: fu.id,
          prompt: fu.text,
        })),
      };
      if (data.acknowledgment) {
        followUpsGroup.acknowledgment = data.acknowledgment;
      }

      // Update followUps state
      setFollowUps((prev) => {
        const filtered = prev.filter((group) => group.questionId !== questionId);
        if (followUpsGroup.followUps.length > 0) {
          return [...filtered, followUpsGroup];
        }
        return filtered;
      });

      return {
        followUps: followUpsGroup.followUps,
        questionUpdates: data.questionUpdates || [],
      };
    } catch (error: any) {
      console.error('[followups-single] Error:', error);
      return { followUps: [], questionUpdates: [] };
    } finally {
      setIsLoadingFollowUps(false);
    }
  }, [projectId, baseAnswers, allQuestions, selectedQuestions, morphedQuestions]);

  // Round-based batch follow-up generation (triggered when pendingRoundTransition becomes true)
  useEffect(() => {
    if (!hasRoomPacing || !roomFlow.pendingRoundTransition || !roomFlow.currentRoom) return;

    const generateBatchFollowUps = async () => {
      setIsLoadingFollowUps(true);
      try {
        const round = roomFlow.currentRound;
        const room = roomFlow.currentRoom!;
        const tagCount = room.budget.tagCount;

        // Gather this room's answers — use the room's own question list
        // to match answer questionIds. The questionMetadataMap is built from a
        // separate (non-grouped) API call with different question IDs, so it
        // cannot be used to resolve roomId for room-paced questions.
        const roomQuestionMap = new Map(
          roomFlow.currentRoomQuestions.map(q => [q.id, q.questionText])
        );
        const roomAnswers = baseAnswers
          .filter((a) => roomQuestionMap.has(a.questionId))
          .map((a) => ({
            question: roomQuestionMap.get(a.questionId) || '',
            answer: a.answer,
          }));

        console.log('[InterviewModal] followups-batch:answers', {
          roomId: room.roomId,
          roomName: room.roomName,
          collectedAnswers: roomAnswers.length,
          answerRoomIds: baseAnswers.map(a => roomQuestionMap.has(a.questionId) ? room.roomId : 'none'),
        });

        // Compute how many follow-ups for this round
        const maxFollowUps = computeRoundBudget(round, roomAnswers.length, tagCount);

        if (maxFollowUps === 0) {
          roomFlow.completeRoundTransition();
          return;
        }

        logClient('followups-batch:request', {
          roomId: room.roomId,
          roomName: room.roomName,
          round,
          maxFollowUps,
          answerCount: roomAnswers.length,
        });

        const resp = await fetch(
          `/api/posting/project/${projectId}/interview/followups/batch`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId: room.roomId,
              roomName: room.roomName,
              previousAnswers: roomAnswers,
              round,
              maxFollowUps,
            }),
          }
        );

        const data = await resp.json();
        logClient('followups-batch:response', {
          ok: data?.ok,
          followUpCount: data?.followUps?.length || 0,
        });

        if (data.followUps?.length > 0) {
          const questions: ContextualQuestion[] = data.followUps.map((fu: any) => ({
            id: fu.id,
            questionText: fu.question,
            questionType: 'follow_up' as const,
            source: 'follow_up' as const,
            roomId: room.roomId,
            isCrossRoom: false,
          }));
          roomFlow.insertRoundQuestions(questions);
        } else {
          roomFlow.completeRoundTransition();
        }
      } catch (err) {
        console.error('[InterviewModal] batch follow-up error:', err);
        roomFlow.completeRoundTransition(); // Degrade gracefully
      } finally {
        setIsLoadingFollowUps(false);
      }
    };

    generateBatchFollowUps();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomFlow.pendingRoundTransition]);

  // Two-phase generation, phase 2 trigger: once the About This Project BASE
  // answers are saved, kick room-question generation. It runs server-side
  // (informed by a fact digest of those answers) while the designer answers
  // the project follow-ups — by the time they reach the first room, questions
  // are usually ready. Idempotent: loadRooms() no-ops after success; a failed
  // attempt retries on the next answer-driven progress change (bounded by
  // user actions, so no hot loop).
  useEffect(() => {
    if (!hasRoomPacing || !roomData.roomsPending) return;
    const projectProgress = roomFlow.roomProgress['project'];
    const projectGroup = roomFlow.rooms.find((r) => r.roomId === 'project');
    const baseCount = projectGroup?.budget.baseQuestions ?? 0;
    const baseAnswersDone =
      !!projectProgress && baseCount > 0 && projectProgress.answeredCount >= baseCount;

    // Resume without a fresh questions cache: the room set must load or the whole
    // interview hangs on About. The hook's in-session roomProgress isn't hydrated
    // on reopen (server roomProgress is often null), so ALSO trigger off the saved
    // answers. Only when About is genuinely finished — every project question
    // answered, OR a real-room answer already exists — so a FRESH interview never
    // loads rooms early (which would generate room questions from partial About
    // context). loadRooms() is idempotent.
    const projectAnswerCount = baseAnswers.filter((a) =>
      a.questionId.startsWith('project-'),
    ).length;
    const projectAnswersComplete = baseCount > 0 && projectAnswerCount >= baseCount;
    const hasRoomAnswers = baseAnswers.some((a) => {
      const rid = answerRoomIds[a.questionId];
      return typeof rid === 'string' && !!rid && rid !== 'project';
    });

    if (
      baseAnswersDone ||
      projectProgress?.status === 'complete' ||
      projectAnswersComplete ||
      hasRoomAnswers
    ) {
      logClient('two-phase:load-rooms', {
        answeredCount: projectProgress?.answeredCount ?? 0,
        baseCount,
        projectStatus: projectProgress?.status,
        projectAnswersComplete,
        hasRoomAnswers,
      });
      roomData.loadRooms();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRoomPacing, roomData.roomsPending, roomData.loadRooms, roomFlow.roomProgress, roomFlow.rooms, baseAnswers, answerRoomIds]);

  // Live two-phase entry: on a FRESH interview the designer finishes About, the
  // room questions land, and finalizeRoomAndAdvance normally steps into room 1 —
  // but if the room set loads AFTER About was completed there was no next room to
  // advance to, so the cursor stays stuck on 'project'. This nudges it into the
  // first real room. It uses the hook's in-session roomProgress (updated live by
  // finalizeRoomAndAdvance, not the unreliable server record), and defers to the
  // resume flow below when that owns navigation.
  useEffect(() => {
    if (!hasRoomPacing || roomsBlocked) return;
    if (resumeRequested) return; // resume path owns navigation
    if (roomFlow.rooms.length <= 1) return;
    if (roomFlow.currentRoom?.roomId !== 'project') return;
    if (roomFlow.roomProgress['project']?.status !== 'complete') return;
    logClient('two-phase:enter-first-room', { roomCount: roomFlow.rooms.length - 1 });
    roomFlow.goToRoom(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRoomPacing, roomsBlocked, resumeRequested, roomFlow.rooms.length, roomFlow.currentRoom?.roomId, roomFlow.roomProgress]);

  // Resume navigation. Fires once after the designer chooses "Continue where I
  // left off" (resumeRequested) and the room set + answers have loaded. Uses the
  // answer-driven resumePlan (NOT roomProgress, which is often null on reopen) to
  // jump to the furthest room actually reached — fixing the report where reopen
  // pinned the designer on About Q1 despite 31 saved answers. If every room is
  // already done, it goes straight to completion + generation, matching the
  // designer's intent to regenerate. Guarded to run only once per open.
  const didResumeNavRef = useRef(false);
  useEffect(() => {
    if (!open) {
      didResumeNavRef.current = false;
      setResumeRequested(false);
    }
  }, [open]);
  useEffect(() => {
    if (!resumeRequested || !hasRoomPacing || roomsBlocked) return;
    if (didResumeNavRef.current) return;
    if (!resumePlan || !resumePlan.hasProgress) return; // wait for answers to load
    didResumeNavRef.current = true;
    logClient('resume:plan', {
      roomCount: roomFlow.rooms.length,
      currentRoomIndex: roomFlow.currentRoomIndex,
      targetIndex: resumePlan.targetIndex,
      allDone: resumePlan.allDone,
      baseAnswers: baseAnswers.length,
    });
    if (resumePlan.allDone) {
      logClient('resume:all-done-generate', {});
      autoGenerateRef.current = true;
      setPhase('complete');
      return;
    }
    if (resumePlan.targetIndex !== roomFlow.currentRoomIndex) {
      logClient('resume:enter-room', {
        targetIndex: resumePlan.targetIndex,
        roomId: roomFlow.rooms[resumePlan.targetIndex]?.roomId,
      });
      roomFlow.goToRoom(resumePlan.targetIndex);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeRequested, hasRoomPacing, roomsBlocked, resumePlan, roomFlow.currentRoomIndex]);

  // Editing ONE saved answer is not a mode of this modal. It regenerates its
  // question set on open (fresh UUIDs), drives the rooms-generation phase, and
  // owns resume/finish/auto-generate — so opening it pinned to a saved answer
  // restarted the interview and landed on the generation screen. Single-answer
  // edits go through EditReflectionModal, which saves by questionId and closes.

  // Finish detection for the IN-SESSION path (single source of truth). When
  // roomFlow.canFinish flips true — after skipping the last room or answering the
  // last question — move to completion and auto-generate. Doing this in an effect
  // rather than synchronously in the skip/answer handlers is what fixes skipping
  // the LAST room: skipRoom()/advanceQuestion() only schedule state, so a
  // synchronous canFinish read there is stale and misses the final room. canFinish
  // is accurate in-session (recordAnswer/skipRoom update the hook's own progress
  // live); the resume-all-done case is handled by the resume effect above instead,
  // since canFinish can't be trusted after a reopen. Gated so it never fires on the
  // draft-resume screen, mid-generation, or while rooms are still being generated.
  useEffect(() => {
    if (!hasRoomPacing) return;
    if (phase !== 'question') return;
    if (showDraftResume || roomsBlocked || isGenerating) return;
    if (!roomFlow.canFinish) return;
    logClient('interview:finished', { via: 'canFinish' });
    autoGenerateRef.current = true;
    setPhase('complete');
  }, [hasRoomPacing, phase, showDraftResume, roomsBlocked, isGenerating, roomFlow.canFinish]);

  // Status hydration (C0): once room groups exist, re-apply persisted terminal
  // statuses (from server roomProgress and the localStorage draft) so a skipped
  // or completed room survives reload without moving the designer. Keyed on
  // rooms.length so it reruns when phase-2 room questions land.
  useEffect(() => {
    if (!open || !hasRoomPacing) return;
    const map = new Map<string, RoomProgressStatus>();
    const rp = serverRoomProgressRef.current;
    if (rp) {
      for (const [id, v] of Object.entries(rp)) {
        const st = (v as any)?.status;
        if (st === 'complete' || st === 'skipped') map.set(id, st);
      }
    }
    try {
      const raw = localStorage.getItem(`interviewDraft:${projectId}`);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.roomStatuses && typeof d.roomStatuses === 'object') {
          for (const [id, st] of Object.entries(d.roomStatuses)) {
            if (st === 'complete' || st === 'skipped') map.set(id, st as RoomProgressStatus);
          }
        }
      }
    } catch { /* ignore */ }
    if (map.size > 0) {
      const entries = Array.from(map.entries()).map(([roomId, status]) => ({ roomId, status }));
      setRoomStatuses((prev) => {
        const next = { ...prev };
        for (const e of entries) next[e.roomId] = e.status;
        return next;
      });
      roomFlow.hydrateStatuses(entries);
    }
  // serverProgressVersion re-runs this once the preload GET populates the
  // server snapshot, closing the race where this settled before the GET landed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasRoomPacing, roomFlow.rooms.length, serverProgressVersion]);

  // Start over — clear the saved interview (client + server) and begin fresh.
  // Extracted so both the "Welcome back" screen's button AND the restart intent
  // (tracker "Restart interview") drive the exact same reset, with no drift.
  const handleStartOver = useCallback(
    async (opts?: { skipConfirm?: boolean }) => {
      if (!opts?.skipConfirm) {
        const confirmed = window.confirm(
          "This will clear your current reflections and begin a new interview. Continue?",
        );
        if (!confirmed) return;
      }

      setIsClearing(true);
      // Flag so the preload effect skips draft resume if it races.
      startingFreshRef.current = true;
      try {
        // Clear client state
        localStorage.removeItem(`interviewDraft:${projectId}`);
        localStorage.removeItem(`interview-draft-${projectId}`);
        setAnswers([]);
        setFollowUps([]);
        setMorphedQuestions(new Map());
        setSelectedQuestionIds([]);
        setCurrentQuestionIndex(0);
        setPhase("question");
        setStep("answer");
        setShowDraftResume(false);
        answerSnapshotsRef.current.clear();
        setShowRegeneratePrompt(false);
        setPendingResubmitQuestionId(null);
        // Reset room-pacing flow + client status map so cleared progress can't
        // leak into resume nav / finish detection. Clearing resumeRequested
        // disarms the resume effect, and roomFlow.reset() restores a pristine
        // (all not_started) flow so the fresh interview starts at room 0. Drop
        // the persisted server snapshot and re-arm the one-time guard so the NEW
        // interview's live two-phase entry still works.
        roomFlow.reset();
        setRoomStatuses({});
        setResumeRequested(false);
        serverRoomProgressRef.current = null;
        didResumeNavRef.current = false;

        // Clear server-side answers (matches DraftsPanel pattern)
        const clearRes = await fetch(`/api/posting/project/${projectId}/interview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // clearAll is what makes this destructive — without it the server
          // treats an empty answer list as "nothing to save" and keeps what it
          // has, so no other code path can wipe an interview by omission.
          body: JSON.stringify({ clearAll: true, answers: [], followUps: [], selectedQuestionIds: [] }),
        });

        if (!clearRes.ok) {
          const data = await clearRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to clear answers");
        }

        console.log('[InterviewModal] Starting over — draft and server answers cleared');
      } catch (err) {
        console.error('[InterviewModal] Start over error:', err);
        alert("Failed to reset interview: " + (err instanceof Error ? err.message : "Unknown error"));
      } finally {
        setIsClearing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, roomFlow],
  );

  // Restart intent (tracker "Restart interview"): clear and begin fresh on open,
  // skipping the "Welcome back" prompt. Runs once per open; startingFreshRef (set
  // inside handleStartOver) makes the racing preload GET skip draft resume too.
  const restartIntentRef = useRef(false);
  useEffect(() => {
    if (!open) {
      restartIntentRef.current = false;
      return;
    }
    if (initialIntent !== 'restart' || restartIntentRef.current) return;
    restartIntentRef.current = true;
    // Arm the fresh-start guard SYNCHRONOUSLY, before kicking off the async
    // clear. This effect runs right after the preload effect's synchronous body
    // (which only *starts* the GET), so startingFreshRef is set before that GET
    // can resolve — the preload's `else if (startingFreshRef.current)` branch
    // then forces the fresh path regardless of who wins the network race. Do not
    // rely on handleStartOver's internal timing to set it.
    startingFreshRef.current = true;
    void handleStartOver({ skipConfirm: true });
  }, [open, initialIntent, handleStartOver]);

  // Skip actions (A2). Skip-question advances without recording an answer;
  // skip-room marks the room skipped and advances. Both 'skipped' and 'complete'
  // are persisted via the flow hook's onRoomStatusChange (C0) — no manual POST.
  const handleSkipQuestion = useCallback(() => {
    setSkipSheet(false);
    if (hasRoomPacing) {
      roomFlow.advanceQuestion();
    } else if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      autoGenerateRef.current = true;
      setPhase("complete");
    }
  }, [hasRoomPacing, roomFlow, currentQuestionIndex, totalQuestions]);

  const handleSkipRoom = useCallback(() => {
    setSkipSheet(false);
    // Just mark the room skipped and advance. Whether this was the LAST room —
    // and thus whether the interview is now finished — is decided by the finish
    // effect below, which reads the flow state AFTER React commits the skip.
    // Reading roomFlow.canFinish here would observe the pre-skip (stale) value
    // and miss the final room, leaving the interview stuck instead of generating.
    roomFlow.skipRoom(); // fires onRoomStatusChange('skipped') → persists
  }, [roomFlow]);

  // Handle sequential question answer submission
  const handleQuestionAnswerSubmit = useCallback(async () => {
    if (!currentQuestion || !currentAnswer.trim()) {
      setFieldErrors({ [currentQuestion?.id || ""]: "Please provide an answer" });
      return;
    }

    setFieldErrors({});

    // Check if this is a re-submission of a changed answer (user went back and edited)
    const previousSnapshot = answerSnapshotsRef.current.get(currentQuestion.id);
    const trimmedAnswer = currentAnswer.trim().slice(0, 2000);
    if (previousSnapshot !== undefined && previousSnapshot !== trimmedAnswer) {
      const hadFollowUps = followUps.some(group => group.questionId === currentQuestion.id && group.followUps.length > 0);
      if (hadFollowUps) {
        setPendingResubmitQuestionId(currentQuestion.id);
        setShowRegeneratePrompt(true);
        return; // Pause — wait for user choice
      }
      // No follow-ups existed, clear snapshot and proceed normally
      answerSnapshotsRef.current.delete(currentQuestion.id);
    }

    setIsSubmitting(true);

    try {
      // Build answer in InterviewAnswer format
      const answerData: InterviewAnswer = {
        questionId: currentQuestion.id,
        role: currentQuestion.role === "ANY" ? "DESIGNER" : currentQuestion.role,
        section: currentQuestion.section,
        category: deriveCategory(currentQuestion.section),
        answer: trimmedAnswer,
        isFollowUp: false,
        // Persist the question text the designer actually answered (morphed text
        // when the LLM rewrote it). Without this the answer saves with an empty
        // prompt and every list of saved answers reads "Untitled question".
        prompt: (displayQuestion as any)?.prompt || (currentQuestion as any)?.prompt || "",
      };

      // Update answers state
      setAnswers((prev) => {
        const filtered = prev.filter((a) => a.questionId !== currentQuestion.id || a.isFollowUp);
        return [...filtered, answerData];
      });

      // Save answer
      await persistAnswers([answerData], { includeFollowUps: false });

      // Flush background evaluation results first (speculative, pre-computed while user typed)
      const bgUpdates = bgFlush();

      // Follow-up generation: in room pacing mode, follow-ups are generated in batch
      // between rounds (not per-answer). In legacy mode, use single follow-up generation.
      let questionUpdates: QuestionUpdate[] = [];
      if (!hasRoomPacing) {
        const result = await generateSingleFollowUp(currentQuestion.id, answerData.answer);
        questionUpdates = result.questionUpdates;
      }

      // Merge: background updates first, then submit-time overwrites (submit-time wins)
      const mergedMap = new Map<string, QuestionUpdate>();
      for (const u of bgUpdates) mergedMap.set(u.id, u);
      for (const u of questionUpdates) mergedMap.set(u.id, u);
      const mergedUpdates = Array.from(mergedMap.values());

      // Process question updates: morph partially-covered, skip fully-covered
      // Enforce minimum question count before allowing coverage-based skipping
      const answeredCount = baseAnswers.length + 1; // +1 for the question just answered
      let skippedCount = 0;
      if (mergedUpdates.length > 0) {
        const coveredIds = new Set<string>();
        const newMorphs = new Map<string, string>();

        for (const update of mergedUpdates) {
          if (update.status === 'covered') {
            coveredIds.add(update.id);
          } else if (update.status === 'morphed' && update.morphedText) {
            newMorphs.set(update.id, update.morphedText);
          }
        }

        // If we haven't hit MIN_QUESTIONS yet, convert covered → morphed (keep in queue)
        // This ensures designers get at least MIN_QUESTIONS substantive questions
        if (answeredCount < MIN_QUESTIONS && coveredIds.size > 0) {
          logClient('coverage:deferred', { answeredCount, minRequired: MIN_QUESTIONS, coveredCount: coveredIds.size });
          // Don't skip — just let the LLM morph them if it provided morphed text,
          // otherwise keep the original question
          coveredIds.clear();
        }

        // Apply morphed question texts
        if (newMorphs.size > 0) {
          logClient('morph:apply', { morphed: Array.from(newMorphs.keys()) });
          setMorphedQuestions(prev => {
            const next = new Map(prev);
            for (const [id, text] of newMorphs) {
              next.set(id, text);
            }
            return next;
          });
        }

        // Only skip fully covered questions (after MIN_QUESTIONS threshold met).
        // In room pacing mode, don't remove from selectedQuestionIds — the room flow
        // manages its own question queue and coverage should not reduce question count.
        if (coveredIds.size > 0 && !hasRoomPacing) {
          skippedCount = coveredIds.size;
          logClient('coverage:skip', { covered: Array.from(coveredIds), answeredCount });
          setSelectedQuestionIds(prev => prev.filter(id => !coveredIds.has(id)));
          // Update locked total so progress indicator stays accurate
          setLockedTotal(prev => prev !== null ? prev - skippedCount : null);
        } else if (coveredIds.size > 0) {
          logClient('coverage:room-pacing-ignore', { covered: Array.from(coveredIds), answeredCount });
        }
      }

      // Move to next question or complete
      if (hasRoomPacing) {
        // Room pacing: record answer and advance within room. Advancing past the
        // last question of the last room resolves asynchronously (round
        // transitions → finalizeRoomAndAdvance), so "interview finished" cannot
        // be detected synchronously here — the finish effect below owns it,
        // reading the flow state after React commits.
        roomFlow.recordAnswer(currentQuestion.id);
        roomFlow.advanceQuestion();
      } else if (currentQuestionIndex < totalQuestions - 1 - skippedCount) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        autoGenerateRef.current = true;
        setPhase("complete");
      }
    } catch (error: any) {
      console.error("[InterviewModal] handleQuestionAnswerSubmit error:", error);
      if (error?.message === "validation_failed") {
        setFieldErrors({ [currentQuestion.id]: "Unable to save this answer" });
      } else {
        handleBanner("Failed to save answer. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [currentQuestion, currentAnswer, currentQuestionIndex, totalQuestions, persistAnswers, generateSingleFollowUp, handleBanner, followUps, roomsBlocked]);

  // Handle regeneration prompt choices when a previous answer was changed
  const handleKeepExistingFollowUps = useCallback(async () => {
    if (!pendingResubmitQuestionId) return;
    answerSnapshotsRef.current.delete(pendingResubmitQuestionId);
    setShowRegeneratePrompt(false);
    setPendingResubmitQuestionId(null);
    // Re-trigger submit now that the snapshot is cleared
    handleQuestionAnswerSubmit();
  }, [pendingResubmitQuestionId, handleQuestionAnswerSubmit]);

  const handleRegenerateFollowUps = useCallback(async () => {
    if (!pendingResubmitQuestionId || !currentQuestion) return;
    const questionId = pendingResubmitQuestionId;
    answerSnapshotsRef.current.delete(questionId);
    // Remove old follow-ups for this question
    setFollowUps((prev) => prev.filter((group) => group.questionId !== questionId));
    setShowRegeneratePrompt(false);
    setPendingResubmitQuestionId(null);
    // Re-trigger submit — generateSingleFollowUp will be called as part of normal flow
    handleQuestionAnswerSubmit();
  }, [pendingResubmitQuestionId, currentQuestion, handleQuestionAnswerSubmit]);

  // Per-answer roomId (D5): resolve the room the CURRENT question belongs to, at
  // answer time. Only correct while the designer is on the question — bulk saves
  // later must read the captured map, never re-derive from roomFlow.currentRoom
  // (which is the last room by then). 'project' collapses to null (project-level
  // answers have no room).
  const resolveCurrentRoomId = useCallback((): string | null => {
    if (!hasRoomPacing) return null;
    const q = roomFlow.currentQuestion as { roomId?: string } | undefined;
    const rid = (q?.roomId) || roomFlow.currentRoom?.roomId || null;
    return rid === "project" ? null : rid;
  }, [hasRoomPacing, roomFlow.currentQuestion, roomFlow.currentRoom?.roomId]);

  // Handle answer change for current question
  const handleCurrentAnswerChange = useCallback(
    (value: string) => {
      if (!currentQuestion) return;

      // D5: stamp the answer with the room it's being given in, captured now
      // while roomFlow.currentRoom is still correct for this question.
      const rid = resolveCurrentRoomId();
      setAnswerRoomIds((prev) =>
        prev[currentQuestion.id] === rid ? prev : { ...prev, [currentQuestion.id]: rid },
      );

      // Update answers state
      setAnswers((prev) => {
        const filtered = prev.filter((a) => a.questionId !== currentQuestion.id || a.isFollowUp);
        const answerData: InterviewAnswer = {
          questionId: currentQuestion.id,
          role: currentQuestion.role === "ANY" ? "DESIGNER" : currentQuestion.role,
          section: currentQuestion.section,
          category: deriveCategory(currentQuestion.section),
          answer: value,
          isFollowUp: false,
        };
        return [...filtered, answerData];
      });
    },
    [currentQuestion, resolveCurrentRoomId]
  );

  async function persistBaseAnswers(
    baseOnly: InterviewAnswer[]
  ): Promise<SaveResult | void> {
    if (!baseOnly.length) {
      setFieldErrors({});
    }
    return persistAnswers(baseOnly);
  }

  async function persistAnswers(
    answersToPersist: InterviewAnswer[],
    options: {
      includeFollowUps?: boolean;
      roomStatuses?: Array<{ roomId: string; status: RoomProgressStatus }>;
    } = {}
  ): Promise<SaveResult | void> {
    const sanitized = answersToPersist
      .map((answer) => sanitizeAnswerForSend(answer))
      .filter(
        (value): value is ReturnType<typeof sanitizeAnswerForSend> =>
          value !== null
      );

    // Merge known statuses (state) with any this call is explicitly asserting;
    // the explicit call wins per roomId. Re-asserting known statuses on every
    // save defends server roomProgress against a stale recompute clobbering them.
    const mergedRoomStatuses = (() => {
      const map = new Map<string, RoomProgressStatus>();
      for (const [roomId, status] of Object.entries(roomStatuses)) map.set(roomId, status);
      for (const s of options.roomStatuses ?? []) map.set(s.roomId, s.status);
      return Array.from(map.entries()).map(([roomId, status]) => ({ roomId, status }));
    })();

    if (
      sanitized.length === 0 &&
      !options.includeFollowUps &&
      mergedRoomStatuses.length === 0
    ) {
      setFieldErrors({});
      return { ok: true, savedCount: 0, totalCount: 0 };
    }

    if (saveAbortRef.current) {
      saveAbortRef.current.abort();
    }
    const controller = new AbortController();
    saveAbortRef.current = controller;

    try {
        // Include metadata from questionMetadataMap
        const payload = {
          selectedQuestionIds,
          answers: sanitized
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .map((item) => {
              const questionMeta = questionMetadataMap.get(item.questionId);
              const morphedText = morphedQuestions.get(item.questionId);
              return {
                questionId: item.questionId,
                role: item.role,
                section: item.section,
                category: item.category,
                answer: item.answer,
                isFollowUp: item.isFollowUp,
                // inputModality (Pass B): resolved 'text' | 'voice' | 'mixed'.
                inputModality: resolveInputModality(item.questionId),
                // Include question text so it persists in provenance (prevents
                // UUID display). Morphed text wins (it's what was on screen),
                // then the text captured on the answer itself, then the question
                // set it came from — flat OR room-paced.
                prompt:
                  morphedText ||
                  (item.prompt || '').trim() ||
                  questionTextById.get(item.questionId) ||
                  '',
                // Metadata fields
                linkedImageId: questionMeta?.linkedImageId || null,
                linkedProductId: questionMeta?.linkedProductId || null,
                questionSource: (() => {
                  // Project-level questions get distinct questionSource for editorial generation
                  const resolvedRoomId = hasRoomPacing ? (questionMeta?.roomId || roomFlow.currentRoom?.roomId || null) : null;
                  if (resolvedRoomId === 'project') {
                    return item.isFollowUp ? 'project_follow_up' : 'project_question';
                  }
                  return questionMeta?.source || (item.isFollowUp ? 'follow_up' : 'base_question');
                })(),
                aiClassificationAttribute: (() => {
                  // For project questions, store category (e.g. "project_category:CLIENT_BRIEF")
                  const resolvedRoomId = hasRoomPacing ? (questionMeta?.roomId || roomFlow.currentRoom?.roomId || null) : null;
                  if (resolvedRoomId === 'project' && item.questionId.startsWith('project-')) {
                    const categoryMatch = item.questionId.match(/^project-([A-Z_]+)-/);
                    if (categoryMatch) return `project_category:${categoryMatch[1]}`;
                  }
                  return questionMeta?.attributeType && questionMeta?.attributeValue
                    ? `${questionMeta.attributeType}:${questionMeta.attributeValue}`
                    : null;
                })(),
                // Room pacing fields — project-level answers get roomId: null in DB.
                // D5: prefer the per-answer roomId captured at answer time. Bulk
                // saves (handleGenerate, room-status persists) must NOT re-derive
                // from roomFlow.currentRoom — that's the LAST room by then and
                // would stamp every answer with it, corrupting provenance.
                roomId: (() => {
                  const captured = answerRoomIds[item.questionId];
                  if (captured !== undefined) return captured; // already null for 'project'
                  const resolvedRoomId = hasRoomPacing ? (questionMeta?.roomId || roomFlow.currentRoom?.roomId || null) : null;
                  return resolvedRoomId === 'project' ? null : resolvedRoomId;
                })(),
                isCrossRoom: questionMeta?.isCrossRoom || false,
                // The answer this follow-up came out of (null for base questions).
                parentQuestionId: parentQuestionIdByFollowUp.get(item.questionId) ?? null,
              };
            }),
          // Room status persistence (C0) — merged into
          // EditorialInterview.roomProgress server-side, non-destructively.
          ...(mergedRoomStatuses.length > 0 ? { roomStatuses: mergedRoomStatuses } : {}),
        };

      console.log("[InterviewModal] Saving answers:", {
        projectId,
        answerCount: sanitized.length,
        selectedQuestionIds: selectedQuestionIds.length,
        payload: JSON.stringify(payload, null, 2),
      });

      const res = await fetch(
        `/api/posting/project/${projectId}/interview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
          keepalive: false,
        }
      );
      
      console.log("[InterviewModal] Save response:", {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        headers: Object.fromEntries(res.headers.entries()),
      });

      if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        const issues = Array.isArray(data.issues) ? data.issues : [];
        const issueMap = mapValidationIssues(issues, sanitized);
        setFieldErrors(issueMap);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            getValidationStorageKey(projectId),
            "validation_failed"
          );
        }
        throw new Error("validation_failed");
      }

      if (res.status === 409) {
        handleBanner("We’re syncing your answers—retrying…");
        throw new Error("concurrent_update");
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("[InterviewModal] Save request failed:", {
          status: res.status,
          statusText: res.statusText,
          error: data.error,
          data,
        });
        throw new Error(data.error || "save_failed");
      }

      const json = (await res.json()) as SaveResult;
      console.log("[InterviewModal] Save request succeeded:", json);
      setFieldErrors({});
      if (banner) setBanner(null);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(getValidationStorageKey(projectId));
        // Clear localStorage draft after successful save
        localStorage.removeItem(`interviewDraft:${projectId}`);
      }
      return json;
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return;
      }
      throw error;
    } finally {
      if (saveAbortRef.current === controller) {
        saveAbortRef.current = null;
      }
    }
  }

  async function handleSaveWithFollowUps(
    followUpOnly: InterviewAnswer[]
  ): Promise<void> {
    const baseOnly = answers.filter((answer) => !answer.isFollowUp);
    await persistBaseAnswers(baseOnly);
    await persistAnswers([...baseOnly, ...followUpOnly], {
      includeFollowUps: true,
    });
  }

  // C0: keep the room-status persister pointing at the latest answers + persist
  // fn, so the stable onRoomStatusChange callback always POSTs current context.
  useEffect(() => {
    persistRoomStatusRef.current = (roomId, status) => {
      void persistAnswers([...baseAnswers, ...followUpAnswersState], {
        includeFollowUps: true,
        roomStatuses: [{ roomId, status }],
      });
    };
  });

  const lastClickRef = useRef<number>(0);
  const DEBOUNCE_MS = 1000;
  const canClickGenerate = useMemo(() => !isGenerating, [isGenerating]);

  const handleGenerate = useCallback(async () => {
    // Quality gate: if some rooms aren't fully answered, confirm before spending
    // the generation call. Incomplete rooms are withheld so no placeholder prose
    // leaks into the story. Once confirmed this session, don't re-prompt.
    if (excludedRoomNames.length > 0 && !generateConfirmedRef.current) {
      logClient('generate:gated-incomplete-rooms', { excluded: excludedRoomNames });
      setShowGenerateConfirm(true);
      return;
    }

    const now = Date.now();
    if (now - lastClickRef.current < DEBOUNCE_MS) {
      logClient('generate:blocked:debounce');
      return;
    }
    lastClickRef.current = now;

    if (isGenerating) {
      logClient('generate:blocked:already-generating');
      return;
    }
    const currentAttempt = generationAttempts + 1;
    setGenerationAttempts(currentAttempt);
    logClient('generate:start', { baseAnswers: baseAnswers.length, followUps: followUpAnswersState.length, attempt: currentAttempt });
    setGenerationStep(0);
    setIsGenerating(true);
    setError(null);
    setFieldErrors({});

    try {
      // Validate we have answers before proceeding
      if (!baseAnswers.length || !baseAnswers.every(a => a.answer.trim().length > 0)) {
        throw new Error("Please complete all required questions before generating.");
      }

      // Ensure all answers are saved first - but only if we haven't already saved in handleAnswerStepComplete
      // Check if answers were just saved by checking if we're coming from the answer step
      // Always save when we have answers — ensures provenance is up to date
      const needsSave = baseAnswers.length > 0;

      // Addition 4: close the status race. Persist the FULL room-status map
      // (derived from roomFlow.roomProgress, not a delta) and await it before
      // generating. A dropped 'complete' would turn a finished room into a photo
      // block, so if this write fails we must NOT generate — the persist error
      // propagates out of this try and aborts handleGenerate.
      const fullRoomStatuses = hasRoomPacing
        ? Object.entries(roomFlow.roomProgress).map(([roomId, p]) => ({ roomId, status: p.status }))
        : [];

      if (needsSave) {
        try {
          // Save all answers including follow-ups (and the full status map) in one call
          const allAnswersResult = await persistAnswers([...baseAnswers, ...followUpAnswersState], {
            includeFollowUps: true,
            ...(fullRoomStatuses.length > 0 ? { roomStatuses: fullRoomStatuses } : {}),
          });
          console.log("[InterviewModal] All answers save result:", allAnswersResult);
          
          if (allAnswersResult === undefined) {
            console.warn("[InterviewModal] Save was aborted, waiting and retrying...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryResult = await persistAnswers([...baseAnswers, ...followUpAnswersState], {
              includeFollowUps: true,
            });
            if (!retryResult?.ok && retryResult !== undefined) {
              throw new Error("Failed to save answers after retry.");
            }
          } else if (!allAnswersResult?.ok) {
            console.error("[InterviewModal] Save failed:", allAnswersResult);
            throw new Error("Failed to save answers. Please try again.");
          }
        } catch (saveError: any) {
          console.error("[InterviewModal] Error saving answers:", saveError);
          if (saveError?.message === "validation_failed") {
            throw saveError;
          }
          if (saveError?.message === "concurrent_update") {
            // Retry after a delay
            console.log("[InterviewModal] Concurrent update, retrying...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryResult = await persistAnswers([...baseAnswers, ...followUpAnswersState], {
              includeFollowUps: true,
            });
            if (!retryResult?.ok && retryResult !== undefined) {
              throw new Error("Failed to save answers after retry.");
            }
          } else {
            throw new Error(`Failed to save answers: ${saveError?.message || "Unknown error"}`);
          }
        }

        // Wait for database transaction to commit
        // Increased wait time to ensure answers are fully persisted before generation
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logClient('generate:request:begin', { projectId });

      // Send answers directly in the request body via answersOverride
      // This bypasses the provenance race condition where concurrent writes
      // from answer save and follow-up endpoints can corrupt provenance state
      let res = await fetch(
        `/api/posting/project/${projectId}/interview/generate?forceOverwriteDraft=true&mode=recomposition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            forceOverwriteDraft: true,
            mode: 'recomposition',
            // Only fully-answered rooms compose into the story; the server
            // withholds images for any room not in this set (incomplete rooms
            // never emit placeholder chapters). Omitted when not room-paced.
            completedRoomIds,
            answersOverride: baseAnswers.map(a => ({
              questionId: a.questionId,
              section: a.section,
              prompt: a.prompt || a.questionId,
              answer: a.answer,
              role: a.role || 'DESIGNER',
              isFollowUp: false,
              // D5: carry roomId so the override path and the provenance path
              // agree on room attribution (eligibility groups by roomId).
              roomId: answerRoomIds[a.questionId] ?? null,
            })),
            followupsOverride: followUpAnswersState
              .filter(a => a.answer?.trim())
              .map(a => ({
                questionId: a.questionId,
                section: a.section,
                prompt: a.prompt || a.questionId,
                answer: a.answer,
                role: a.role || 'DESIGNER',
                isFollowUp: true,
                roomId: answerRoomIds[a.questionId] ?? null,
              })),
          }),
        }
      );

      logClient('generate:response:status', { status: res.status });

      // Handle 202 Accepted - generation in progress
      if (res.status === 202) {
        logClient('generate:in-progress');
        handleBanner("Generation is already in progress. Please wait...");
        // Keep modal in "Generating..." state
        // User can close and reopen after ~10-15s to check status
        return;
      }

      // Handle hard-fail errors (502, 400) - show user-friendly error
      if (!res.ok && res.status >= 400) {
        const errData = await res.json().catch(() => ({}));
        const errorCode = errData?.code || 'COMPOSE_ERROR';
        const errorMessage = errData?.error || `Story generation failed (${res.status})`;
        logClient('generate:hard-fail', { status: res.status, code: errorCode, message: errorMessage });
        
        // Log full error details for debugging
        console.error('[InterviewModal] Generation error:', { errorCode, errorMessage });
        // Show user-friendly error message (no internal codes or terminology)
        handleBanner('Story generation failed. Nothing was saved \u2014 your interview answers are safe. Try regenerating.');
        setIsGenerating(false);
        return;
      }

      // Handle 409 Conflict - legacy support, but should now be 202
      if (res.status === 409) {
        logClient('generate:conflict_retry');
        handleBanner("Regenerating draft with updated answers...");
        
        // Wait a bit longer to ensure database transaction has committed
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Retry with force=true to overwrite existing draft, include answers
        const retry = await fetch(
          `/api/posting/project/${projectId}/interview/generate?forceOverwriteDraft=true&mode=recomposition`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              forceOverwriteDraft: true,
              mode: 'recomposition',
              answersOverride: baseAnswers.map(a => ({
                questionId: a.questionId,
                section: a.section,
                prompt: a.prompt || a.questionId,
                answer: a.answer,
                role: a.role || 'DESIGNER',
                isFollowUp: false,
                roomId: answerRoomIds[a.questionId] ?? null,
              })),
              followupsOverride: followUpAnswersState
                .filter(a => a.answer?.trim())
                .map(a => ({
                  questionId: a.questionId,
                  section: a.section,
                  prompt: a.prompt || a.questionId,
                  answer: a.answer,
                  role: a.role || 'DESIGNER',
                  isFollowUp: true,
                  roomId: answerRoomIds[a.questionId] ?? null,
                })),
            }),
          }
        );
        logClient('generate:conflict_retry:status', { status: retry.status });
        
        if (!retry.ok) {
          const errData = await retry.json().catch(() => ({}));
          const errorCode = errData?.code || 'COMPOSE_ERROR';
          const errorMessage = errData?.error || `Story generation failed (${retry.status})`;
          logClient('generate:conflict_retry:error', { code: errorCode, message: errorMessage });
          
          // Handle hard-fail errors (502, 400)
          if (retry.status >= 400) {
            console.error('[InterviewModal] Retry generation error:', { errorCode, errorMessage });
            handleBanner('Story generation failed. Nothing was saved \u2014 your interview answers are safe. Try regenerating.');
            setIsGenerating(false);
            return;
          }
          
          // Handle specific error cases (should not happen with hard-fail, but keep for safety)
          if (retry.status === 400) {
            const errorMsg = errorMessage;
            if (errorMsg.includes("No interview answers found")) {
              handleBanner("Answers weren't saved properly. Please try saving again and then generate.");
              setIsGenerating(false);
              return;
            }
            handleBanner(`Generation failed: ${errorMsg}`);
            setIsGenerating(false);
            return;
          }
          
          if (retry.status === 429) {
            const resetAt = errData.resetAt
              ? new Date(errData.resetAt).toLocaleTimeString()
              : "soon";
            throw new Error(`Rate limit reached. Try again ${resetAt}.`);
          }
          
          throw new Error(`Generation failed after retry (${retry.status})`);
        }
        
        const retryData = await retry.json();
        logClient('generate:conflict_retry:body', { 
          ok: retryData.ok, 
          usedFallback: retryData?.metadata?.usedFallback, 
          followupsCount: retryData?.metadata?.followupsCount 
        });
        
        // Optionally show subtle banner if fallback used
        if (retryData?.metadata?.usedFallback) {
          setBanner('Generated a base story draft while AI was unavailable. You can refine this later.');
        }

        stashExcludedRooms(projectId, retryData?.excludedRooms);
        onOpenChange(false);
        if (onDraftGenerated) {
          onDraftGenerated();
        } else {
          router.push(`/designer/projects/${projectId}/preview`);
        }
        return;
      }

      if (res.status === 429) {
        const data = await res.json();
        const resetAt = data.resetAt
          ? new Date(data.resetAt).toLocaleTimeString()
          : "soon";
        throw new Error(`Rate limit reached. Try again ${resetAt}.`);
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        logClient('generate:error', data);
        const errorMsg = data.error || "No interview answers found";
        
        if (errorMsg.includes("No interview answers found")) {
          throw new Error("Answers weren't saved properly. Please save your answers and try again.");
        }
        
        if (data.issues && Array.isArray(data.issues)) {
          const issueDetails = data.issues
            .map((issue: any) => `${issue.path?.join('.') || 'unknown'}: ${issue.message || 'validation failed'}`)
            .join(', ');
          throw new Error(`Validation error: ${issueDetails}`);
        }
        
        throw new Error(errorMsg + (data.message ? `: ${data.message}` : ''));
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        logClient('generate:error', err);
        setBanner('We couldn\'t create your story just now. Please try again.');
        return;
      }

      const data = await res.json();
      logClient('generate:response:body', { 
        ok: data.ok, 
        usedFallback: data?.metadata?.usedFallback, 
        followupsCount: data?.metadata?.followupsCount 
      });
      
      if (data?.metadata?.usedFallback) {
        setBanner('Generated a base draft while AI was unavailable. You can refine this later.');
      }

      stashExcludedRooms(projectId, data?.excludedRooms);
      onOpenChange(false);
      if (onDraftGenerated) {
        onDraftGenerated();
      } else {
        router.push(`/designer/projects/${projectId}/preview`);
      }
    } catch (err: any) {
      console.error("[InterviewModal] handleGenerate error:", err);
      if (err?.message !== "validation_failed") {
        if (currentAttempt >= MAX_GENERATION_ATTEMPTS) {
          setError("We're having trouble generating your story. Your interview answers are saved — you can try again later or contact support.");
        } else {
          setError(`Generation failed (attempt ${currentAttempt} of ${MAX_GENERATION_ATTEMPTS}). ${err?.message || "Please try again."}`);
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }, [projectId, isGenerating, generationAttempts, baseAnswers, followUpAnswersState, step, router, onOpenChange, onDraftGenerated, handleBanner, persistAnswers, excludedRoomNames, completedRoomIds]);

  // Quality-gate confirmation: proceed with only the completed rooms, or return
  // to the interview to finish the incomplete ones.
  const handleConfirmGenerate = useCallback(() => {
    generateConfirmedRef.current = true;
    setShowGenerateConfirm(false);
    handleGenerate();
  }, [handleGenerate]);

  const handleCancelGenerate = useCallback(() => {
    // Bail without generating. All answers are already persisted, so closing is
    // lossless; the designer can reopen (Continue interview) to finish the
    // remaining rooms before generating.
    setShowGenerateConfirm(false);
    onOpenChange(false);
  }, [onOpenChange]);

  // Auto-trigger generation when phase transitions to "complete" from the last question
  useEffect(() => {
    if (phase === "complete" && autoGenerateRef.current && !isGenerating) {
      autoGenerateRef.current = false;
      handleGenerate();
    }
  }, [phase, handleGenerate, isGenerating]);

  const handleAnswerStepComplete = useCallback(async () => {
    setFieldErrors({});
    try {
      await persistBaseAnswers(baseAnswers);
    } catch (err: any) {
      if (err?.message !== "validation_failed") {
        handleBanner("We're syncing your answers—retrying…");
      }
      return;
    }

    setIsLoadingFollowUps(true);
    setFollowupsTried(true);

    logClient('followups:request:begin', { projectId });

    let resp: Response | null = null;
    let data: FollowupsApiResponse | null = null;
    
    try {
      resp = await fetch(`/api/posting/project/${projectId}/interview/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: baseAnswers.map((answer) => ({
            questionId: answer.questionId,
            answer: answer.answer,
          })),
        }),
      });
      logClient('followups:response:status', { status: resp.status });
      data = await resp.json() as FollowupsApiResponse;
      logClient('followups:response:body', { ok: data?.ok, error: data?.error, count: (data?.followups || []).length });
    } catch (e) {
      logClient('followups:error', String(e));
      // Check if we have cached follow-ups from this session
      if (cachedFollowups.length > 0) {
        logClient('followups:network_error_using_cached', { count: cachedFollowups.length });
        setBanner('Using your last generated follow-ups from this session.');
        setFollowUps(cachedFollowups);
        setPhase("followup");
        setStep("followups");
        setIsLoadingFollowUps(false);
        return;
      }
      setBanner('We couldn\'t reach the AI follow-ups service. You can retry or continue with a base story draft.');
      setIsLoadingFollowUps(false);
      return;
    }

    // Case 1: Hard error response
    if (!resp.ok || data?.ok === false) {
      // Check if we have cached follow-ups from this session
      if (cachedFollowups.length > 0) {
        logClient('followups:error_using_cached', { status: resp.status, count: cachedFollowups.length });
        setBanner('Using your last generated follow-ups from this session.');
        setFollowUps(cachedFollowups);
        setPhase("followup");
        setStep("followups");
        setIsLoadingFollowUps(false);
        return;
      }
      
      if (resp.status === 404) {
        setBanner("Posting feature is disabled.");
      } else if (resp.status === 422) {
        setBanner(data.error === "invalid_body" 
          ? "Invalid answers provided. Please try again."
          : "Validation error. Please check your answers.");
      } else if (resp.status === 409) {
        setBanner("Conflict detected. Please refresh and try again.");
      } else if (resp.status === 503 || resp.status === 502) {
        setBanner('AI follow-ups failed to generate. You can retry or continue with a base story draft.');
      } else {
        setBanner('AI follow-ups failed to generate. You can retry or continue with a base story draft.');
      }
      setIsLoadingFollowUps(false);
      return;
    }

    // Case 2: Service replied but with an error code (silent failure scenario)
    if (data?.error) {
      // Check if we have cached follow-ups from this session
      if (cachedFollowups.length > 0) {
        logClient('followups:using_cached', { count: cachedFollowups.length });
        setBanner('Using your last generated follow-ups from this session.');
        setFollowUps(cachedFollowups);
        setPhase("followup");
        setStep("followups");
        setIsLoadingFollowUps(false);
        return;
      }
      setBanner('AI assistant is temporarily unavailable. You can continue now; you\'ll still be able to refine later.');
      setIsLoadingFollowUps(false);
      return;
    }

    // Case 3: OK + followups
    const list = (data as FollowupsApiResponse)?.followups ?? [];
    if (list.length > 0) {
      // Clear any error banners on success
      setBanner(null);
      // Transform to format expected by FollowUpsForm: Array<{ questionId, followUps: Array<{ id, prompt }> }>
      const grouped = new Map<string, Array<{ id: string; prompt: string }>>();
      for (const fu of list) {
        if (!fu.questionId || !fu.id || !fu.text) continue;
        if (!grouped.has(fu.questionId)) {
          grouped.set(fu.questionId, []);
        }
        grouped.get(fu.questionId)!.push({
          id: fu.id,
          prompt: fu.text,
        });
      }
      const followUpsGroups = Array.from(grouped.entries()).map(([questionId, followUps]) => ({
        questionId,
        followUps,
      }));
      setFollowUps(followUpsGroups);
      // Cache successful follow-ups for this session
      setCachedFollowups(followUpsGroups);
      setPhase("followup");
      setStep("followups");
      setIsLoadingFollowUps(false);
      return;
    }

    // Case 4: OK + empty (no followups needed)
    logClient('followups:none_needed');
    setIsLoadingFollowUps(false);
    await handleGenerate();
  }, [baseAnswers, projectId, cachedFollowups, persistBaseAnswers, handleBanner, handleGenerate]);

  const canProceedFromAnswer =
    baseAnswers.length >= 1 &&
    baseAnswers.every((answer) => answer.answer.trim().length > 0);
  
  // Phase A: Sequential flow - can proceed if current answer is filled
  const canProceedFromQuestion = currentAnswer.trim().length > 0;

  const materials = (tags || [])
    .map((tag: any) => ({
      name: tag.product?.name,
      vendor: tag.product?.vendor?.name,
      thumb: tag.product?.imageUrl,
    }))
    .filter((material: any) => !!material.name);

  const hasTaggedProducts = materials.length > 0;

  // --- Two-column editorial layout derivations (question phase) ---
  // The room the current question belongs to, for the left-column photo + chips.
  const currentRoomForPhoto = roomFlow.currentRoom
    ? { roomId: roomFlow.currentRoom.roomId, roomName: roomFlow.currentRoom.roomName }
    : null;
  const isProjectRoom = !currentRoomForPhoto || currentRoomForPhoto.roomId === "project";
  // Eyebrow: "Question NN · <section>". Section is the room name, or a plain
  // "About this project" for the project group / non-room-paced flows.
  const displayedQuestionNumber = hasRoomPacing
    ? roomFlow.currentQuestionIndex + 1
    : currentQuestionIndex + 1;
  const sectionLabel = isProjectRoom
    ? "About this project"
    : currentRoomForPhoto!.roomName;
  // Only surface a left-column photo for a project question when the question is
  // genuinely linked to an image; room questions resolve their own room photo.
  const currentLinkedImageId =
    (roomFlow.currentQuestion as { linkedImageId?: string | null } | undefined)?.linkedImageId ??
    questionMetadataMap.get(currentQuestion?.id || "")?.linkedImageId ??
    null;
  // Only mount the left photo column when there's an actual photo to show. A
  // project question with no linked image (or a room with no matching photos)
  // renders single-column rather than an empty panel.
  const heroImage = computeRoomHeroImage(images, currentRoomForPhoto, currentLinkedImageId);
  const hasHeroPhoto = heroImage !== null;

  // Footer bar — shared across phases. Rendered inside the right column of the
  // two-column grid during the question phase, and at the modal root otherwise.
  const footerBar =
    !showDraftResume && !(phase === "complete" && (isGenerating || showGenerateConfirm)) ? (
      <FooterBar
        phase={phase}
        onBack={
          phase === "question" && (hasRoomPacing ? roomFlow.canGoBack : currentQuestionIndex > 0)
            ? () => {
                // Snapshot the current question's persisted answer before navigating back
                if (currentQuestion) {
                  const existing = baseAnswers.find((a) => a.questionId === currentQuestion.id);
                  if (existing?.answer) {
                    answerSnapshotsRef.current.set(currentQuestion.id, existing.answer);
                  }
                }
                if (hasRoomPacing) {
                  roomFlow.goToPreviousQuestion();
                } else {
                  setCurrentQuestionIndex((prev) => prev - 1);
                }
              }
            : step === "followups"
            ? () => setStep("answer")
            : undefined
        }
        onNext={undefined}
        onSubmit={phase === "question" ? handleQuestionAnswerSubmit : undefined}
        onGenerate={phase === "complete" || step === "followups" ? handleGenerate : undefined}
        onSkip={
          phase === "followup"
            ? handleGenerate
            : step === "followups"
            ? handleGenerate
            : banner && followupsTried && step === "answer"
            ? handleGenerate
            : undefined
        }
        onQuestionSkip={phase === "question" ? () => setSkipSheet("choice") : undefined}
        canProceed={
          phase === "question"
            ? canProceedFromQuestion
            : step === "answer"
            ? canProceedFromAnswer
            : true
        }
        isSubmitting={isSubmitting}
        isGenerating={isGenerating}
        isLoadingFollowUps={isLoadingFollowUps}
        isLastQuestion={isLastQuestion}
        isInterviewComplete={isInterviewComplete}
        isNearFinish={isNearFinish}
        generationProgressMessage={isGenerating ? GENERATION_MESSAGES[generationStep] : undefined}
        generationAttempts={generationAttempts}
        roomMeta={
          phase === "question" && hasRoomPacing
            ? { index: roomFlow.currentRoomIndex + 1, total: roomFlow.rooms.length }
            : undefined
        }
      />
    ) : null;

  // Cinematic backdrop: mirror the reference photo currently shown in the left
  // column as a blurred, dimmed full-screen layer behind the modal, so the sharp
  // reference reads as floating over its own room rather than a sterile white
  // scrim. Only present while a room reference photo is showing (question phase);
  // otherwise the Dialog falls back to its default frosted backdrop.
  const cinematicBackdrop = activeRefImageUrl ? (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={activeRefImageUrl}
        src={activeRefImageUrl}
        alt=""
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
      />
      {/* Scrim + top/bottom gradient: dim enough that a bright photo never washes
          out the screen or fights the modal's edges, but light enough that the
          room still reads through — the point is warmth, not a black void. */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20" />
    </div>
  ) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      backdropClassName={cinematicBackdrop ? "bg-black/70" : undefined}
      backgroundLayer={cinematicBackdrop}
    >
      <DialogContent
        className={
          phase === "question" || phase === "followup"
            ? "relative flex h-[90vh] max-h-[90vh] w-full max-w-[1120px] flex-col !overflow-hidden border !rounded-[24px] !border-[color:var(--folio-border-subtle)] !bg-[var(--surface-canvas)] shadow-[var(--shadow-3)]"
            : "max-w-6xl max-h-[90vh] overflow-y-auto glass-overlay shadow-2xl rounded-[20px]"
        }
      >
        {/* Interview Mode Selection */}
        {interviewMode === "select" && phase === "question" && currentQuestionIndex === 0 && !baseAnswers.length && (
          <InterviewModeSelector
            projectName={projectName}
            onSelectMode={(mode) => {
              setInterviewMode(mode);
              // If text mode, continue with existing flow
              // If realtime, the RealtimeInterviewView handles everything
            }}
          />
        )}

        {/* Realtime Interview View */}
        {interviewMode === "realtime" && (
          <RealtimeInterviewView
            projectId={projectId}
            projectName={projectName}
            onComplete={async (sessionId) => {
              // Convert realtime session to editorial format
              try {
                await fetch('/api/interview/realtime/convert', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId }),
                });
                // Close modal and navigate to post
                onOpenChange(false);
                router.push(`/posting/project/${projectId}?tab=post`);
              } catch (err) {
                console.error('Failed to convert session:', err);
              }
            }}
            onSwitchToText={() => {
              setInterviewMode("text");
            }}
          />
        )}

        {/* Text Interview Flow (existing) */}
        {/* Loading state — held until questions are ready, including the slow
            room-paced generation, so we never flash the flat (room-first)
            questions before "About This Project" settles in. */}
        {interviewMode === "text" && (questionsLoading || roomQuestionsPending) && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 text-center">
            <div className="max-w-md space-y-5">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              <h3 className="text-xl font-serif text-folio-text-primary">
                Preparing your interview
              </h3>
              <p className="text-sm text-folio-text-secondary leading-relaxed">
                We’re reading {projectName} — your rooms and the pieces you tagged — to
                shape questions worth answering. This only takes a moment.
              </p>
            </div>
          </div>
        )}

        {interviewMode === "text" && !questionsLoading && !roomQuestionsPending && (
          <>
            {/* Error state for questions */}
            {!hasRoomPacing && fetchedQuestions.length === 0 && phase === "question" && (
          <div className="p-8 text-center">
            <p className="text-stone-600 mb-4">
              No questions available for this project. Please ensure your project has images or product selections.
            </p>
            <button onClick={() => onOpenChange(false)} className="text-stone-900 underline">
              Close
            </button>
          </div>
        )}
        {/* Top bar — close, a warm divider, then the room-selector chips. */}
        {(phase === "question" || phase === "followup" || phase === "complete") && (
          <div
            className="flex shrink-0 items-center gap-4 border-b px-5 py-3.5"
            style={{ borderColor: "var(--folio-border-subtle)" }}
          >
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1 text-folio-text-secondary transition-colors hover:bg-surface-ground hover:text-folio-text-primary"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {phase === "question" && currentQuestion && !showDraftResume && hasRoomPacing && (
              <>
                <span
                  className="h-6 w-px shrink-0"
                  style={{ background: "var(--folio-border-subtle)" }}
                />
                <RoomChips
                  rooms={roomFlow.rooms.map((room) => ({
                    roomId: room.roomId,
                    roomName: room.roomName,
                    status: roomFlow.roomProgress[room.roomId]?.status ?? "not_started",
                  }))}
                  currentRoomIndex={roomFlow.currentRoomIndex}
                />
              </>
            )}
          </div>
        )}

        <DialogHeader className="hidden">
          <DialogTitle className="text-2xl font-serif">
            Project Interview
          </DialogTitle>
        </DialogHeader>

        {banner && (
          <div className={`mx-8 mt-4 mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800 ${phase === "question" || phase === "followup" ? "" : ""}`}>
            {banner}
          </div>
        )}

        {llmAvailable === false && phase === "complete" && (
          <div className="mx-6 mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            AI not configured — we'll use a clean template. You can publish now
            and refine later.
          </div>
        )}

        {error && (
          <div className={`mx-8 mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 ${phase === "question" || phase === "followup" ? "" : ""}`}>
            {error}
          </div>
        )}


        {/* Draft resume prompt */}
        {showDraftResume ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
            <div className="max-w-md text-center space-y-6">
              <h3 className="text-xl font-serif text-folio-text-primary">
                Welcome back
              </h3>
              <p className="text-sm text-folio-text-secondary leading-relaxed">
                You have a draft in progress with {draftAnswerCount} answer{draftAnswerCount !== 1 ? 's' : ''} saved.
                Would you like to pick up where you left off?
              </p>
              <div className="flex flex-col gap-3 pt-2">
                <button
                  disabled={isClearing}
                  onClick={() => {
                    setShowDraftResume(false);
                    // Arm resume navigation: the effect jumps room-paced flows to
                    // the room the designer actually reached (non-room-paced flows
                    // keep the preload-restored currentQuestionIndex).
                    setResumeRequested(true);
                    console.log('[InterviewModal] Resuming draft at index:', currentQuestionIndex);
                  }}
                  className="px-6 py-3 text-sm font-medium text-white bg-[var(--accent)] rounded-full hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                >
                  Continue where I left off
                </button>
                <button
                  disabled={isClearing}
                  onClick={() => handleStartOver()}
                  className="px-6 py-3 text-sm font-medium text-folio-text-secondary hover:text-folio-text-primary transition-colors disabled:opacity-50"
                >
                  {isClearing ? "Clearing..." : "Start over"}
                </button>
              </div>
            </div>
          </div>
        ) : phase === "question" && !preloadComplete && baseAnswers.length === 0 ? (
          /* Preload in flight and no answers loaded yet — hold on a spinner
             instead of flashing About Q1 before we know whether the designer
             already has saved progress (the "first question pops up, then a
             minute to register" report). Scoped to `baseAnswers.length === 0` so
             a reopen with already-loaded state shows content immediately rather
             than a spinner flash while the GET refreshes. */
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : phase === "question" && !displayQuestion && allQuestions.length > 0 ? (
          /* Question set loading / resolving — prevents blank screen during ID realignment */
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : phase === "question" && hasRoomPacing && roomFlow.pendingRoundTransition ? (
          /* Round transition: generating batch follow-ups between rounds */
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
            <div className="max-w-md text-center space-y-4">
              <p className="text-lg font-serif text-folio-text-primary">
                {roomFlow.isProjectPhase
                  ? "Great — thanks for the overview."
                  : `Great answers about your ${roomFlow.currentRoom?.roomName || 'room'}.`}
              </p>
              <p className="text-sm text-folio-text-secondary">
                {roomFlow.isProjectPhase
                  ? "A few follow-ups before we get into the rooms..."
                  : "A couple more questions based on what you shared..."}
              </p>
              <div className="flex justify-center pt-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent)] border-t-transparent" />
              </div>
            </div>
          </div>
        ) : phase === "question" && hasRoomPacing && waitingForRooms ? (
          /* Two-phase generation: rooms are being built from the About answers */
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
            <div className="max-w-md text-center space-y-4">
              <p className="text-lg font-serif text-folio-text-primary">
                Your project story is set.
              </p>
              <p className="text-sm text-folio-text-secondary">
                Preparing questions for each room based on what you&apos;ve shared...
              </p>
              <div className="flex justify-center pt-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent)] border-t-transparent" />
              </div>
            </div>
          </div>
        ) : phase === "question" && displayQuestion ? (
          /* Editorial layout: room photo left (only when there's one), question
             + answer right. Falls back to a single column with no left panel. */
          <div
            className={`grid min-h-0 flex-1 ${
              hasHeroPhoto ? "grid-cols-1 md:grid-cols-[430px_1fr]" : "grid-cols-1"
            }`}
          >
            {/* Left — the room reference photo, full-bleed to the card edge. */}
            {hasHeroPhoto && (
              <div className="hidden md:block">
                <RoomPhoto
                  key={currentRoomForPhoto?.roomId ?? "project"}
                  images={images}
                  currentRoom={currentRoomForPhoto}
                  linkedImageId={currentLinkedImageId}
                  onActiveImageChange={handleActiveRefImage}
                />
              </div>
            )}

            {/* Right — question, answer, and the footer row. */}
            <div className="flex min-h-0 flex-col">
              <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
                <QuestionCard
                  question={displayQuestion}
                  answer={currentAnswer}
                  onAnswerChange={handleCurrentAnswerChange}
                  onInputSource={handleInputSource}
                  onSubmit={handleQuestionAnswerSubmit}
                  isSubmitting={isSubmitting || isLoadingFollowUps}
                  fieldError={fieldErrors[currentQuestion?.id || ""]}
                  projectId={projectId}
                  questionMetadata={questionMetadataMap.get(currentQuestion?.id || "")}
                  questionNumber={displayedQuestionNumber}
                  sectionLabel={sectionLabel}
                />
              </div>
              {footerBar}
            </div>
          </div>
        ) : phase === "complete" && showGenerateConfirm ? (
          /* Quality gate: some rooms aren't finished — confirm before generating */
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
            <div className="max-w-md text-center space-y-6">
              <h3 className="text-xl font-serif text-folio-text-primary">
                A few rooms aren’t finished
              </h3>
              <p className="text-sm text-folio-text-secondary leading-relaxed">
                These rooms don’t have all their questions answered yet, so we’ll leave
                them out of your story for now — a half-finished room reads as low quality.
              </p>
              <ul className="text-sm font-medium text-folio-text-primary space-y-1">
                {excludedRoomNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <p className="text-sm text-folio-text-secondary leading-relaxed">
                Finish them now, or generate with your completed rooms and add these later.
              </p>
              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={handleConfirmGenerate}
                  className="px-6 py-3 text-sm font-medium text-white bg-[var(--accent)] rounded-full hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Generate with completed rooms
                </button>
                <button
                  onClick={handleCancelGenerate}
                  className="px-6 py-3 text-sm font-medium text-folio-text-secondary hover:text-folio-text-primary transition-colors"
                >
                  Not now — I’ll finish these first
                </button>
              </div>
            </div>
          </div>
        ) : phase === "complete" ? (
          /* Generation in progress — auto-triggered after last question */
          <GenerationProgress
            currentStep={generationStep}
            messages={GENERATION_MESSAGES}
            isGenerating={isGenerating}
            error={error}
            generationAttempts={generationAttempts}
            maxAttempts={MAX_GENERATION_ATTEMPTS}
          />
        ) : (
          /* Followup phase (batch flow for backward compatibility) */
          <div className={`mt-6 md:flex md:items-start md:gap-6 ${phase === "followup" ? "flex-1 min-h-0 px-6 pb-6" : ""}`}>
            <div className="flex-1 min-w-0">
              {phase === "followup" || step === "followups" ? (
                <FollowUpsForm
                  initialAnswers={answers}
                  followUps={followUps}
                  onAnswersChange={handleFollowUpsChange}
                  onSave={handleSaveWithFollowUps}
                  fieldErrors={fieldErrors}
                />
              ) : null}
            </div>
          </div>
        )}

            {showRegeneratePrompt && (
              <div className="px-8 py-3 border-t border-folio-border-subtle/30 bg-amber-50/80">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                  <p className="text-sm text-folio-text-primary">
                    This answer has changed. Regenerate follow-up questions?
                  </p>
                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={handleKeepExistingFollowUps}
                      className="px-4 py-1.5 text-sm font-medium text-folio-text-secondary hover:text-folio-text-primary transition-colors"
                    >
                      Keep existing
                    </button>
                    <button
                      onClick={handleRegenerateFollowUps}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--accent)] rounded-full hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* The question phase renders its footer inside the grid's right
                column; every other phase renders it here at the modal root. */}
            {phase !== "question" && footerBar}

            {/* Skip choice sheet (A2). Two options; the "skip this room" option is
                omitted for the About This Project group (roomId 'project'), which
                frames the article and has no gallery fallback. */}
            {skipSheet && (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center p-4"
                onClick={() => setSkipSheet(false)}
              >
                <div className="absolute inset-0 bg-black/30" />
                <div
                  className="relative w-full max-w-sm rounded-2xl bg-surface-canvas glass-overlay shadow-2xl p-6 space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {skipSheet === "choice" ? (
                    <>
                      <h3 className="text-lg font-serif text-folio-text-primary">Skip</h3>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={handleSkipQuestion}
                          className="w-full px-4 py-3 text-sm font-medium text-left text-folio-text-primary rounded-xl border border-folio-border-subtle hover:border-folio-border-subtle/80 hover:bg-surface-ground/50 transition-colors"
                        >
                          Skip this question
                        </button>
                        {roomFlow.currentRoom && roomFlow.currentRoom.roomId !== "project" && (
                          <button
                            onClick={() => setSkipSheet("confirmRoom")}
                            className="w-full px-4 py-3 text-sm font-medium text-left text-folio-text-primary rounded-xl border border-folio-border-subtle hover:border-folio-border-subtle/80 hover:bg-surface-ground/50 transition-colors"
                          >
                            Skip this room
                          </button>
                        )}
                        <button
                          onClick={() => setSkipSheet(false)}
                          className="w-full px-4 py-2 text-sm font-medium text-folio-text-secondary hover:text-folio-text-primary transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-folio-text-secondary leading-relaxed">
                        The photos from this room will still appear in the gallery at the
                        bottom of the article. No write-up will be generated for it. You
                        can come back and complete it later.
                      </p>
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => setSkipSheet("choice")}
                          className="px-4 py-2 text-sm font-medium text-folio-text-secondary hover:text-folio-text-primary transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleSkipRoom}
                          className="px-6 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-full hover:bg-[var(--accent-hover)] transition-colors"
                        >
                          Skip room
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function getValidationStorageKey(projectId: string) {
  return `folio.interview.validation.${projectId}`;
}

/** Key the Story tab reads to surface a "these rooms were left out" notice. */
export function getExcludedRoomsStorageKey(projectId: string) {
  return `folio.interview.excludedRooms.${projectId}`;
}

/**
 * Persist the rooms the server withheld from generation so the Story surface can
 * tell the designer which rooms weren't included (and why). Cleared once shown.
 */
function stashExcludedRooms(
  projectId: string,
  excludedRooms: Array<{ roomName: string }> | undefined,
) {
  if (typeof window === "undefined") return;
  try {
    const names = Array.isArray(excludedRooms)
      ? excludedRooms.map((r) => r?.roomName).filter((n): n is string => !!n)
      : [];
    const key = getExcludedRoomsStorageKey(projectId);
    if (names.length > 0) {
      window.sessionStorage.setItem(key, JSON.stringify(names));
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    /* noop */
  }
}

function sanitizeAnswerForSend(
  answer: InterviewAnswer
):
  | {
      questionId: string;
      role: InterviewAnswer["role"];
      section?: InterviewAnswer["section"];
      category?: SixWCategory;
      answer: string;
      isFollowUp?: boolean;
      prompt?: string;
    }
  | null {
  const trimmed = answer.answer.trim();
  if (!trimmed) return null;
  return {
    questionId: answer.questionId,
    role: answer.role,
    section: answer.section,
    category: answer.category ?? deriveCategory(answer.section),
    answer: trimmed.slice(0, 2000),
    isFollowUp: answer.isFollowUp,
    // The question text the designer actually saw. Stripping it here is what
    // made the save path fall back to a question list that doesn't contain
    // room-paced questions, persisting them with an empty prompt.
    prompt: answer.prompt,
  };
}

function deriveCategory(section?: string): SixWCategory | undefined {
  if (!section) return undefined;
  if (!SIX_W_SECTIONS.has(section)) return undefined;
  return section.toUpperCase() as SixWCategory;
}

function normalizeIncomingAnswers(raw: any[]): InterviewAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const trimmed = typeof item.answer === "string" ? item.answer.trim() : "";
      if (!trimmed) return null;
      return {
        questionId: String(item.questionId),
        role: item.role ?? "DESIGNER",
        section: item.section,
        category: item.category ?? deriveCategory(item.section),
        answer: trimmed.slice(0, 2000),
        isFollowUp: Boolean(item.isFollowUp),
        // Carry the persisted question text back in, so a later bulk re-save
        // can't blank out a prompt this session never had to resolve.
        prompt: typeof item.prompt === "string" ? item.prompt : undefined,
      } as InterviewAnswer;
    })
    .filter((value): value is InterviewAnswer => value !== null);
}

function mapValidationIssues(
  issues: Array<{ path?: Array<string | number>; message?: string }>,
  answers: Array<ReturnType<typeof sanitizeAnswerForSend>>
): Record<string, string> {
  const map: Record<string, string> = {};
  issues.forEach((issue) => {
    const index = issue.path?.find(
      (segment) => typeof segment === "number"
    ) as number | undefined;
    if (typeof index === "number" && answers[index]) {
      map[answers[index]!.questionId] =
        issue.message || "Unable to save this answer";
    }
  });
  return map;
}

