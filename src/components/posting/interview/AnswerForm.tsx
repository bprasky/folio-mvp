"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { DEFAULT_QUESTION_BANK, type InterviewQuestion } from "@/lib/posting/questionBank";
import type {
  InterviewAnswer,
  SixWCategory,
} from "@/lib/posting/interviewSchemas";

interface AnswerFormProps {
  selectedQuestionIds: string[];
  answers: InterviewAnswer[];
  onAnswersChange: (answers: InterviewAnswer[]) => void;
  roleFilter?: "DESIGNER" | "VENDOR" | "ANY";
  onSave?: (answers: InterviewAnswer[]) => Promise<void | unknown>;
  fieldErrors?: Record<string, string>;
  contextualQuestions?: InterviewQuestion[]; // AI-generated contextual questions
}

const SIX_W_SECTIONS = new Set(["why", "who", "what", "where", "when", "how"]);

export function AnswerForm({
  selectedQuestionIds,
  answers,
  onAnswersChange,
  roleFilter: _roleFilter = "DESIGNER",
  onSave,
  fieldErrors = {},
  contextualQuestions = [],
}: AnswerFormProps) {
  // Merge DEFAULT_QUESTION_BANK with contextual questions
  const allQuestions = useMemo(() => {
    return [...DEFAULT_QUESTION_BANK, ...contextualQuestions];
  }, [contextualQuestions]);
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize local answers from incoming data
  // Use a ref to track if we're updating from external source vs internal change
  const isInternalUpdateRef = useRef(false);
  const prevAnswersRef = useRef<InterviewAnswer[]>([]);
  const isInitializedRef = useRef(false);
  
  useEffect(() => {
    // On first mount or when answers change externally, populate localAnswers
    const answersChanged = JSON.stringify(answers) !== JSON.stringify(prevAnswersRef.current);
    const shouldInitialize = !isInitializedRef.current || (answersChanged && !isInternalUpdateRef.current);
    
    console.log('[AnswerForm] Answers effect:', {
      answersCount: answers.length,
      answersChanged,
      isInitialized: isInitializedRef.current,
      isInternalUpdate: isInternalUpdateRef.current,
      shouldInitialize,
      questionIds: answers.map(a => a.questionId).slice(0, 5),
      selectedQuestionIds: selectedQuestionIds.slice(0, 5),
      currentLocalAnswersKeys: Object.keys(localAnswers).length,
    });
    
    if (shouldInitialize && answers.length > 0) {
      const initial: Record<string, string> = {};
      // Include ALL answers, not just selected ones
      // This preserves answers that were loaded but might not be in selectedQuestionIds
      answers.forEach((answer) => {
        if (answer.answer && answer.answer.trim()) {
          initial[answer.questionId] = answer.answer;
        }
      });
      console.log('[AnswerForm] Setting localAnswers:', {
        keys: Object.keys(initial).length,
        answersLength: answers.length,
        selectedQuestionIdsLength: selectedQuestionIds.length,
        sampleKeys: Object.keys(initial).slice(0, 5),
      });
      setLocalAnswers(initial);
      isInitializedRef.current = true;
    } else if (answers.length > 0 && Object.keys(localAnswers).length === 0) {
      // Fallback: if we have answers but localAnswers is still empty, populate it
      console.log('[AnswerForm] Fallback: populating localAnswers from answers');
      const initial: Record<string, string> = {};
      answers.forEach((answer) => {
        if (answer.answer && answer.answer.trim()) {
          initial[answer.questionId] = answer.answer;
        }
      });
      setLocalAnswers(initial);
      isInitializedRef.current = true;
    }
    
    prevAnswersRef.current = answers;
    isInternalUpdateRef.current = false;
  }, [answers, selectedQuestionIds]);

  // Debounced autosave (trailing) - increased delay to prevent interference with typing
  useEffect(() => {
    if (!onSave) return;

    // Don't autosave if localAnswers is empty and we have incoming answers
    // This prevents clearing answers on initial load
    const hasLocalData = Object.keys(localAnswers).length > 0;
    const hasIncomingAnswers = answers.length > 0;
    
    if (!hasLocalData && hasIncomingAnswers) {
      console.log('[AnswerForm] Skipping autosave - localAnswers not initialized yet');
      return;
    }

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timeout with longer delay to avoid interrupting typing
    // Only save after user has stopped typing for 2 seconds
    debounceRef.current = setTimeout(async () => {
      // Build answers from localAnswers, but include ALL answers that have values
      // not just the selectedQuestionIds, to preserve loaded answers
      const allQuestionIds = new Set([
        ...selectedQuestionIds,
        ...Object.keys(localAnswers).filter(k => localAnswers[k]?.trim()),
      ]);
      
      const currentAnswers = Array.from(allQuestionIds)
        .map((questionId) => {
          const question = allQuestions.find((item) => item.id === questionId);
          if (!question) {
            // If not in question bank, try to find it in existing answers to preserve it
            const existingAnswer = answers.find(a => a.questionId === questionId);
            if (existingAnswer && localAnswers[questionId]?.trim()) {
              return {
                ...existingAnswer,
                answer: localAnswers[questionId].trim().slice(0, 2000),
              };
            }
            return null;
          }

          const raw = localAnswers[questionId] ?? "";
          const trimmed = raw.trim();
          if (!trimmed) return null;

          const maxLen = Math.min(question.maxLen ?? 2000, 2000);
          const section = question.section;
          const category = deriveCategory(section);

          return {
            questionId,
            role: question.role,
            section,
            category,
            answer: trimmed.slice(0, maxLen),
          } as InterviewAnswer;
        })
        .filter((value): value is InterviewAnswer => value !== null);

      console.log('[AnswerForm] Autosave building answers:', {
        allQuestionIdsCount: allQuestionIds.size,
        currentAnswersCount: currentAnswers.length,
        localAnswersKeys: Object.keys(localAnswers).length,
      });

      // Don't update parent if we're building fewer answers than we received
      // This prevents losing answers that were loaded but aren't in selectedQuestionIds
      if (currentAnswers.length < answers.length) {
        // Check if we're actually losing data or just filtering
        const currentQuestionIds = new Set(currentAnswers.map(a => a.questionId));
        const originalQuestionIds = new Set(answers.map(a => a.questionId));
        const wouldLoseData = Array.from(originalQuestionIds).some(id => !currentQuestionIds.has(id));
        
        if (wouldLoseData && Object.keys(localAnswers).length < answers.length) {
          console.log('[AnswerForm] Skipping autosave - would lose loaded answers', {
            currentCount: currentAnswers.length,
            originalCount: answers.length,
            localAnswersKeys: Object.keys(localAnswers).length,
          });
          return;
        }
      }

      // Don't trigger autosave if answers haven't actually changed
      // Compare by questionId + answer content, not just array length
      const currentAnswersMap = new Map(currentAnswers.map(a => [a.questionId, a.answer]));
      const originalAnswersMap = new Map(answers.map(a => [a.questionId, a.answer]));
      let hasRealChanges = false;
      
      // Check if any answer content changed
      for (const [qId, answer] of currentAnswersMap) {
        if (originalAnswersMap.get(qId) !== answer) {
          hasRealChanges = true;
          break;
        }
      }
      
      // Check if any original answers were removed
      if (!hasRealChanges) {
        for (const [qId] of originalAnswersMap) {
          if (!currentAnswersMap.has(qId)) {
            hasRealChanges = true;
            break;
          }
        }
      }
      
      if (!hasRealChanges) {
        console.log('[AnswerForm] Skipping autosave - no changes detected');
        return;
      }

      // Update parent component with current answers (for state sync)
      // This happens after debounce, so trimming won't interfere with typing
      isInternalUpdateRef.current = true;
      onAnswersChange(currentAnswers);

      if (!onSave) return;
      setIsSaving(true);
      try {
        await onSave(currentAnswers);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[AnswerForm] autosave failed", error);
        }
      } finally {
        setIsSaving(false);
      }
    }, 2000); // Increased from 700ms to 2000ms (2 seconds) to reduce interference with typing

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [localAnswers, onSave, selectedQuestionIds, answers.length]);

  function handleAnswerChange(questionId: string, value: string) {
    setLocalAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      // Don't call onAnswersChange immediately - let the debounced autosave handle it
      // This prevents immediate trimming from interfering with typing
      // The parent will get updated via the autosave callback
      return next;
    });
  }

  // Show all questions that either:
  // 1. Are in selectedQuestionIds, OR
  // 2. Have answers in localAnswers (preserve loaded answers)
  const allRelevantQuestionIds = new Set([
    ...selectedQuestionIds,
    ...Object.keys(localAnswers).filter(k => localAnswers[k]?.trim()),
    ...answers.map(a => a.questionId),
  ]);
  
  const questions = allQuestions.filter((question) =>
    allRelevantQuestionIds.has(question.id)
  );

  const sectionLabels: Record<string, string> = {
    designIntent: "Design Intent",
    materialsMethod: "Materials & Method",
    collaboration: "Collaboration",
    emotionalCore: "Emotional Core",
    insightsReflection: "Insights & Reflection",
    lightningRound: "Lightning Round",
    why: "WHY – Intent",
    who: "WHO – People",
    what: "WHAT – Decisions",
    where: "WHERE – Context",
    when: "WHEN – Timing",
    how: "HOW – Method",
  };

  const questionsBySection: Record<string, typeof questions> = {};
  questions.forEach((question) => {
    if (!questionsBySection[question.section]) {
      questionsBySection[question.section] = [];
    }
    questionsBySection[question.section].push(question);
  });

  return (
    <div className="space-y-8">
      {isSaving && (
        <div className="text-xs text-[var(--text-secondary)] italic">Saving…</div>
      )}

      {Object.entries(questionsBySection).map(([section, sectionQuestions]) => (
        <div key={section} className="space-y-6">
          <h3 className="text-lg font-serif text-[var(--text-primary)]">
            {sectionLabels[section] ?? section}
          </h3>
          {sectionQuestions.map((question) => {
            const maxLen = Math.min(question.maxLen ?? 2000, 2000);
            const currentAnswer = localAnswers[question.id] ?? "";
            const charCount = currentAnswer.length;
            const errorMessage = fieldErrors[question.id];

            return (
              <div key={question.id} className="space-y-2">
                <label className="block text-sm font-medium text-[var(--text-primary)]">
                  {question.prompt}
                </label>
                {question.helper && (
                  <p className="text-xs text-[var(--text-secondary)] mb-2">{question.helper}</p>
                )}
                <textarea
                  value={currentAnswer}
                  onChange={(event) =>
                    handleAnswerChange(question.id, event.target.value)
                  }
                  maxLength={maxLen}
                  rows={Math.min(Math.max(Math.ceil(maxLen / 400), 4), 10)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] text-sm leading-relaxed ${
                    errorMessage ? "border-red-400 focus:border-red-500" : ""
                  }`}
                  style={{ maxWidth: "72ch" }}
                  placeholder="Type your answer here…"
                />
                <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                  <span>
                    {charCount} / {maxLen} characters
                  </span>
                  {charCount > maxLen * 0.9 && (
                    <span className="text-yellow-600">Approaching limit</span>
                  )}
                </div>
                {errorMessage && (
                  <p className="text-xs text-red-600">{errorMessage}</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function buildAnswersFromMap(
  selectedIds: string[],
  source: Record<string, string>
): InterviewAnswer[] {
  return selectedIds
    .map((questionId) => {
      const question = allQuestions.find(
        (item) => item.id === questionId
      );
      if (!question) return null;

      const raw = source[questionId] ?? "";
      const trimmed = raw.trim();
      if (!trimmed) return null;

      const maxLen = Math.min(question.maxLen ?? 2000, 2000);
      const section = question.section;
      const category = deriveCategory(section);

      return {
        questionId,
        role: question.role,
        section,
        category,
        answer: trimmed.slice(0, maxLen),
      } as InterviewAnswer;
    })
    .filter((value): value is InterviewAnswer => value !== null);
}

function deriveCategory(section?: string): SixWCategory | undefined {
  if (!section) return undefined;
  if (!SIX_W_SECTIONS.has(section)) return undefined;
  return section.toUpperCase() as SixWCategory;
}

