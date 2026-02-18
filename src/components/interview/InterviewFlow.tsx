"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { ModeSelection } from "./ModeSelection";
import { TextInterview } from "./TextInterview/TextInterview";
import { useInterviewSession } from "./hooks/useInterviewSession";
import { flags, realtimeInterviewConfig } from "@/lib/flags";
import type {
  InterviewStep,
  InterviewQuestion,
  InterviewResponse,
  DraftPreview,
} from "./types";

interface InterviewFlowProps {
  projectId: string;
  projectName?: string;
  images?: Array<{ id: string; url: string; name?: string }>;
  onComplete: (draftId: string) => void;
  onCancel: () => void;
  initialMode?: "voice" | "text"; // Skip mode selection if set
}

const modeToInterviewTransition = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.4, ease: "easeOut" },
};

/**
 * InterviewFlow
 *
 * Main container that manages the interview state machine.
 * Renders the appropriate sub-component based on current step.
 *
 * State Machine:
 * mode-selection → voice-interview ↔ text-interview → preview → generating → complete
 *                        ↓                 ↓
 *                   (can switch)      (can switch)
 */
export function InterviewFlow({
  projectId,
  projectName = "your project",
  images = [],
  onComplete,
  onCancel,
  initialMode,
}: InterviewFlowProps) {
  const {
    session,
    currentQuestion,
    responses,
    questions,
    projectContext,
    isLoading,
    error,
    startSession,
    submitResponse,
    skipQuestion,
    switchMode,
    endInterview,
    resetSession,
    hasDraft,
    restoreDraft,
    clearDraft,
    progress,
    currentQuestionIndex,
    shouldShowPreview,
    previewDraft,
  } = useInterviewSession({
    projectId,
    onComplete,
    onError: (err) => console.error("[InterviewFlow] Error:", err),
  });

  const [showDraftResume, setShowDraftResume] = useState(false);
  const [draftChecked, setDraftChecked] = useState(false);

  // Check for existing draft on mount
  useEffect(() => {
    if (!draftChecked && session.step === "mode-selection") {
      setDraftChecked(true);
      if (hasDraft()) {
        setShowDraftResume(true);
      }
    }
  }, [draftChecked, session.step, hasDraft]);

  // If initialMode is set and no draft prompt, start session immediately
  useEffect(() => {
    if (initialMode && session.step === "mode-selection" && !showDraftResume) {
      startSession(initialMode);
    }
  }, [initialMode, session.step, startSession, showDraftResume]);

  // Voice availability: check feature flags
  const [voiceAvailable] = useState(
    () => flags.realtimeInterview && realtimeInterviewConfig.enabled
  );

  const handleSelectVoice = useCallback(() => {
    startSession("voice");
  }, [startSession]);

  const handleSelectText = useCallback(() => {
    startSession("text");
  }, [startSession]);

  const handleSubmitResponse = useCallback(
    async (questionId: string, answer: string) => {
      return submitResponse(questionId, answer);
    },
    [submitResponse]
  );

  const handleComplete = useCallback(
    async (finalResponses: InterviewResponse[]) => {
      const draftId = await endInterview();
      if (draftId) {
        onComplete(draftId);
      }
    },
    [endInterview, onComplete]
  );

  const handleSwitchToVoice = useCallback(() => {
    switchMode("voice");
  }, [switchMode]);

  const handleSwitchToText = useCallback(() => {
    switchMode("text");
  }, [switchMode]);

  // Render content based on step
  const renderContent = () => {
    // Show draft resume prompt before anything else
    if (showDraftResume) {
      return (
        <motion.div {...modeToInterviewTransition} className="h-full flex items-center justify-center">
          <div className="max-w-md text-center space-y-6 px-8">
            <h3 className="text-xl font-serif text-[var(--text-primary)]">
              Welcome back
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              You have an interview in progress. Would you like to pick up where you left off?
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => {
                  restoreDraft();
                  setShowDraftResume(false);
                }}
                className="px-6 py-3 text-sm font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
              >
                Continue where I left off
              </button>
              <button
                onClick={() => {
                  clearDraft();
                  setShowDraftResume(false);
                  // If initialMode was set, startSession will fire via useEffect
                }}
                className="px-6 py-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Start over
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    switch (session.step) {
      case "mode-selection":
        return (
          <motion.div {...modeToInterviewTransition} className="h-full">
            <ModeSelection
              onSelectVoice={handleSelectVoice}
              onSelectText={handleSelectText}
              voiceAvailable={voiceAvailable}
              projectTitle={projectContext?.title || projectName}
              imageCount={projectContext?.imageCount || images.length}
            />
          </motion.div>
        );

      case "text-interview":
        return (
          <motion.div {...modeToInterviewTransition} className="h-full">
            <TextInterview
              sessionId={session.id!}
              questions={questions}
              projectContext={
                projectContext || {
                  title: projectName,
                  imageCount: images.length,
                  heroImageUrl: images[0]?.url || null,
                }
              }
              images={images}
              onSubmitResponse={handleSubmitResponse}
              onComplete={handleComplete}
              onSwitchToVoice={handleSwitchToVoice}
              voiceAvailable={voiceAvailable}
              startingQuestionIndex={currentQuestionIndex}
              previousResponses={responses}
            />
          </motion.div>
        );

      case "voice-interview":
        // Placeholder for Phase 2
        return (
          <motion.div
            {...modeToInterviewTransition}
            className="h-full flex items-center justify-center"
          >
            <div className="text-center">
              <p className="text-[var(--text-secondary)] mb-4">
                Voice interview coming soon.
              </p>
              <button
                onClick={handleSwitchToText}
                className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                Use text interview instead
              </button>
            </div>
          </motion.div>
        );

      case "generating":
        return (
          <motion.div
            {...modeToInterviewTransition}
            className="h-full flex items-center justify-center"
          >
            <div className="text-center space-y-4">
              <Loader2 className="w-8 h-8 text-[var(--text-tertiary)] animate-spin mx-auto" />
              <p className="text-[var(--text-secondary)]">Creating your editorial draft...</p>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative h-full min-h-[600px] bg-white">
      {/* Close button */}
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-4 right-4 z-10 p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        aria-label="Close interview"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Error state */}
      {error && (
        <div className="absolute top-4 left-4 right-16 z-10">
          <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {/* Loading overlay for initial session start */}
      {isLoading && session.step === "mode-selection" && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20">
          <Loader2 className="w-6 h-6 text-[var(--text-tertiary)] animate-spin" />
        </div>
      )}

      {/* Main content */}
      <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
    </div>
  );
}
