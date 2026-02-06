"use client";

import { useState, useCallback, useRef } from "react";
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
  switchMode: (newMode: "voice" | "text") => void;
  endInterview: () => Promise<string | null>; // Returns draft ID
  resetSession: () => void;

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
        const res = await fetch("/api/interview/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            projectId,
            questionId,
            questionText: currentQ?.text,
            answer,
            inputMode: mode,
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to submit response: ${res.status}`);
        }

        const data: RespondResponse = await res.json();

        // Store the response
        const currentQuestion = questions[currentQuestionIndex];
        if (currentQuestion) {
          setResponses((prev) => [
            ...prev,
            {
              questionId,
              questionText: currentQuestion.text,
              answer,
              timestamp: new Date(),
              inputMode: mode as "voice" | "text",
            },
          ]);
        }

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
  }, [sessionId, projectId, responses, onComplete, onError]);

  /**
   * Reset the session to initial state
   */
  const resetSession = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
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
  }, []);

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
    switchMode,
    endInterview,
    resetSession,

    // Computed
    progress,
    shouldShowPreview,
    previewDraft,
  };
}
