'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronRight, ChevronLeft, Sparkles, Check, X } from 'lucide-react';
import {
  LAYER_1_QUESTIONS,
  LAYER_3_QUESTIONS,
  getContextualQuestions,
  type InterviewQuestion
} from '@/lib/org-onboarding/interview-questions';

interface BioInterviewModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  orgName: string;
  onComplete: () => void;
}

type InterviewStep = 'layer1' | 'layer2' | 'layer3' | 'generating' | 'complete';

export function BioInterviewModal({
  open,
  onClose,
  orgId,
  orgName,
  onComplete
}: BioInterviewModalProps) {
  const [step, setStep] = useState<InterviewStep>('layer1');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [layer2Questions, setLayer2Questions] = useState<InterviewQuestion[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get current question set based on step
  const getCurrentQuestions = (): InterviewQuestion[] => {
    switch (step) {
      case 'layer1':
        return LAYER_1_QUESTIONS;
      case 'layer2':
        return layer2Questions;
      case 'layer3':
        return LAYER_3_QUESTIONS;
      default:
        return [];
    }
  };

  const currentQuestions = getCurrentQuestions();
  const currentQuestion = currentQuestions[currentQuestionIndex];

  // Calculate total questions dynamically
  const getTotalQuestions = () => {
    return LAYER_1_QUESTIONS.length + layer2Questions.length + LAYER_3_QUESTIONS.length;
  };

  // Get current question number across all layers
  const getCurrentQuestionNumber = () => {
    if (step === 'layer1') return currentQuestionIndex + 1;
    if (step === 'layer2') return LAYER_1_QUESTIONS.length + currentQuestionIndex + 1;
    if (step === 'layer3')
      return LAYER_1_QUESTIONS.length + layer2Questions.length + currentQuestionIndex + 1;
    return getTotalQuestions();
  };

  // Calculate progress
  const getProgress = () => {
    let completed = 0;
    if (step === 'layer1') completed = currentQuestionIndex;
    else if (step === 'layer2') completed = LAYER_1_QUESTIONS.length + currentQuestionIndex;
    else if (step === 'layer3')
      completed = LAYER_1_QUESTIONS.length + layer2Questions.length + currentQuestionIndex;
    else completed = getTotalQuestions();
    return Math.round((completed / Math.max(getTotalQuestions(), 1)) * 100);
  };

  // Auto-focus input on question change
  useEffect(() => {
    if (open && currentQuestion) {
      setTimeout(() => {
        if (currentQuestion.inputType === 'textarea' && textareaRef.current) {
          textareaRef.current.focus();
        } else if (currentQuestion.inputType === 'text' && inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [open, currentQuestion?.fieldMapping]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to proceed
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isSubmitting) {
        e.preventDefault();
        handleNext();
      }
    };

    if (open && step !== 'generating' && step !== 'complete') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, step, isSubmitting, currentQuestionIndex, answers]);

  // Handle answer updates
  const handleAnswer = (value: string | string[]) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.fieldMapping]: value
    }));
  };

  // Get current answer
  const getCurrentAnswer = (): string => {
    if (!currentQuestion) return '';
    const answer = answers[currentQuestion.fieldMapping];
    return typeof answer === 'string' ? answer : '';
  };

  // Navigate between questions
  const handleNext = async () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Move to next step
      if (step === 'layer1') {
        // Calculate L2 questions based on L1 answers
        const contextual = getContextualQuestions(answers);
        setLayer2Questions(contextual);

        if (contextual.length > 0) {
          setStep('layer2');
          setCurrentQuestionIndex(0);
        } else {
          setStep('layer3');
          setCurrentQuestionIndex(0);
        }
      } else if (step === 'layer2') {
        setStep('layer3');
        setCurrentQuestionIndex(0);
      } else if (step === 'layer3') {
        // Submit and generate
        await handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    } else if (step === 'layer2') {
      setStep('layer1');
      setCurrentQuestionIndex(LAYER_1_QUESTIONS.length - 1);
    } else if (step === 'layer3') {
      if (layer2Questions.length > 0) {
        setStep('layer2');
        setCurrentQuestionIndex(layer2Questions.length - 1);
      } else {
        setStep('layer1');
        setCurrentQuestionIndex(LAYER_1_QUESTIONS.length - 1);
      }
    }
  };

  const handleSubmit = async () => {
    setStep('generating');
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/orgs/${orgId}/bio-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });

      if (!response.ok) throw new Error('Failed to save interview');

      // Generate bio
      const genResponse = await fetch(`/api/orgs/${orgId}/bio-interview/generate`, {
        method: 'POST'
      });

      if (!genResponse.ok) throw new Error('Failed to generate bio');

      setStep('complete');
      onComplete();
    } catch (err) {
      console.error('Interview error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('layer3');
      setCurrentQuestionIndex(LAYER_3_QUESTIONS.length - 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Replace {orgName} in questions
  const formatQuestion = (question: string) => question.replace('{orgName}', orgName);

  // Generating state - immersive
  if (step === 'generating') {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="w-full max-w-5xl h-[90vh] max-h-[90vh] mx-auto my-auto rounded-[20px] flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden">
          <DialogTitle className="sr-only">Creating your studio bio</DialogTitle>
          <div className="flex flex-col items-center justify-center space-y-6">
            <Sparkles className="w-16 h-16 text-amber-600 animate-pulse" />
            <h3 className="text-3xl font-serif italic text-folio-text-primary">
              Crafting your story...
            </h3>
            <p className="text-base text-folio-text-secondary text-center max-w-md">
              We're generating your bio, tagline, and philosophy based on your answers.
            </p>
            <Loader2 className="w-8 h-8 animate-spin text-folio-text-tertiary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Complete state - immersive
  if (step === 'complete') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-5xl h-[90vh] max-h-[90vh] mx-auto my-auto rounded-[20px] flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden">
          <DialogTitle className="sr-only">Your studio bio is ready</DialogTitle>
          <div className="flex flex-col items-center justify-center space-y-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
            >
              <Check className="w-10 h-10" style={{ color: 'rgb(34, 197, 94)' }} />
            </div>
            <h3 className="text-3xl font-serif italic text-folio-text-primary">
              Your bio is ready
            </h3>
            <p className="text-base text-folio-text-secondary text-center max-w-md">
              Review your generated bio and make any adjustments in your profile settings.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-8 py-3 bg-[var(--text-primary)] text-white rounded-full text-sm font-medium hover:opacity-90 transition-colors"
            >
              View Profile
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Main interview view - immersive style
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-5xl h-[90vh] max-h-[90vh] mx-auto my-auto rounded-[20px] flex flex-col bg-white/90 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden">
        <DialogTitle className="sr-only">Studio bio interview</DialogTitle>
        {/* Header with close button and progress */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-folio-border-subtle/50 bg-white/50">
          <button
            onClick={onClose}
            className="text-folio-text-secondary hover:text-folio-text-primary transition-colors p-1 rounded-full hover:bg-surface-ground"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs px-3 py-1">
              {step === 'layer1'
                ? 'Foundation'
                : step === 'layer2'
                  ? 'Context'
                  : 'Proof Points'}
            </Badge>
            <span className="text-sm text-folio-text-secondary">
              Question {getCurrentQuestionNumber()} of {getTotalQuestions()}
            </span>
          </div>

          <div className="w-6" /> {/* Spacer for alignment */}
        </div>

        {/* Progress bar */}
        <div className="px-8 pt-4">
          <div className="w-full h-1 rounded-full bg-surface-ground overflow-hidden">
            <div
              className="h-full transition-all duration-500 ease-out rounded-full"
              style={{
                width: `${getProgress()}%`,
                backgroundColor: '#1a1a1a'
              }}
            />
          </div>
        </div>

        {error && (
          <div className="mx-8 mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Question section - centered and immersive */}
        {currentQuestion && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Question (top portion) */}
            <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-12 space-y-4">
              <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl italic text-folio-text-primary leading-tight max-w-3xl">
                {formatQuestion(currentQuestion.question)}
              </h2>
              <p className="text-base text-folio-text-secondary max-w-2xl">
                {currentQuestion.purpose}
              </p>
            </div>

            {/* Input section (bottom portion) */}
            <div className="flex-1 flex flex-col justify-start px-8 md:px-16 py-6 space-y-4">
              <div className="max-w-3xl w-full">
                {currentQuestion.inputType === 'textarea' && (
                  <Textarea
                    ref={textareaRef}
                    value={getCurrentAnswer()}
                    onChange={(e) => handleAnswer(e.target.value)}
                    placeholder={currentQuestion.placeholder}
                    className="w-full min-h-[180px] p-4 bg-surface-ground/50 border border-folio-border-subtle rounded-xl text-lg placeholder:text-folio-text-tertiary focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-folio-border-subtle resize-y leading-relaxed"
                  />
                )}

                {currentQuestion.inputType === 'text' && (
                  <Input
                    ref={inputRef}
                    value={getCurrentAnswer()}
                    onChange={(e) => handleAnswer(e.target.value)}
                    placeholder={currentQuestion.placeholder}
                    className="w-full p-4 bg-surface-ground/50 border border-folio-border-subtle rounded-xl text-lg placeholder:text-folio-text-tertiary focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-folio-border-subtle"
                  />
                )}

                {currentQuestion.inputType === 'multiselect' && currentQuestion.options && (
                  <div className="flex flex-wrap gap-3">
                    {currentQuestion.options.map((option) => {
                      const selected = (
                        (answers[currentQuestion.fieldMapping] as string[]) || []
                      ).includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                            selected
                              ? 'bg-[var(--text-primary)] text-white'
                              : 'bg-surface-ground text-folio-text-primary hover:bg-surface-ground'
                          }`}
                          onClick={() => {
                            const current =
                              (answers[currentQuestion.fieldMapping] as string[]) || [];
                            if (selected) {
                              handleAnswer(current.filter((o) => o !== option));
                            } else {
                              handleAnswer([...current, option]);
                            }
                          }}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.inputType === 'project-picker' && (
                  <div className="border border-folio-border-subtle rounded-xl p-6 bg-surface-ground/50">
                    <p className="text-sm text-folio-text-secondary mb-4">
                      Project selection will be available once you have projects on Folio.
                    </p>
                    <Textarea
                      value={getCurrentAnswer()}
                      onChange={(e) => handleAnswer(e.target.value)}
                      placeholder="Or describe a representative project here..."
                      className="w-full min-h-[120px] p-4 bg-white border border-folio-border-subtle rounded-xl text-lg placeholder:text-folio-text-tertiary focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-folio-border-subtle resize-y"
                    />
                  </div>
                )}
              </div>

              {/* Keyboard hint */}
              <div className="max-w-3xl flex justify-end text-sm text-folio-text-tertiary">
                <span>Press ⌘ + Enter to continue</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer with navigation */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-folio-border-subtle/50 bg-white/50">
          <button
            onClick={handleBack}
            disabled={step === 'layer1' && currentQuestionIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-folio-text-secondary hover:text-folio-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--text-primary)] text-white rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span>
              {step === 'layer3' && currentQuestionIndex === LAYER_3_QUESTIONS.length - 1
                ? 'Generate Bio'
                : 'Continue'}
            </span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
