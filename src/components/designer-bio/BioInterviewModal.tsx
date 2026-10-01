'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { useActivityExit } from '@/components/publishing-studio/UnsavedActivityDialog';
import { useSession } from 'next-auth/react';
import type { LiveAdapterSnapshot } from '@/lib/live-interview/adapter-types';
import { LiveInterviewPanel } from '@/components/interviews/LiveInterviewPanel';
import { cn } from '@/lib/utils';
import { InterviewQuestion } from '@/components/interview/shared/InterviewQuestion';
import { ProgressIndicator } from '@/components/interview/shared/ProgressIndicator';
import { FollowUpTransition } from '@/components/interview/TextInterview/FollowUpTransition';

interface BioQuestion {
  id: string;
  question: string;
  round: 'base' | 'followup';
}

interface BioInterviewModalProps {
  onComplete: () => void;
  onClose: () => void;
}

type ModalState = 'question' | 'transition' | 'end-of-round' | 'generating';

const questionTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3, ease: 'easeInOut' as const },
};

export default function BioInterviewModal({ onComplete, onClose }: BioInterviewModalProps) {
  const { data: authSession } = useSession();
  const [liveActive, setLiveActive] = useState(false);
  const [questions, setQuestions] = useState<BioQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [savedAnswer, setSavedAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastAnswer, setLastAnswer] = useState('');
  const [state, setState] = useState<ModalState>('question');
  const [round, setRound] = useState<'base' | 'followup'>('base');
  const [canGenerate, setCanGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load questions
  useEffect(() => {
    loadQuestions('base');
  }, []);

  // Auto-focus textarea
  useEffect(() => {
    if (state === 'question' && !loading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [state, loading, currentIdx]);

  // Cmd+Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !submitting && answer.trim()) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [answer, submitting]);

  async function loadQuestions(questionRound: 'base' | 'followup') {
    setLoading(true);
    try {
      const res = await fetch(`/api/designer/bio/questions?round=${questionRound}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load questions.');
      const qs: BioQuestion[] = data.questions || [];

      if (qs.length === 0 && questionRound === 'followup') {
        setCanGenerate(true);
        setState('end-of-round');
        setLoading(false);
        return;
      }

      const savedResponse = await fetch('/api/designer/bio', { cache: 'no-store' });
      if (!savedResponse.ok) throw new Error('Could not load saved answers.');
      const saved = await savedResponse.json();
      const answers = saved.bio?.interviewAnswers || [];
      // Generated question IDs can be positional. An existing answer always keeps
      // its original question; never relabel it with regenerated prompt text.
      const stableQuestions = qs.map(item => {
        const original = answers.find((entry: { id: string; question: string; round: string }) => entry.id === item.id && entry.round === questionRound);
        return original?.question ? { ...item, question: original.question } : item;
      });
      setQuestions(stableQuestions);
      setCanGenerate(answers.filter((entry: { round: string; answer: string }) => entry.round === 'base' && entry.answer.trim()).length >= 3);
      const unanswered = qs.findIndex(item => !answers.some((entry: { id: string; answer: string }) => entry.id === item.id && entry.answer.trim()));
      const nextIndex = Math.max(0, unanswered);
      setCurrentIdx(nextIndex);
      const previous = answers.find((entry: { id: string; answer: string }) => entry.id === qs[nextIndex]?.id)?.answer || '';
      setAnswer(previous); setSavedAnswer(previous);
      setRound(questionRound);
      setState(unanswered === -1 && qs.length > 0 ? 'end-of-round' : 'question');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load questions.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshLiveAnswers(live?: Omit<LiveAdapterSnapshot, 'state'>) {
    try {
      const response = await fetch('/api/designer/bio', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not refresh saved answers.');
      const result = await response.json();
      const saved: { id: string; question: string; answer: string; round: string }[] = result.bio?.interviewAnswers || [];
      const next = questions.map(question => ({ ...question, question: live?.currentQuestion?.id === question.id ? live.currentQuestion.text
        : saved.find(answer => answer.id === question.id && answer.round === round)?.question || question.question }));
      if (live?.currentQuestion && !next.some(q => q.id === live.currentQuestion!.id)) next.push({ id: live.currentQuestion.id, question: live.currentQuestion.text, round });
      setQuestions(next);
      setCanGenerate(saved.filter(answer => answer.round === 'base' && answer.answer.trim()).length >= 3);
      const index = live?.currentQuestion ? next.findIndex(q => q.id === live.currentQuestion!.id) : next.findIndex(q => !saved.some(a => a.id === q.id && a.answer.trim()));
      setCurrentIdx(Math.max(0, index));
      const text = saved.find(answer => answer.id === next[Math.max(0, index)]?.id)?.answer || '';
      setAnswer(text); setSavedAnswer(text); setState(index === -1 ? 'end-of-round' : 'question');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not refresh saved answers.'); }
  }

  const handleSubmit = useCallback(async () => {
    if (!answer.trim() || submitting || liveActive) return false;
    const currentQ = questions[currentIdx];
    if (!currentQ) return false;

    const answerText = answer.trim();
    setSubmitting(true);
    setLastAnswer(answerText);
    setState('transition');
    setError('');

    try {
      const res = await fetch('/api/designer/bio/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          question: currentQ.question,
          answer: answerText,
          round: currentQ.round,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save your answer.');
      setAnswer(''); setSavedAnswer('');
      setCanGenerate(data.canGenerateBio || false);

      const nextIdx = currentIdx + 1;
      if (nextIdx < questions.length) {
        setCurrentIdx(nextIdx);
        setState('question');
      } else {
        // All questions in round answered
        if (data.canGenerateBio) {
          setState('end-of-round');
        } else {
          setState('end-of-round');
        }
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your answer.');
      setState('question');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [answer, submitting, questions, currentIdx, liveActive]);

  const exit = useActivityExit(answer !== savedAnswer, submitting || generating, handleSubmit);

  async function handleGenerate() {
    setGenerating(true);
    setState('generating');
    try {
      const res = await fetch('/api/designer/bio/generate', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate bio');
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate your bio.');
      setGenerating(false);
      setState('end-of-round');
    }
  }

  function handleGoDeeper() {
    loadQuestions('followup');
  }

  function handleSkip() {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      setState('end-of-round');
    }
  }

  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {exit.dialog}
      {/* Backdrop */}
      <div
        className="absolute inset-0 glass-backdrop"
        onClick={() => exit.requestExit(onClose)}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[20px] shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Close button */}
        <button
          type="button"
          onClick={() => exit.requestExit(onClose)}
          className="absolute top-4 right-4 z-10 p-2 text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
          aria-label="Close interview"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Loading overlay for initial load */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20">
            <Loader2 className="w-6 h-6 text-folio-text-tertiary animate-spin" />
          </div>
        )}

        {error && <p role="alert" className="px-8 pt-14">{error}</p>}
        {/* Content */}
        {authSession?.user?.id && answer === savedAnswer && <LiveInterviewPanel source={{ kind: 'designer_bio', id: authSession.user.id, round: round === 'base' ? 1 : 2 }} onActiveChange={setLiveActive} onCanonicalChange={refreshLiveAnswers} />}
      <fieldset disabled={liveActive} className="min-w-0 border-0 p-0">
      <AnimatePresence mode="wait">
          {state === 'transition' ? (
            <motion.div
              key="transition"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="min-h-[600px]"
            >
              <FollowUpTransition
                previousAnswer={lastAnswer}
                isGenerating={submitting}
              />
            </motion.div>
          ) : state === 'generating' ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="min-h-[600px] flex items-center justify-center"
            >
              <div className="text-center space-y-4">
                <Loader2 className="w-8 h-8 text-folio-text-tertiary animate-spin mx-auto" />
                <p className="text-folio-text-secondary">Crafting your bio...</p>
              </div>
            </motion.div>
          ) : state === 'end-of-round' ? (
            <motion.div
              key="end-of-round"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="min-h-[600px] flex items-center justify-center"
            >
              <div className="max-w-md text-center space-y-6 px-8">
                <h3 className="text-xl font-serif text-folio-text-primary">
                  Great answers!
                </h3>
                <p className="text-sm text-folio-text-secondary leading-relaxed">
                  Ready to generate your bio, or want to go deeper with follow-up questions?
                </p>
                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="px-6 py-3 text-sm font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                  >
                    {generating ? 'Generating...' : 'Generate My Bio'}
                  </button>
                  {round === 'base' && (
                    <button
                      onClick={handleGoDeeper}
                      className="px-6 py-3 text-sm font-medium text-folio-text-secondary hover:text-folio-text-primary transition-colors"
                    >
                      Go Deeper
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : currentQuestion ? (
            <motion.div
              key={currentQuestion.id}
              {...questionTransition}
            >
              <div className="flex flex-col min-h-[600px]">
                {/* Progress indicator - top left */}
                <div className="px-6 md:px-8 pt-6">
                  <ProgressIndicator
                    current={currentIdx + 1}
                    total={totalQuestions}
                    variant="dots"
                  />
                </div>

                {/* Question section */}
                <div className="flex-1 flex flex-col justify-center px-6 md:px-8 py-8">
                  <InterviewQuestion question={currentQuestion.question} />
                </div>

                {/* Input section */}
                <div className="px-6 md:px-8 pb-6 space-y-4">
                  <div className="max-w-2xl mx-auto w-full">
                    <textarea
                      ref={textareaRef}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={6}
                      className={cn(
                        'w-full min-h-[160px] md:min-h-[200px] p-4 md:p-6',
                        'bg-surface-ground/50 rounded-xl text-lg',
                        'placeholder:text-folio-text-tertiary',
                        'border-transparent focus:border-folio-border-subtle',
                        'focus:outline-none focus:ring-2 focus:ring-gray-200',
                        'resize-none leading-relaxed transition-all'
                      )}
                      placeholder="Share your thoughts..."
                      disabled={submitting}
                    />

                    {/* Helper text */}
                    <p className="text-sm text-folio-text-tertiary mt-2">
                      Write as much or as little as you&apos;d like
                    </p>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
                    <button
                      type="button"
                      onClick={() => { if (answer !== savedAnswer) { setError('Save this answer before moving to another question.'); return; } setAnswer(''); setSavedAnswer(''); handleSkip(); }}
                      disabled={submitting}
                      className="text-folio-text-secondary hover:text-folio-text-primary text-sm py-2 px-3 transition-colors disabled:opacity-50"
                    >
                      Skip
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting || !answer.trim()}
                      className={cn(
                        'py-3 px-6 rounded-lg font-medium transition-all',
                        answer.trim() && !submitting
                          ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                          : 'bg-surface-ground text-folio-text-tertiary cursor-not-allowed'
                      )}
                    >
                      {submitting ? '...' : 'Continue →'}
                    </button>
                  </div>

                  {/* Generate hint if available mid-interview */}
                  {canGenerate && (
                    <div className="text-center">
                      <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="text-[var(--accent)] text-sm underline underline-offset-2 hover:text-[var(--accent-hover)] transition-colors"
                      >
                        Generate bio now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </fieldset>
      </div>
    </div>
  );
}
