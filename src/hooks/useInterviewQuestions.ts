import { useState, useEffect } from 'react';
import { InterviewQuestion } from '@/types/interview';

export function useInterviewQuestions(projectId: string) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('[useInterviewQuestions] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchQuestions();
  }, [projectId]);

  return { questions, loading, error };
}

