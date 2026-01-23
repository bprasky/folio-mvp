'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronRight, ChevronLeft, Sparkles, Check } from 'lucide-react';
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

  // Handle answer updates
  const handleAnswer = (value: string | string[]) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.fieldMapping]: value
    }));
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

  if (step === 'generating') {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Sparkles className="w-12 h-12 text-amber-600 animate-pulse" />
            <h3 className="text-xl" style={{ fontFamily: 'Georgia, serif' }}>
              Crafting your story...
            </h3>
            <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
              We're generating your bio, tagline, and philosophy based on your answers.
            </p>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === 'complete') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
            >
              <Check className="w-8 h-8" style={{ color: 'rgb(34, 197, 94)' }} />
            </div>
            <h3 className="text-xl" style={{ fontFamily: 'Georgia, serif' }}>
              Your bio is ready
            </h3>
            <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
              Review your generated bio and make any adjustments in your profile settings.
            </p>
            <Button onClick={onClose}>View Profile</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Georgia, serif' }}>
            Tell your studio's story
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <div
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${getProgress()}%`,
                  backgroundColor: 'var(--accent)'
                }}
              />
            </div>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {getProgress()}%
            </span>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6">
          {error && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'rgb(220, 38, 38)' }}
            >
              {error}
            </div>
          )}

          {currentQuestion && (
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">
                  {step === 'layer1'
                    ? 'Foundation'
                    : step === 'layer2'
                      ? 'Context'
                      : 'Proof Points'}
                </Badge>
                <h3 className="text-lg font-medium">{formatQuestion(currentQuestion.question)}</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {currentQuestion.purpose}
                </p>
              </div>

              {currentQuestion.inputType === 'textarea' && (
                <Textarea
                  value={(answers[currentQuestion.fieldMapping] as string) || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder={currentQuestion.placeholder}
                  className="min-h-[150px]"
                />
              )}

              {currentQuestion.inputType === 'text' && (
                <Input
                  value={(answers[currentQuestion.fieldMapping] as string) || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder={currentQuestion.placeholder}
                />
              )}

              {currentQuestion.inputType === 'multiselect' && currentQuestion.options && (
                <div className="flex flex-wrap gap-2">
                  {currentQuestion.options.map((option) => {
                    const selected = (
                      (answers[currentQuestion.fieldMapping] as string[]) || []
                    ).includes(option);
                    return (
                      <Badge
                        key={option}
                        variant={selected ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors"
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
                      </Badge>
                    );
                  })}
                </div>
              )}

              {currentQuestion.inputType === 'project-picker' && (
                <div
                  className="border rounded-lg p-4 text-center"
                  style={{ borderColor: 'var(--ridge-outer)', color: 'var(--text-secondary)' }}
                >
                  <p className="text-sm">
                    Project selection will be available once you have projects on Folio.
                  </p>
                  <Textarea
                    className="mt-3"
                    value={(answers[currentQuestion.fieldMapping] as string) || ''}
                    onChange={(e) => handleAnswer(e.target.value)}
                    placeholder="Or describe a representative project here..."
                  />
                </div>
              )}
            </div>
          )}

          <div
            className="flex justify-between pt-4"
            style={{ borderTop: '1px solid var(--ridge-outer)' }}
          >
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 'layer1' && currentQuestionIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button onClick={handleNext} disabled={isSubmitting}>
              {step === 'layer3' && currentQuestionIndex === LAYER_3_QUESTIONS.length - 1
                ? 'Generate Bio'
                : 'Next'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
