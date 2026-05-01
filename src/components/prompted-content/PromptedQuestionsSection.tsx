'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { PromptedQuestionCard, type PromptedQuestion } from './PromptedQuestionCard';
import { PromptedAnswerModal } from './PromptedAnswerModal';

interface PromptedQuestionsSectionProps {
  className?: string;
}

export function PromptedQuestionsSection({ className }: PromptedQuestionsSectionProps) {
  const { data: session } = useSession();
  const [questions, setQuestions] = useState<PromptedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<PromptedQuestion | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    async function fetchQuestions() {
      try {
        const response = await fetch('/api/prompted-content/questions');
        if (response.ok) {
          const data = await response.json();
          setQuestions(data.questions ?? []);
        }
      } catch (error) {
        console.error('Error fetching prompted questions:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchQuestions();
  }, [session?.user?.id]);

  const handleSubmitAnswer = async (questionId: string, answerText: string) => {
    const response = await fetch('/api/prompted-content/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answerText }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to submit answer');
    }

    // Remove answered question from the list
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  };

  // Don't render if not logged in, still loading, or no questions
  if (!session?.user || loading || questions.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      {/* Header — matches GatheringVoicesSection style */}
      <div className="mb-6">
        <h2
          className="text-[13px] font-normal uppercase tracking-[0.12em] text-folio-text-secondary"
        >
          Questions for You
        </h2>
      </div>

      {/* Question cards — responsive grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {questions.map((question) => (
          <PromptedQuestionCard
            key={question.id}
            question={question}
            onAnswer={setSelectedQuestion}
          />
        ))}
      </div>

      {/* Answer modal */}
      {selectedQuestion && (
        <PromptedAnswerModal
          question={selectedQuestion}
          onSubmit={handleSubmitAnswer}
          onClose={() => setSelectedQuestion(null)}
        />
      )}
    </section>
  );
}
