"use client";

import { useMemo } from "react";
import { DEFAULT_QUESTION_BANK, type InterviewQuestion } from "@/lib/posting/questionBank";

interface PromptPickerProps {
  selectedQuestionIds: string[];
  onSelectionChange: (ids: string[]) => void;
  roleFilter?: "DESIGNER" | "VENDOR" | "ANY";
  hasTaggedProducts?: boolean;
  contextualQuestions?: InterviewQuestion[]; // AI-generated contextual questions
}

const SECTION_LABELS: Record<string, string> = {
  why: "WHY – Intent",
  who: "WHO – People",
  what: "WHAT – Decisions",
  where: "WHERE – Context",
  when: "WHEN – Timing",
  how: "HOW – Method",
};

export function PromptPicker({
  selectedQuestionIds,
  onSelectionChange,
  roleFilter = "DESIGNER",
  hasTaggedProducts = false,
  contextualQuestions = [],
}: PromptPickerProps) {
  // Merge DEFAULT_QUESTION_BANK with contextual questions
  const allQuestions = useMemo(() => {
    return [...DEFAULT_QUESTION_BANK, ...contextualQuestions];
  }, [contextualQuestions]);
  
  // Filter questions by role
  const availableQuestions = allQuestions.filter(
    (q) => q.role === roleFilter || q.role === "ANY"
  );

  // Group by 6W section
  const groups = useMemo(() => {
    const g: Record<string, InterviewQuestion[]> = {
      why: [],
      who: [],
      what: [],
      where: [],
      when: [],
      how: [],
    };
    for (const q of availableQuestions) {
      if (g[q.section]) {
        g[q.section].push(q);
      }
    }
    return g;
  }, [availableQuestions]);

  function toggleQuestion(id: string) {
    if (selectedQuestionIds.includes(id)) {
      onSelectionChange(selectedQuestionIds.filter((qid) => qid !== id));
    } else {
      if (selectedQuestionIds.length < 12) {
        onSelectionChange([...selectedQuestionIds, id]);
      }
    }
  }

  // Separate contextual questions for special display
  const contextualQIds = new Set(contextualQuestions.map(q => q.id));
  const hasContextual = contextualQuestions.length > 0;
  
  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600 mb-4">
        Select 3–12 questions to answer. Choose questions that best capture your project's story.
      </div>

      {/* Show contextual questions first if available */}
      {hasContextual && (
        <details
          open
          className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3"
        >
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <span className="font-semibold text-blue-900">
              ✨ Personalized Questions (Based on Your Images)
            </span>
            <span className="text-sm text-blue-700">
              {contextualQuestions.filter(q => selectedQuestionIds.includes(q.id)).length}/{contextualQuestions.length}
            </span>
          </summary>
          <ul className="mt-3 grid gap-2">
            {contextualQuestions.map((q) => {
              const on = selectedQuestionIds.includes(q.id);
              return (
                <li
                  key={q.id}
                  className="flex items-start justify-between rounded-lg border border-blue-200 bg-white px-3 py-2 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">{q.prompt}</div>
                    {q.helper && (
                      <div className="text-xs text-gray-500 mt-1">{q.helper}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleQuestion(q.id)}
                    className={`ml-3 px-3 py-1 rounded text-sm font-medium transition-colors ${
                      on
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    }`}
                    disabled={!on && selectedQuestionIds.length >= 12}
                  >
                    {on ? "Selected" : "Select"}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {Object.keys(groups).map((sec) => {
        const all = groups[sec];
        const selected = all.filter((q) => selectedQuestionIds.includes(q.id)).length;
        const muted = hasTaggedProducts && sec === "what"; // visual de-emphasis; still selectable

        return (
          <details
            key={sec}
            open
            className={`rounded-xl border p-3 ${muted ? "opacity-80" : ""}`}
          >
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <span className="font-semibold text-gray-900">{SECTION_LABELS[sec]}</span>
              <span className="text-sm text-gray-500">{selected}/{all.length}</span>
            </summary>
            <ul className="mt-3 grid gap-2">
              {all.map((q) => {
                const on = selectedQuestionIds.includes(q.id);
                return (
                  <li
                    key={q.id}
                    className="flex items-start justify-between rounded-lg border px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{q.prompt}</div>
                      {q.helper && (
                        <div className="text-xs text-gray-500 mt-1">{q.helper}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleQuestion(q.id)}
                      className={`ml-3 px-3 py-1 rounded text-sm font-medium transition-colors ${
                        on
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                      disabled={!on && selectedQuestionIds.length >= 12}
                    >
                      {on ? "Selected" : "Select"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}

      <div className="text-sm text-gray-500 pt-4 border-t">
        Selected: {selectedQuestionIds.length} / 12
      </div>
    </div>
  );
}
