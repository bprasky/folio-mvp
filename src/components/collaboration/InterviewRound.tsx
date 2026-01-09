'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Question {
  id: string;
  prompt: string;
  helper?: string;
  category?: string;
  // For Round 3
  referencedQuote?: string;
  referencesParty?: 'VENDOR' | 'DESIGNER';
}

interface Response {
  questionId: string;
  answer: string;
}

interface InterviewRoundProps {
  storyId: string;
  round: 1 | 2 | 3;
  role: 'VENDOR' | 'DESIGNER';
  otherPartyName?: string; // For Round 3
  onComplete?: () => void;
}

export function InterviewRound({
  storyId,
  round,
  role,
  otherPartyName,
  onComplete,
}: InterviewRoundProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Fetch questions for this round
  useEffect(() => {
    async function loadQuestions() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/collaboration/stories/${storyId}/round/${round}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to load questions');
        }

        const data = await res.json();
        setQuestions(data.questions || []);

        // Load existing responses
        const existing: Record<string, string> = {};
        (data.existingResponses || []).forEach((r: Response) => {
          existing[r.questionId] = r.answer;
        });
        setResponses(existing);
      } catch (error: any) {
        console.error('Failed to load questions:', error);
        toast.error(error.message || 'Failed to load questions');
      } finally {
        setIsLoading(false);
      }
    }

    loadQuestions();
  }, [storyId, round]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleSave = async (isComplete = false) => {
    const answeredResponses = Object.entries(responses)
      .filter(([, answer]) => answer.trim().length > 0)
      .map(([questionId, answer]) => ({
        questionId,
        answer: answer.trim(),
      }));

    if (answeredResponses.length === 0) {
      toast.error('Please answer at least one question');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/collaboration/stories/${storyId}/round/${round}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: answeredResponses }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save responses');
      }

      const data = await res.json();
      toast.success(
        data.isComplete
          ? `Round ${round} complete!`
          : `Progress saved (${answeredResponses.length} responses)`
      );

      if (data.isComplete && onComplete) {
        onComplete();
      }
    } catch (error: any) {
      console.error('Failed to save responses:', error);
      toast.error(error.message || 'Failed to save responses');
    } finally {
      setIsSaving(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.values(responses).filter((a) => a.trim().length > 0).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-neutral-300 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500">No questions available for this round.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-sm font-medium text-neutral-500">Round {round} of 3</span>
            <h2 className="text-xl font-semibold text-neutral-900">
              {round === 1 && 'Foundation Questions'}
              {round === 2 && 'Follow-Up Questions'}
              {round === 3 && `Responding to ${otherPartyName || 'your partner'}`}
            </h2>
          </div>
          <span className="text-sm text-neutral-500">
            {answeredCount} of {questions.length} answered
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden mb-6">
        {/* Question navigation */}
        <div className="flex border-b border-neutral-100 overflow-x-auto">
          {questions.map((q, index) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                index === currentQuestionIndex
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : responses[q.id]?.trim()
                  ? 'text-green-600 hover:bg-neutral-50'
                  : 'text-neutral-500 hover:bg-neutral-50'
              }`}
            >
              Q{index + 1}
              {responses[q.id]?.trim() && (
                <svg
                  className="w-3 h-3 ml-1 inline-block"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Current question */}
        {currentQuestion && (
          <div className="p-6">
            {/* Round 3 quote reference */}
            {round === 3 && currentQuestion.referencedQuote && (
              <div className="mb-6 p-4 bg-neutral-50 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm text-neutral-500 mb-1">
                  {currentQuestion.referencesParty === 'VENDOR' ? 'The vendor' : 'The designer'} said:
                </p>
                <p className="text-neutral-700 italic">"{currentQuestion.referencedQuote}"</p>
              </div>
            )}

            {/* Question */}
            <div className="mb-4">
              {currentQuestion.category && (
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                  {currentQuestion.category}
                </span>
              )}
              <p className="text-lg font-medium text-neutral-900 mt-1">
                {currentQuestion.prompt}
              </p>
              {currentQuestion.helper && (
                <p className="text-sm text-neutral-500 mt-2">{currentQuestion.helper}</p>
              )}
            </div>

            {/* Answer textarea */}
            <textarea
              value={responses[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              placeholder="Share your thoughts..."
              className="w-full h-40 px-4 py-3 border border-neutral-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={5000}
            />
            <div className="flex justify-between items-center mt-2 text-xs text-neutral-400">
              <span>
                {responses[currentQuestion.id]?.length || 0} / 5000 characters
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation and Save */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))
            }
            disabled={currentQuestionIndex === questions.length - 1}
          >
            Next
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
            Save Progress
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={isSaving || answeredCount < Math.min(3, questions.length)}
          >
            {isSaving ? 'Saving...' : 'Complete Round'}
          </Button>
        </div>
      </div>
    </div>
  );
}
