import { useCallback, useRef } from 'react';

export interface QuestionUpdate {
  id: string;
  status: 'covered' | 'morphed';
  morphedText?: string;
}

interface EvaluateResponse {
  ok: boolean;
  updates: QuestionUpdate[];
}

/**
 * Hook for background evaluation of answer coverage.
 * Debounces calls to the lightweight /evaluate endpoint while the user types.
 * Pre-computes morphed questions so they appear instantly on submit.
 */
export function useBackgroundEvaluation(projectId: string) {
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Map<string, QuestionUpdate>>(new Map());

  /**
   * Trigger a background evaluation. Debounced at 500ms.
   * Fires only when answer text is >= 50 chars.
   */
  const evaluate = useCallback(
    (
      answerSummaries: Array<{ questionId: string; summary: string }>,
      remainingQuestions: Array<{ id: string; question: string }>
    ): void => {
      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Don't evaluate if there's nothing meaningful to check
      if (!answerSummaries.length || !remainingQuestions.length) return;

      debounceRef.current = setTimeout(async () => {
        // Abort previous in-flight request
        if (abortRef.current) {
          abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const resp = await fetch(
            `/api/posting/project/${projectId}/interview/evaluate`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ answerSummaries, remainingQuestions }),
              signal: controller.signal,
            }
          );

          if (!resp.ok) return;

          const data = (await resp.json()) as EvaluateResponse;
          if (!data.ok || !data.updates?.length) return;

          // Merge into pending updates (latest wins)
          for (const update of data.updates) {
            pendingUpdatesRef.current.set(update.id, update);
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
          console.warn('[useBackgroundEvaluation] error (non-critical):', err);
        }
      }, 500);
    },
    [projectId]
  );

  /**
   * Flush and return all pending background updates.
   * Called on submit to merge with submit-time results.
   * Submit-time results take priority — caller should apply those after.
   */
  const flush = useCallback((): QuestionUpdate[] => {
    const updates = Array.from(pendingUpdatesRef.current.values());
    pendingUpdatesRef.current.clear();
    return updates;
  }, []);

  /**
   * Cancel any in-flight evaluation and clear pending updates.
   */
  const cancel = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    pendingUpdatesRef.current.clear();
  }, []);

  return { evaluate, flush, cancel };
}
