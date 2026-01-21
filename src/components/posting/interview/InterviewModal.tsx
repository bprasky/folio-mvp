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
import { PromptPicker } from "./PromptPicker";
import { AnswerForm } from "./AnswerForm";
import { FollowUpsForm } from "./FollowUpsForm";
import { FooterBar } from "./FooterBar";
import { TagPreview } from "./TagPreview";
import { QuestionCard } from "./QuestionCard";
import { ProgressIndicator } from "./ProgressIndicator";
import { DEFAULT_QUESTION_BANK, type InterviewQuestion } from "@/lib/posting/questionBank";
import type {
  InterviewAnswer,
  SixWCategory,
} from "@/lib/posting/interviewSchemas";
import { useInterviewQuestions } from "@/hooks/useInterviewQuestions";
import { LinkedImagePreview } from "@/components/editorial/LinkedImagePreview";
import type { InterviewQuestion as ContextualQuestion } from "@/types/interview";

interface InterviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  images: Array<{ id: string; url: string; name?: string }>;
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
}

const SIX_W_SECTIONS = new Set(["why", "who", "what", "where", "when", "how"]);

type SaveResult = { ok: boolean; savedCount: number; totalCount: number };

// --- Editorial v1 hardening: helpers ---
type FollowupsApiResponse = {
  ok: boolean;
  followups: Array<{ id: string; text: string; source?: string; dedupeKey?: string; questionId: string }> | [];
  error?: 'llm_unavailable' | 'llm_error' | 'disabled' | string;
};

