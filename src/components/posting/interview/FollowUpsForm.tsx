"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_QUESTION_BANK } from "@/lib/posting/questionBank";
import type {
  InterviewAnswer,
  SixWCategory,
} from "@/lib/posting/interviewSchemas";

interface FollowUp {
  id: string;
  prompt: string;
}

interface FollowUpGroup {
  questionId: string;
  acknowledgment?: string;
  followUps: FollowUp[];
}

interface FollowUpsFormProps {
  initialAnswers: InterviewAnswer[];
  followUps: FollowUpGroup[];
  onAnswersChange: (answers: InterviewAnswer[]) => void;
  onSave?: (answers: InterviewAnswer[]) => Promise<void | unknown>;
  fieldErrors?: Record<string, string>;
}

const SIX_W_SECTIONS = new Set(["why", "who", "what", "where", "when", "how"]);

export function FollowUpsForm({
  initialAnswers,
  followUps,
  onAnswersChange,
  onSave,
  fieldErrors = {},
}: FollowUpsFormProps) {
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const lastSavedRef = useRef<Record<string, string>>({});
  const lastMergedRef = useRef<string>('');

  // Initialize localAnswers only once, or merge in new values without overwriting user's current typing
  useEffect(() => {
    // Use a ref to track if we should update from initialAnswers
    // This prevents setState during render
    const initial: Record<string, string> = {};
    initialAnswers
      .filter((answer) => answer.isFollowUp)
      .forEach((answer) => {
        initial[answer.questionId] = answer.answer;
      });
    
    // Use setTimeout to defer state updates and avoid setState during render
    const updateTimer = setTimeout(() => {
      if (!isInitializedRef.current) {
        // First time initialization
        setLocalAnswers(initial);
        lastSavedRef.current = { ...initial };
        isInitializedRef.current = true;
      } else {
        // Subsequent updates: only merge in values that haven't been changed by the user
        setLocalAnswers((prev) => {
          const merged = { ...prev };
          Object.entries(initial).forEach(([key, value]) => {
            // Only update if:
            // 1. This is a new field (not in prev), OR
            // 2. The current value matches what we last saved (user hasn't changed it)
            if (prev[key] === undefined || prev[key] === lastSavedRef.current[key]) {
              merged[key] = value;
              // Update lastSavedRef for this field since it matches the saved state
              lastSavedRef.current[key] = value;
            }
            // If prev[key] !== lastSavedRef.current[key], the user has unsaved changes - preserve them
          });
          return merged;
        });
      }
    }, 0);
    
    return () => clearTimeout(updateTimer);
  }, [initialAnswers]);

  // Periodic autosave every minute (only if onSave is provided)
  useEffect(() => {
    if (!onSave) return;

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up interval to save every minute (only if there are changes)
    intervalRef.current = setInterval(async () => {
      // Check if there are any unsaved changes
      const hasChanges = Object.keys(localAnswers).some(
        (key) => localAnswers[key] !== lastSavedRef.current[key]
      );
      
      if (!hasChanges) return; // Skip if nothing changed
      
      const currentFollowUps = buildFollowUpAnswers(localAnswers, initialAnswers, followUps);
      if (!onSave) return;
      setIsSaving(true);
      try {
        await onSave(currentFollowUps);
        // Update lastSavedRef after successful save to track what was actually saved
        lastSavedRef.current = { ...localAnswers };
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[FollowUpsForm] autosave failed", error);
        }
      } finally {
        setIsSaving(false);
      }
    }, 60000); // Save every 60 seconds (1 minute)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [localAnswers, onSave, followUps, initialAnswers]);

  function handleAnswerChange(followUpId: string, value: string) {
    setLocalAnswers((prev) => {
      const next = { ...prev, [followUpId]: value };
      return next;
    });
    
    // Update parent state after local state is set (use useEffect to sync)
  }
  
  // Build merged answers using useMemo to avoid recalculating unnecessarily
  const mergedAnswers = useMemo(() => {
    return [
      ...initialAnswers.filter((answer) => !answer.isFollowUp),
      ...buildFollowUpAnswers(localAnswers, initialAnswers, followUps),
    ];
  }, [localAnswers, initialAnswers, followUps]);

  // Sync merged answers to parent when they change (but not during render)
  // Use a ref to prevent infinite loops from changing dependencies
  useEffect(() => {
    // Skip sync during initialization
    if (!isInitializedRef.current) {
      return;
    }
    
    // Create a stable key from merged to detect actual changes
    const mergedKey = JSON.stringify(mergedAnswers);
    
    // Only sync if the merged result actually changed
    if (mergedKey === lastMergedRef.current) {
      return;
    }
    
    lastMergedRef.current = mergedKey;
    
    // Notify parent AFTER render commit, not during render
    // Use setTimeout to defer to next tick and avoid setState during render
    const timer = setTimeout(() => {
      onAnswersChange(mergedAnswers);
    }, 0);
    
    return () => clearTimeout(timer);
  }, [mergedAnswers, onAnswersChange]);

  return (
    <div className="space-y-8">
      {isSaving && (
        <div className="text-xs text-[var(--text-secondary)] italic">Saving…</div>
      )}

      <div className="text-sm text-[var(--text-secondary)] mb-6">
        <p className="font-medium mb-2">
          Let's go a little deeper — these are optional.
        </p>
        <p className="text-xs">
          AI found{" "}
          {followUps.reduce((sum, group) => sum + group.followUps.length, 0)}{" "}
          intriguing answers. Answer what interests you, or skip to continue.
        </p>
      </div>

      {followUps.map((group) => {
        const parentAnswer = initialAnswers.find(
          (answer) => answer.questionId === group.questionId && !answer.isFollowUp
        );
        const parentQuestion = DEFAULT_QUESTION_BANK.find(
          (question) => question.id === group.questionId
        );

        return (
          <div
            key={group.questionId}
            className="space-y-4 border-l-2 border-[var(--accent)]/20 pl-4"
          >
            {parentQuestion && (
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {parentQuestion.prompt}
              </div>
            )}
            {parentAnswer && (
              <div className="text-xs text-[var(--text-secondary)] italic mb-3">
                Your answer: "{parentAnswer.answer.substring(0, 100)}
                {parentAnswer.answer.length > 100 ? "…" : ""}"
              </div>
            )}

            {/* Phase C: Acknowledgment sentence */}
            {group.acknowledgment && (
              <div className="text-sm text-[var(--text-primary)] italic mb-4 px-3 py-2 bg-[var(--bg-elevated)] rounded-lg border-l-4 border-[var(--accent)]/30">
                {group.acknowledgment}
              </div>
            )}

            {group.followUps.map((followUp) => {
              const currentAnswer = localAnswers[followUp.id] ?? "";
              const charCount = currentAnswer.length;
              const errorMessage = fieldErrors[followUp.id];

              return (
                <div key={followUp.id} className="space-y-2 ml-4">
                  <label className="block text-sm font-medium text-[var(--text-primary)]">
                    {followUp.prompt}
                    <span className="ml-2 text-xs text-[var(--text-secondary)] italic">
                      AI-suggested
                    </span>
                  </label>
                  <textarea
                    value={currentAnswer}
                    onChange={(event) =>
                      handleAnswerChange(followUp.id, event.target.value)
                    }
                    maxLength={2000}
                    rows={4}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] text-sm leading-relaxed ${
                      errorMessage ? "border-red-400 focus:border-red-500" : ""
                    }`}
                    style={{ maxWidth: "72ch" }}
                    placeholder="Type your answer here (optional)…"
                  />
                  <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                    <span>{charCount} / 2000 characters</span>
                  </div>
                  {errorMessage && (
                    <p className="text-xs text-red-600">{errorMessage}</p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function buildFollowUpAnswers(
  map: Record<string, string>,
  initialAnswers: InterviewAnswer[],
  followUps: FollowUpGroup[]
): InterviewAnswer[] {
  const answers: InterviewAnswer[] = [];

  followUps.forEach((group) => {
    const parentAnswer = initialAnswers.find(
      (answer) => answer.questionId === group.questionId && !answer.isFollowUp
    );
    if (!parentAnswer) return;

    group.followUps.forEach((followUp) => {
      const raw = map[followUp.id] ?? "";
      const trimmed = raw.trim();
      if (!trimmed) return;

      answers.push({
        questionId: followUp.id,
        role: parentAnswer.role,
        section: parentAnswer.section,
        category: deriveCategory(parentAnswer.section),
        answer: trimmed.slice(0, 2000),
        isFollowUp: true,
      });
    });
  });

  return answers;
}

function deriveCategory(section?: string): SixWCategory | undefined {
  if (!section) return undefined;
  if (!SIX_W_SECTIONS.has(section)) return undefined;
  return section.toUpperCase() as SixWCategory;
}

