import { useState, useEffect } from 'react';
import { InterviewQuestion } from '@/types/interview';
import { readQuestionsCache, writeQuestionsCache } from '@/lib/interview/questionsCache';

export type ContextLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface ProjectSizeInfo {
  size: 'focused' | 'medium' | 'large' | 'showcase';
  targetQuestionCount: number;
  roomCount: number;
  selectionCount: number;
}

export interface InterviewQuestionsContext {
  contextLevel: ContextLevel;
  contextDescription: string;
  upgradeSuggestion: string | null;
  projectSize: ProjectSizeInfo;
}

export function useInterviewQuestions(projectId: string, cacheSignature?: string) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<InterviewQuestionsContext>({
    contextLevel: 0,
    contextDescription: 'No project context available',
    upgradeSuggestion: 'Add project photos to unlock personalized questions',
    projectSize: { size: 'focused', targetQuestionCount: 6, roomCount: 0, selectionCount: 0 },
  });

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    const cacheKey = `folio.interview.qcache.flat.${projectId}`;
    const signature = cacheSignature ?? 'default';

    const applyData = (data: any) => {
      setQuestions(data.questions || []);
      if (data.contextLevel !== undefined) {
        setContext({
          contextLevel: data.contextLevel as ContextLevel,
          contextDescription: data.contextDescription || 'No project context available',
          upgradeSuggestion: data.upgradeSuggestion || null,
          projectSize: data.projectSize || { size: 'focused', targetQuestionCount: 6, roomCount: 0, selectionCount: 0 },
        });
      }
    };

    // Instant, free re-open when the cache is fresh and non-empty.
    const cached = readQuestionsCache<any>(cacheKey, signature);
    if (cached && Array.isArray(cached.questions) && cached.questions.length > 0) {
      applyData(cached);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

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
        if (cancelled) return;
        applyData(data);
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          writeQuestionsCache(cacheKey, signature, data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          console.error('[useInterviewQuestions] Error:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQuestions();

    return () => {
      cancelled = true;
    };
  }, [projectId, cacheSignature]);

  return { questions, loading, error, context };
}

