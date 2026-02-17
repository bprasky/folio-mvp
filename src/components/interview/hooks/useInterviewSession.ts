"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  InterviewState,
  InterviewStep,
  InterviewMode,
  InterviewQuestion,
  InterviewResponse,
  DraftPreview,
  ProjectContext,
  StartSessionResponse,
  RespondResponse,
  GenerateDraftResponse,
} from "../types";

interface UseInterviewSessionOptions {
  projectId: string;
  onComplete?: (draftId: string) => void;
  onError?: (error: Error) => void;
}

interface UseInterviewSessionReturn {
  // State
  session: {
    id: string | null;
    step: InterviewStep;
    mode: InterviewMode;
  };
  currentQuestion: InterviewQuestion | null;
  responses: InterviewResponse[];
  questions: InterviewQuestion[];
  projectContext: ProjectContext | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  startSession: (mode: "voice" | "text") => Promise<void>;
  submitResponse: (
    questionId: string,
    answer: string
  ) => Promise<RespondResponse>;
  skipQuestion: () => void;
  goBack: () => void;
  switchMode: (newMode: "voice" | "text") => void;
  endInterview: () => Promise<string | null>; // Returns draft ID
  resetSession: () => void;
  hasDraft: () => boolean;
  restoreDraft: () => boolean;
  clearDraft: () => void;

  // Computed
  progress: { current: number; total: number };
  shouldShowPreview: boolean;
  previewDraft: DraftPreview | null;
}

/**
 * useInterviewSession
 *
 * Main state management hook for the interview flow.
 * Handles session lifecycle, question navigation, and response submission.
 */
