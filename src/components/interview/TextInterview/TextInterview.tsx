"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { QuestionCard } from "./QuestionCard";
import { FollowUpTransition } from "./FollowUpTransition";
import { EditorialPreview } from "../shared/EditorialPreview";
import type {
  InterviewQuestion,
  InterviewResponse,
  DraftPreview,
} from "../types";

interface TextInterviewProps {
  sessionId: string;
  questions: InterviewQuestion[];
  projectContext: {
    title: string;
    imageCount: number;
    heroImageUrl: string | null;
  };
  images?: Array<{ id: string; url: string; name?: string }>;
  onSubmitResponse: (
    questionId: string,
    answer: string
  ) => Promise<{
    followUpQuestion: InterviewQuestion | null;
    shouldShowPreview: boolean;
    previewDraft: DraftPreview | null;
  }>;
  onComplete: (responses: InterviewResponse[]) => void;
  onSwitchToVoice: () => void;
  voiceAvailable?: boolean;
  /** Starting question index when resuming from a draft */
  startingQuestionIndex?: number;
  /** Previously recorded responses when resuming from a draft */
  previousResponses?: InterviewResponse[];
}

type TextInterviewState = "question" | "transition" | "preview-interstitial";

const questionTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3, ease: "easeInOut" },
};

/**
 * TextInterview
 *
 * Container for text interview mode.
 * Manages question flow, follow-up generation, and preview display.
 */
export function TextInterview({
  sessionId,
  questions: initialQuestions,
  projectContext,
  images = [],
  onSubmitResponse,
  onComplete,
  onSwitchToVoice,
  voiceAvailable = false,
  startingQuestionIndex = 0,
  previousResponses = [],
}: TextInterviewProps) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>(initialQuestions);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(startingQuestionIndex);
  const [responses, setResponses] = useState<InterviewResponse[]>(previousResponses);
  const [state, setState] = useState<TextInterviewState>("question");
  const [isLoading, setIsLoading] = useState(false);
  const [lastAnswer, setLastAnswer] = useState("");
  const [previewDraft, setPreviewDraft] = useState<DraftPreview | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  const handleSubmit = useCallback(
    async (answer: string) => {
      if (!currentQuestion || isLoading) return;

      setIsLoading(true);
      setLastAnswer(answer);
      setState("transition");

      // Record the response
      const response: InterviewResponse = {
        questionId: currentQuestion.id,
        questionText: currentQuestion.text,
        answer,
        timestamp: new Date(),
        inputMode: "text",
      };
      setResponses((prev) => [...prev, response]);

      try {
        // Submit to API and get follow-up
        const result = await onSubmitResponse(currentQuestion.id, answer);

        // Handle preview
        if (result.shouldShowPreview && result.previewDraft) {
          setPreviewDraft(result.previewDraft);
        }

        // Handle follow-up or completion
        if (result.followUpQuestion) {
          // Add follow-up to questions and advance
          setQuestions((prev) => {
            const newQuestions = [...prev];
            // Insert after current question
            newQuestions.splice(currentQuestionIndex + 1, 0, result.followUpQuestion!);
            return newQuestions;
          });
          setCurrentQuestionIndex((prev) => prev + 1);
          setState("question");
        } else if (currentQuestionIndex < questions.length - 1) {
          // Move to next existing question
          setCurrentQuestionIndex((prev) => prev + 1);
          setState("question");
        } else {
          // Interview complete
          onComplete([...responses, response]);
        }
      } catch (error) {
        console.error("[TextInterview] Error submitting response:", error);
        // Graceful degradation - move to next question
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex((prev) => prev + 1);
        } else {
          onComplete([...responses, response]);
        }
        setState("question");
      } finally {
        setIsLoading(false);
      }
    },
    [currentQuestion, currentQuestionIndex, questions.length, isLoading, onSubmitResponse, onComplete, responses]
  );

  const handleSkip = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Interview complete even with skips
      onComplete(responses);
    }
  }, [currentQuestionIndex, questions.length, onComplete, responses]);

  const handleGoBack = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      setState("question");
    }
  }, [currentQuestionIndex]);

  // Find the previous answer for the current question (if going back to revise)
  const previousAnswerForCurrent = responses.find(
    (r) => r.questionId === currentQuestion?.id
  )?.answer;

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="relative h-full">
      <AnimatePresence mode="wait">
        {state === "transition" ? (
          <motion.div
            key="transition"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <FollowUpTransition
              previousAnswer={lastAnswer}
              isGenerating={isLoading}
            />
          </motion.div>
        ) : (
          <motion.div
            key={currentQuestion.id}
            {...questionTransition}
            className="h-full"
          >
            {/* Show preview inline after 3-4 responses */}
            {previewDraft && responses.length >= 3 && (
              <div className="absolute top-4 right-4 w-80 hidden lg:block">
                <EditorialPreview
                  title={previewDraft.title}
                  excerpt={previewDraft.excerpt}
                  heroImage={projectContext.heroImageUrl || undefined}
                />
              </div>
            )}

            <QuestionCard
              question={currentQuestion}
              questionNumber={currentQuestionIndex + 1}
              totalQuestions={totalQuestions}
              onSubmit={handleSubmit}
              onSkip={handleSkip}
              onGoBack={currentQuestionIndex > 0 ? handleGoBack : undefined}
              onSwitchToVoice={onSwitchToVoice}
              isLoading={isLoading}
              images={images}
              voiceAvailable={voiceAvailable}
              previousAnswer={previousAnswerForCurrent}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
