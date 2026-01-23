'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronRight, ChevronLeft, Sparkles, Check } from 'lucide-react';
import {
  TEAM_QUIZ_QUESTIONS,
  getContextualTeamQuestions,
  type TeamQuizQuestion
} from '@/lib/org-onboarding/interview-questions';

interface TeamMemberQuizModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  orgName: string;
  orgUserId: string;
  userName: string;
  orgBio?: {
    philosophyStatement?: string;
    projectTypes?: string[];
  };
  onComplete: () => void;
}

interface GeneratedContent {
  teamBlurb?: string;
  extendedBio?: string;
  pullQuote?: string;
}

export function TeamMemberQuizModal({
  open,
  onClose,
  orgId,
  orgName,
  orgUserId,
  userName,
  orgBio,
  onComplete
}: TeamMemberQuizModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Privacy settings
  const [showOnPersonalProfile, setShowOnPersonalProfile] = useState(false);
  const [showRoleOnProfile, setShowRoleOnProfile] = useState(true);

  const contextualQuestions = useMemo(() => getContextualTeamQuestions(orgBio), [orgBio]);
  const allQuestions = useMemo(
    () => [...TEAM_QUIZ_QUESTIONS, ...contextualQuestions],
    [contextualQuestions]
  );
  const currentQuestion = allQuestions[currentIndex];
  const progress = Math.round(((currentIndex + 1) / allQuestions.length) * 100);

  const formatQuestion = (question: string) => question.replace('{orgName}', orgName);

  const handleAnswer = (value: unknown) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.fieldMapping]: value
    }));
  };

  const handleNext = async () => {
    if (currentIndex < allQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setIsGenerating(true);
    setError(null);

    try {
      // Save answers
      const res = await fetch(`/api/orgs/${orgId}/team/${orgUserId}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });

      if (!res.ok) throw new Error('Failed to save quiz');

      // Generate content
      const genRes = await fetch(`/api/orgs/${orgId}/team/${orgUserId}/quiz/generate`, {
        method: 'POST'
      });

      if (!genRes.ok) throw new Error('Failed to generate content');

      const generated = await genRes.json();
      setGeneratedContent(generated);
      setIsGenerating(false);
      setIsComplete(true);
    } catch (err) {
      console.error('Quiz error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsGenerating(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = async () => {
    try {
      // Save privacy settings
      await fetch(`/api/orgs/${orgId}/team/${orgUserId}/quiz/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showOnPersonalProfile,
          showRoleOnProfile
        })
      });

      onComplete();
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
      onComplete();
      onClose();
    }
  };

  if (isGenerating) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Sparkles className="w-12 h-12 text-amber-600 animate-pulse" />
            <h3 className="text-xl" style={{ fontFamily: 'Georgia, serif' }}>
              Creating your team profile...
            </h3>
            <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
              We're generating your team blurb and bio based on your answers.
            </p>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isComplete && generatedContent) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Georgia, serif' }}>
              Your team profile is ready!
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-6">
            {/* Preview */}
            <div className="space-y-4">
              <div>
                <label
                  className="text-xs uppercase tracking-wide"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Team Blurb
                </label>
                <p className="mt-1 text-sm">{generatedContent.teamBlurb}</p>
              </div>

              {generatedContent.pullQuote && (
                <div>
                  <label
                    className="text-xs uppercase tracking-wide"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Pull Quote
                  </label>
                  <p className="mt-1 text-sm italic">"{generatedContent.pullQuote}"</p>
                </div>
              )}
            </div>

            {/* Privacy settings */}
            <div
              className="space-y-4 pt-4"
              style={{ borderTop: '1px solid var(--ridge-outer)' }}
            >
              <h4 className="font-medium">Display Settings</h4>

              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="show-role"
                  checked={showRoleOnProfile}
                  onChange={(e) => setShowRoleOnProfile(e.target.checked)}
                  className="mt-1"
                />
                <div className="grid gap-1.5 leading-none">
                  <label htmlFor="show-role" className="cursor-pointer">
                    Show my role at {orgName} on my Folio profile
                  </label>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    "{userName} is a [role] at {orgName}"
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="show-blurb"
                  checked={showOnPersonalProfile}
                  onChange={(e) => setShowOnPersonalProfile(e.target.checked)}
                  className="mt-1"
                />
                <div className="grid gap-1.5 leading-none">
                  <label htmlFor="show-blurb" className="cursor-pointer">
                    Display my team blurb publicly
                  </label>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Your generated blurb will appear on your personal profile
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="flex justify-end gap-3 px-6 pb-6 pt-4"
            style={{ borderTop: '1px solid var(--ridge-outer)' }}
          >
            <Button variant="ghost" onClick={() => setIsComplete(false)}>
              Edit Answers
            </Button>
            <Button onClick={handleFinish}>Save & Finish</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Georgia, serif' }}>Team Member Profile</DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <div
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  backgroundColor: 'var(--accent)'
                }}
              />
            </div>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {currentIndex + 1} of {allQuestions.length}
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
              <h3 className="text-lg font-medium">{formatQuestion(currentQuestion.question)}</h3>

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

              {currentQuestion.inputType === 'date' && (
                <Input
                  type="month"
                  value={(answers[currentQuestion.fieldMapping] as string) || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
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
                            handleAnswer(current.filter((o: string) => o !== option));
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
            </div>
          )}

          <div
            className="flex justify-between pt-4"
            style={{ borderTop: '1px solid var(--ridge-outer)' }}
          >
            <Button variant="ghost" onClick={handleBack} disabled={currentIndex === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button onClick={handleNext} disabled={isSubmitting}>
              {currentIndex === allQuestions.length - 1 ? 'Generate Profile' : 'Next'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