export function useInterviewSession({
  projectId,
  onComplete,
  onError,
}: UseInterviewSessionOptions): UseInterviewSessionReturn {
  // Core state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<InterviewStep>("mode-selection");
  const [mode, setMode] = useState<InterviewMode>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<InterviewResponse[]>([]);
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null);
  const [previewDraft, setPreviewDraft] = useState<DraftPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if preview should be shown
  const shouldShowPreview = responses.length >= 3 && previewDraft !== null;

  // Abort controller for cleanup
  const abortRef = useRef<AbortController | null>(null);

  // Draft key for localStorage
  const draftKeyRef = useRef(`interviewDraft:v2:${projectId}`);

  /**
   * Check if there's a saved draft for this project
   */
  const hasDraft = useCallback((): boolean => {
    try {
      const saved = localStorage.getItem(draftKeyRef.current);
      if (!saved) return false;
      const draft = JSON.parse(saved);
      return !!(draft.sessionId && draft.responses?.length > 0);
    } catch {
      return false;
    }
  }, []);

  /**
   * Restore a saved draft (returns true if restored)
   */
  const restoreDraft = useCallback((): boolean => {
    try {
      const saved = localStorage.getItem(draftKeyRef.current);
      if (!saved) return false;
      const draft = JSON.parse(saved);
      if (!draft.sessionId || !draft.responses?.length) return false;

      setSessionId(draft.sessionId);
      setQuestions(draft.questions || []);
      setResponses(draft.responses || []);
      setCurrentQuestionIndex(draft.currentQuestionIndex || 0);
      setMode(draft.mode || "text");
      setStep(draft.step || "text-interview");
      setProjectContext(draft.projectContext || null);
      console.log('[useInterviewSession] Restored draft:', {
        responses: draft.responses.length,
        questionIndex: draft.currentQuestionIndex,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * Clear saved draft
   */
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKeyRef.current);
    } catch { /* noop */ }
  }, []);

  /**
   * Start a new interview session
   */
  const startSession = useCallback(
    async (selectedMode: "voice" | "text") => {
      setIsLoading(true);
      setError(null);

      // Cancel any pending requests
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/interview/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, mode: selectedMode }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to start session: ${res.status}`);
        }

        const data: StartSessionResponse = await res.json();

        setSessionId(data.sessionId);
        setQuestions(data.initialQuestions);
        setProjectContext(data.projectContext);
        setMode(selectedMode);
        setStep(selectedMode === "voice" ? "voice-interview" : "text-interview");
        setCurrentQuestionIndex(0);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Ignore abort errors
        }
        const errorMessage = err instanceof Error ? err.message : "Failed to start session";
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, onError]
  );

  /**
   * Submit a response and get follow-up question
   */
  const submitResponse = useCallback(
    async (questionId: string, answer: string): Promise<RespondResponse> => {
      if (!sessionId) {
        throw new Error("No active session");
      }

      setIsLoading(true);
      setError(null);

      try {
        const currentQ = questions[currentQuestionIndex];
        const questionText = currentQ?.text || "Interview question";

        const res = await fetch("/api/interview/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            projectId,
            questionId,
            questionText,
            answer,
            inputMode: mode || "text",
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to submit response: ${res.status}`);
        }

        const data: RespondResponse = await res.json();

        // Always store the response in state — don't guard on currentQuestion
        setResponses((prev) => [
          ...prev,
          {
            questionId,
            questionText,
            answer,
            timestamp: new Date(),
            inputMode: (mode || "text") as "voice" | "text",
          },
        ]);

        // Update preview if available
        if (data.shouldShowPreview && data.previewDraft) {
          setPreviewDraft(data.previewDraft);
        }

        // Handle follow-up question
        if (data.followUpQuestion) {
          setQuestions((prev) => {
            const updated = [...prev];
            updated.splice(currentQuestionIndex + 1, 0, data.followUpQuestion!);
            return updated;
          });
          setCurrentQuestionIndex((prev) => prev + 1);
        } else if (currentQuestionIndex < questions.length - 1) {
          // Move to next question
          setCurrentQuestionIndex((prev) => prev + 1);
        }

        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to submit response";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, projectId, mode, questions, currentQuestionIndex]
  );

  /**
   * Skip the current question
   */
  const skipQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [currentQuestionIndex, questions.length]);

  /**
   * Go back to the previous question
   */
  const goBack = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  }, [currentQuestionIndex]);

  // Draft persistence — save progress to localStorage
  useEffect(() => {
    if (!sessionId || responses.length === 0) return;

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKeyRef.current, JSON.stringify({
          sessionId,
          questions,
          responses,
          currentQuestionIndex,
          step,
          mode,
          projectContext,
        }));
      } catch { /* localStorage full or unavailable */ }
    }, 500);

    return () => clearTimeout(timer);
  }, [sessionId, questions, responses, currentQuestionIndex, step, mode, projectContext]);

  /**
   * Switch between voice and text mode
   */
  const switchMode = useCallback((newMode: "voice" | "text") => {
    setMode(newMode);
    setStep(newMode === "voice" ? "voice-interview" : "text-interview");
  }, []);

  /**
   * End the interview and generate the draft
   */
  const endInterview = useCallback(async (): Promise<string | null> => {
    if (!sessionId) {
      return null;
    }

    setIsLoading(true);
    setStep("generating");
    setError(null);

    try {
      const res = await fetch("/api/interview/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          projectId,
          responses: responses.map((r) => ({
            questionId: r.questionId,
            questionText: r.questionText,
            answer: r.answer,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate draft: ${res.status}`);
      }

      const data: GenerateDraftResponse = await res.json();
      clearDraft(); // Interview complete — remove draft
      onComplete?.(data.draftId);
      return data.draftId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate draft";
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, projectId, responses, onComplete, onError, clearDraft]);

  /**
   * Reset the session to initial state
   */
  const resetSession = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    clearDraft();
    setSessionId(null);
    setStep("mode-selection");
    setMode(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setResponses([]);
    setProjectContext(null);
    setPreviewDraft(null);
    setIsLoading(false);
    setError(null);
  }, [clearDraft]);

  // Current question
  const currentQuestion = questions[currentQuestionIndex] ?? null;

  // Progress calculation
  const progress = {
    current: currentQuestionIndex + 1,
    total: questions.length,
  };

  return {
    // State
    session: {
      id: sessionId,
      step,
      mode,
    },
    currentQuestion,
    responses,
    questions,
    projectContext,
    isLoading,
    error,

    // Actions
    startSession,
    submitResponse,
    skipQuestion,
    goBack,
    switchMode,
    endInterview,
    resetSession,
    hasDraft,
    restoreDraft,
    clearDraft,

    // Computed
    progress,
    shouldShowPreview,
    previewDraft,
  };
}
