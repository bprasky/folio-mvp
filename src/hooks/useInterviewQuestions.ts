import { useState, useEffect } from 'react';
import { InterviewQuestion } from '@/types/interview';

export type ContextLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface InterviewQuestionsContext {
  contextLevel: ContextLevel;
  contextDescription: string;
  upgradeSuggestion: string | null;
}

export function useInterviewQuestions(projectId: string) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<InterviewQuestionsContext>({
    contextLevel: 0,
    contextDescription: 'No project context available',
    upgradeSuggestion: 'Add project photos to unlock personalized questions',
  });

  useEffect(() => {
    if (!projectId) return;

    async function fetchQuestions() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/posting/project/${projectId}/interview/questions`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch questions');
        }

        const data = await response.json();
        setQuestions(data.questions || []);

        // Extract context information from response
        if (data.contextLevel !== undefined) {
          setContext({
            contextLevel: data.contextLevel as ContextLevel,
            contextDescription: data.contextDescription || 'No project context available',
            upgradeSuggestion: data.upgradeSuggestion || null,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('[useInterviewQuestions] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchQuestions();
  }, [projectId]);

  return { questions, loading, error, context };
}