type SingleFollowUpApiResponse = {
  ok: boolean;
  followups: Array<{ id: string; text: string; source?: string; dedupeKey?: string; questionId: string }>;
  acknowledgment?: string;
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
  images,
  post,
  hasVendors = false,
  tags = [],
}: InterviewModalProps) {
  const router = useRouter();
  // Phase A: Sequential flow - new phase system
  const [phase, setPhase] = useState<"pick" | "question" | "followup" | "complete">("pick");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Keep step for backward compatibility during transition
  const [step, setStep] = useState<"pick" | "answer" | "followups">("pick");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [followUps, setFollowUps] = useState<
    Array<{ questionId: string; acknowledgment?: string; followUps: Array<{ id: string; prompt: string }> }>
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Phase A: Sequential flow
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [followupsTried, setFollowupsTried] = useState(false);
  const [cachedFollowups, setCachedFollowups] = useState<
    Array<{ questionId: string; acknowledgment?: string; followUps: Array<{ id: string; prompt: string }> }>
  >([]);

  const saveAbortRef = useRef<AbortController | null>(null);
  const bannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  }, [open, projectId, answers, followUps]);

  // Preload answers from server and localStorage on open
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

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
          
          // Contextual questions are now loaded via useInterviewQuestions hook
          // No need to load from this endpoint anymore
          
          const serverAnswers = normalizeIncomingAnswers(data?.answers || []);
          const serverFollowUps = Array.isArray(data?.followUps) ? data.followUps : [];
          
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

          console.log('[InterviewModal] Step decision:', {
            finalAnswersCount: finalAnswers.length,
            hasBaseAnswers,
            hasFollowUps,
            selectedQuestionIdsCount: allQuestionIds.length,
            serverAnswersCount: serverAnswers.length,
            currentStep: step,
          });

          // If no answers exist, always start from pick phase
          // This handles "Start Over" correctly - even if selectedQuestionIds exist,
          // we want to let user re-select questions
          if (!hasBaseAnswers && !hasFollowUps && !cancelled) {
            setStep("pick");
            setPhase("pick");
            // Clear any stale selectedQuestionIds to ensure fresh start
            if (serverAnswers.length === 0) {
              setSelectedQuestionIds([]);
            }
            console.log('[InterviewModal] Reset to pick phase - no answers found');
          } else if (hasBaseAnswers && !cancelled) {
            setStep("answer");
            setPhase("question");
            console.log('[InterviewModal] Resuming at answer phase');
          } else if (hasFollowUps && !cancelled) {
            setStep("followups");
            setPhase("followup");
            console.log('[InterviewModal] Resuming at followups phase');
          }
        } else {
          console.warn('[InterviewModal] Failed to fetch answers', res.status);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[InterviewModal] Failed to preload answers', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
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
            setBanner('AI editorial assistant is currently unavailable. You can continue and Folio will create a base editorial draft.');
          }
        })
        .finally(() => setIsChecking(false));
    }
  }, [open]);

  // Reset to pick phase when modal opens with no answers
  useEffect(() => {
    if (!open) return;
    
    // Give a small delay to let data load, then check if we should reset
    const timer = setTimeout(() => {
      const hasAnswers = answers.filter(a => !a.isFollowUp).length > 0;
      const hasFollowUps = answers.filter(a => a.isFollowUp).length > 0;
      
      if (!hasAnswers && !hasFollowUps) {
        console.log('[InterviewModal] Modal opened with no answers - resetting to pick');
        setStep("pick");
        setPhase("pick");
        setSelectedQuestionIds([]);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [open]); // Only depend on open, not answers (to avoid loops)

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

  // Fetch questions using the new hook
  const { questions: fetchedQuestions, loading: questionsLoading, context: questionsContext } = useInterviewQuestions(projectId);
  
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
  
  // Create a map of questionId to full question metadata for saving
  const questionMetadataMap = useMemo(() => {
    const map = new Map<string, ContextualQuestion>();
    fetchedQuestions.forEach(q => {
      map.set(q.id, q);
    });
    return map;
  }, [fetchedQuestions]);
  
  // Merge DEFAULT_QUESTION_BANK with contextual questions
  const allQuestions = useMemo(() => {
    return [...DEFAULT_QUESTION_BANK, ...contextualQuestions];
  }, [contextualQuestions]);
  
  // Phase A: Sequential flow helpers
  // Derive selected questions from merged question bank
  const selectedQuestions = useMemo(() => {
    return selectedQuestionIds
      .map((id) => allQuestions.find((q) => q.id === id))
      .filter((q): q is InterviewQuestion => q !== undefined);
  }, [selectedQuestionIds, allQuestions]);

  const currentQuestion = selectedQuestions[currentQuestionIndex];
  const totalQuestions = selectedQuestions.length;

  // Get current answer for the current question
  const currentAnswer = useMemo(() => {
    if (!currentQuestion) return "";
    const answer = baseAnswers.find((a) => a.questionId === currentQuestion.id);
    return answer?.answer || "";
  }, [currentQuestion, baseAnswers]);

  // Phase B: Generate follow-ups for a single question
  const generateSingleFollowUp = useCallback(async (questionId: string, answerText: string) => {
    setIsLoadingFollowUps(true);
    logClient('followups-single:request:begin', { projectId, questionId });

    try {
      const resp = await fetch(`/api/posting/project/${projectId}/interview/followups/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          answer: answerText,
        }),
      });

      logClient('followups-single:response:status', { status: resp.status });
      const data = await resp.json() as SingleFollowUpApiResponse;
      logClient('followups-single:response:body', { ok: data?.ok, error: data?.error, count: (data?.followups || []).length });

      if (!resp.ok || data?.ok === false) {
        console.warn('[followups-single] Failed to generate follow-ups:', data?.error);
        // Non-blocking: continue even if follow-ups fail
        return [];
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

      // Update followUps state with new follow-ups for this question
      setFollowUps((prev) => {
        const filtered = prev.filter((group) => group.questionId !== questionId);
        if (followUpsGroup.followUps.length > 0) {
          return [...filtered, followUpsGroup];
        }
        return filtered;
      });

      return followUpsGroup.followUps;
    } catch (error: any) {
      console.error('[followups-single] Error:', error);
      // Non-blocking: continue even if follow-ups fail
      return [];
    } finally {
      setIsLoadingFollowUps(false);
    }
  }, [projectId]);

  // Handle sequential question answer submission
  const handleQuestionAnswerSubmit = useCallback(async () => {
    if (!currentQuestion || !currentAnswer.trim()) {
      setFieldErrors({ [currentQuestion?.id || ""]: "Please provide an answer" });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      // Build answer in InterviewAnswer format
      const answerData: InterviewAnswer = {
        questionId: currentQuestion.id,
        role: currentQuestion.role === "ANY" ? "DESIGNER" : currentQuestion.role,
        section: currentQuestion.section,
        category: deriveCategory(currentQuestion.section),
        answer: currentAnswer.trim().slice(0, 2000),
        isFollowUp: false,
      };

      // Update answers state
      setAnswers((prev) => {
        const filtered = prev.filter((a) => a.questionId !== currentQuestion.id || a.isFollowUp);
        return [...filtered, answerData];
      });

      // Save answer
      await persistAnswers([answerData], { includeFollowUps: false });

      // Phase B: Generate follow-ups immediately after saving answer
      const generatedFollowUps = await generateSingleFollowUp(currentQuestion.id, answerData.answer);

      // Move to next question or complete
      if (currentQuestionIndex < totalQuestions - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        // All questions answered
        setPhase("complete");
        // Skip batch follow-up generation (already generated per-question)
        // Just allow user to generate editorial
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
  }, [currentQuestion, currentAnswer, currentQuestionIndex, totalQuestions, persistAnswers, generateSingleFollowUp, handleBanner]);

  // Handle answer change for current question
  const handleCurrentAnswerChange = useCallback(
    (value: string) => {
      if (!currentQuestion) return;

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
    [currentQuestion]
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
    options: { includeFollowUps?: boolean } = {}
  ): Promise<SaveResult | void> {
    const sanitized = answersToPersist
      .map((answer) => sanitizeAnswerForSend(answer))
      .filter(
        (value): value is ReturnType<typeof sanitizeAnswerForSend> =>
          value !== null
      );

    if (sanitized.length === 0 && !options.includeFollowUps) {
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
              return {
                questionId: item.questionId,
                role: item.role,
                section: item.section,
                category: item.category,
                answer: item.answer,
                isFollowUp: item.isFollowUp,
                // NEW FIELDS - include metadata if available
                linkedImageId: questionMeta?.linkedImageId || null,
                linkedProductId: questionMeta?.linkedProductId || null,
                questionSource: questionMeta?.source || (item.isFollowUp ? 'follow_up' : 'base_question'),
                aiClassificationAttribute: questionMeta?.attributeType && questionMeta?.attributeValue
                  ? `${questionMeta.attributeType}:${questionMeta.attributeValue}`
                  : null,
              };
            }),
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

  const lastClickRef = useRef<number>(0);
  const DEBOUNCE_MS = 1000;
  const canClickGenerate = useMemo(() => !isGenerating, [isGenerating]);

  const handleGenerate = useCallback(async () => {
    const now = Date.now();
    if (now - lastClickRef.current < DEBOUNCE_MS) return;
    lastClickRef.current = now;

    if (isGenerating) return;
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
      const needsSave = step === "answer" || step === "followups";
      
      if (needsSave) {
        try {
          // Save all answers including follow-ups in one call
          const allAnswersResult = await persistAnswers([...baseAnswers, ...followUpAnswersState], {
            includeFollowUps: true,
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

      let res = await fetch(
        `/api/posting/project/${projectId}/interview/generate?forceOverwriteDraft=true&mode=recomposition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceOverwriteDraft: true, mode: 'recomposition' }), // Always overwrite existing drafts
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
        const errorMessage = errData?.error || `Editorial generation failed (${res.status})`;
        logClient('generate:hard-fail', { status: res.status, code: errorCode, message: errorMessage });
        
        // Show user-friendly error message
        handleBanner(`Editorial generation failed: ${errorMessage}. The AI didn't return a valid magazine article. Nothing was saved. Error code: ${errorCode}. Try Regenerate.`);
        setIsGenerating(false);
        return;
      }

      // Handle 409 Conflict - legacy support, but should now be 202
      if (res.status === 409) {
        logClient('generate:conflict_retry');
        handleBanner("Regenerating draft with updated answers...");
        
        // Wait a bit longer to ensure database transaction has committed
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Retry with force=true to overwrite existing draft
        const retry = await fetch(
          `/api/posting/project/${projectId}/interview/generate?forceOverwriteDraft=true&mode=recomposition`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ forceOverwriteDraft: true, mode: 'recomposition' }),
          }
        );
        logClient('generate:conflict_retry:status', { status: retry.status });
        
        if (!retry.ok) {
          const errData = await retry.json().catch(() => ({}));
          const errorCode = errData?.code || 'COMPOSE_ERROR';
          const errorMessage = errData?.error || `Editorial generation failed (${retry.status})`;
          logClient('generate:conflict_retry:error', { code: errorCode, message: errorMessage });
          
          // Handle hard-fail errors (502, 400)
          if (retry.status >= 400) {
            handleBanner(`Editorial generation failed: ${errorMessage}. The AI didn't return a valid magazine article. Nothing was saved. Error code: ${errorCode}. Try Regenerate.`);
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
          setBanner('Generated a base editorial draft while AI was unavailable. You can refine this later.');
        }
        
        onOpenChange(false);
        router.push(`/designer/projects/${projectId}/preview`);
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
        setBanner('We couldn\'t create the editorial just now. Please try again.');
        return;
      }

      const data = await res.json();
      logClient('generate:response:body', { 
        ok: data.ok, 
        usedFallback: data?.metadata?.usedFallback, 
        followupsCount: data?.metadata?.followupsCount 
      });
      
      if (data?.metadata?.usedFallback) {
        setBanner('Generated a base editorial draft while AI was unavailable. You can refine this later.');
      }

      onOpenChange(false);
      router.push(`/designer/projects/${projectId}/preview`);
    } catch (err: any) {
      console.error("[InterviewModal] handleGenerate error:", err);
      if (err?.message !== "validation_failed") {
        setError(err?.message || "Failed to generate draft");
      }
    } finally {
      setIsGenerating(false);
    }
  }, [projectId, isGenerating, baseAnswers, followUpAnswersState, step, router, onOpenChange, handleBanner, persistAnswers]);

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
      setBanner('We couldn\'t reach the AI follow-ups service. You can retry or continue with a base editorial draft.');
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
        setBanner('AI follow-ups failed to generate. You can retry or continue with a base editorial draft.');
      } else {
        setBanner('AI follow-ups failed to generate. You can retry or continue with a base editorial draft.');
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
      setBanner('AI editorial assistant is temporarily unavailable. You can continue now; you\'ll still be able to refine later.');
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

  const canProceedFromPick = selectedQuestionIds.length >= 1;
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

  // Handle phase transition from pick to question
  const handleBeginInterview = useCallback(() => {
    if (selectedQuestionIds.length === 0) return;
    setPhase("question");
    setStep("answer"); // Keep step for backward compatibility
    setCurrentQuestionIndex(0);
  }, [selectedQuestionIds.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          phase === "question" || phase === "followup"
            ? "w-full max-w-5xl h-[90vh] max-h-[90vh] mx-auto my-auto rounded-3xl flex flex-col bg-white/90 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden"
            : "max-w-6xl max-h-[90vh] overflow-y-auto bg-white/90 backdrop-blur-xl border border-white/30 shadow-2xl rounded-3xl"
        }
      >
        {/* Loading state for questions */}
        {questionsLoading && phase === "pick" && (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin h-8 w-8 border-2 border-stone-900 border-t-transparent rounded-full" />
          </div>
        )}
        
        {/* Error state for questions */}
        {!questionsLoading && fetchedQuestions.length === 0 && phase === "pick" && (
          <div className="p-8 text-center">
            <p className="text-stone-600 mb-4">
              No questions available for this project. Please ensure your project has images with AI classifications.
            </p>
            <button onClick={() => onOpenChange(false)} className="text-stone-900 underline">
              Close
            </button>
          </div>
        )}
        {/* Modal header with close button and progress */}
        {(phase === "question" || phase === "followup") && (
          <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200/50 bg-white/50">
            <button 
              onClick={() => onOpenChange(false)}
              className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-full hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
            
            {phase === "question" && currentQuestion && (
              <span className="text-sm text-gray-500">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </span>
            )}
            
            <div className="w-6" /> {/* Spacer for alignment */}
          </div>
        )}

        {/* Phase A: Sequential flow - show progress indicator for question phase (if not in header) */}
        {phase === "question" && currentQuestion && (
          <div className="px-8 pt-6">
            <ProgressIndicator current={currentQuestionIndex + 1} total={totalQuestions} />
          </div>
        )}

        <DialogHeader className={phase === "question" || phase === "followup" ? "hidden" : ""}>
          <DialogTitle className="text-2xl font-serif">
            Project Interview
          </DialogTitle>
          {phase !== "question" && phase !== "followup" && (
            <p className="text-sm text-gray-600 mt-2">
              Answer a few questions to generate your editorial draft.
              {hasTaggedProducts && (
                <span className="block mt-1 text-xs">
                  Tagged products will be included automatically. Use these prompts
                  to explain intent, decisions, and collaboration.
                </span>
              )}
            </p>
          )}
        </DialogHeader>

        {/* Context level indicator - shows how personalized questions are */}
        {phase === "pick" && !questionsLoading && questionsContext.contextLevel > 0 && (
          <div className="mx-6 mb-4 p-4 bg-gradient-to-r from-stone-50 to-stone-100 border border-stone-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-stone-700">
              <svg className="w-4 h-4 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-medium">{questionsContext.contextDescription}</span>
            </div>
            {questionsContext.upgradeSuggestion && (
              <p className="mt-1 text-xs text-stone-500">
                {questionsContext.upgradeSuggestion}
              </p>
            )}
            <div className="mt-2 flex items-center gap-1">
              {[0, 1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={`h-1.5 flex-1 rounded-full ${
                    level <= questionsContext.contextLevel
                      ? 'bg-stone-600'
                      : 'bg-stone-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Show upgrade suggestion when context is low */}
        {phase === "pick" && !questionsLoading && questionsContext.contextLevel === 0 && (
          <div className="mx-6 mb-4 p-4 bg-stone-50 border border-stone-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Add project photos to unlock personalized questions</span>
            </div>
          </div>
        )}

        {banner && (
          <div className={`mx-8 mt-4 mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800 ${phase === "question" || phase === "followup" ? "" : ""}`}>
            {banner}
          </div>
        )}

        {llmAvailable === false && phase !== "question" && phase !== "followup" && (
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

        {/* Phase A: Sequential flow - question phase */}
        {phase === "question" && currentQuestion ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <QuestionCard
              question={currentQuestion}
              answer={currentAnswer}
              onAnswerChange={handleCurrentAnswerChange}
              onSubmit={handleQuestionAnswerSubmit}
              isSubmitting={isSubmitting || isLoadingFollowUps}
              fieldError={fieldErrors[currentQuestion.id]}
              projectId={projectId}
              questionMetadata={questionMetadataMap.get(currentQuestion.id)}
              images={images}
            />
          </div>
        ) : (
          /* Batch flow - pick and followups (backward compatibility) */
          <div className={`mt-6 md:flex md:items-start md:gap-6 ${phase === "question" || phase === "followup" ? "flex-1 min-h-0 px-6 pb-6" : ""}`}>
            <div className="flex-1 min-w-0">
              {phase === "pick" && step === "pick" && (
                <PromptPicker
                  selectedQuestionIds={selectedQuestionIds}
                  onSelectionChange={setSelectedQuestionIds}
                  roleFilter={hasVendors ? "ANY" : "DESIGNER"}
                  hasTaggedProducts={hasTaggedProducts}
                  contextualQuestions={contextualQuestions}
                />
              )}

              {phase !== "question" && step === "answer" && (
                <AnswerForm
                  selectedQuestionIds={selectedQuestionIds}
                  answers={baseAnswers}
                  onAnswersChange={handleBaseAnswersChange}
                  roleFilter={hasVendors ? "ANY" : "DESIGNER"}
                  onSave={persistBaseAnswers}
                  contextualQuestions={contextualQuestions}
                  fieldErrors={fieldErrors}
                />
              )}

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
            {phase === "pick" && step === "pick" && <TagPreview materials={materials} />}
          </div>
        )}

        <FooterBar
          phase={phase}
          onBack={
            phase === "question"
              ? () => {
                  if (currentQuestionIndex > 0) {
                    setCurrentQuestionIndex((prev) => prev - 1);
                  } else {
                    setPhase("pick");
                    setStep("pick");
                  }
                }
              : step === "answer"
              ? () => setStep("pick")
              : step === "followups"
              ? () => setStep("answer")
              : undefined
          }
          onNext={handleBeginInterview}
          onSubmit={phase === "question" ? handleQuestionAnswerSubmit : undefined}
          onGenerate={phase === "complete" || step === "followups" ? handleGenerate : undefined}
          onSkip={
            phase === "followup"
              ? handleGenerate
              : step === "followups"
              ? handleGenerate
              : (banner && followupsTried && step === "answer")
              ? handleGenerate
              : undefined
          }
          canProceed={
            phase === "pick"
              ? canProceedFromPick
              : phase === "question"
              ? canProceedFromQuestion
              : step === "answer"
              ? canProceedFromAnswer
              : true
          }
          isSubmitting={isSubmitting}
          isGenerating={isGenerating}
          isLoadingFollowUps={isLoadingFollowUps}
        />
      </DialogContent>
    </Dialog>
  );
}

function getValidationStorageKey(projectId: string) {
  return `folio.interview.validation.${projectId}`;
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

