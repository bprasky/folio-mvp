'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronRight, ChevronLeft, Sparkles, Check, Loader2, X } from 'lucide-react';
import {
  ORG_ABOUT_QUESTIONS,
  type ConversationalQuestion,
} from '@/lib/org-onboarding/conversational-interview-questions';

export default function OrgAboutInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const orgId = params.orgId as string;
  const returnTo = searchParams.get('returnTo');

  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'interview' | 'generating' | 'complete'>('interview');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const questions = ORG_ABOUT_QUESTIONS;
  const currentQuestion = questions[currentIndex];
  const progress = Math.round((currentIndex / questions.length) * 100);

  useEffect(() => {
    async function loadOrg() {
      try {
        const res = await fetch(`/api/orgs/${orgId}`);
        if (res.ok) {
          const data = await res.json();
          setOrgName(data.name || 'your studio');
        }
      } catch {
        // fallback name is fine
      } finally {
        setLoading(false);
      }
    }
    if (session?.user) loadOrg();
  }, [orgId, session]);

  useEffect(() => {
    if (step === 'interview' && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [currentIndex, step]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isSubmitting) {
        e.preventDefault();
        handleNext();
      }
    };
    if (step === 'interview') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [step, isSubmitting, currentIndex, answers]);

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleSubmit = async () => {
    setStep('generating');
    setIsSubmitting(true);
    setError(null);

    try {
      // Save conversational answers
      const saveRes = await fetch(`/api/orgs/${orgId}/bio-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          format: 'conversational',
        }),
      });
      if (!saveRes.ok) throw new Error('Failed to save interview');

      // Trigger extraction + bio generation
      const extractRes = await fetch('/api/profile/extract-from-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      if (!extractRes.ok) throw new Error('Failed to extract profile fields');

      setStep('complete');
    } catch (err) {
      console.error('Interview submission error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('interview');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    if (returnTo === 'profile') {
      router.push(`/org/${orgId}/settings`);
    } else {
      router.push(`/org/${orgId}?tab=about`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAF9F7' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#8B8178' }} />
      </div>
    );
  }

  if (step === 'generating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#FAF9F7' }}>
        <Sparkles className="w-16 h-16 animate-pulse mb-6" style={{ color: '#B8845C' }} />
        <h3
          className="text-3xl italic mb-3"
          style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 400 }}
        >
          Crafting your story...
        </h3>
        <p className="text-base mb-6" style={{ color: '#8B8178', fontFamily: 'var(--font-body)' }}>
          We&apos;re generating your bio and populating your profile from what you shared.
        </p>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#8B8178' }} />
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#FAF9F7' }}>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
        >
          <Check className="w-10 h-10" style={{ color: 'rgb(34, 197, 94)' }} />
        </div>
        <h3
          className="text-3xl italic mb-3"
          style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 400 }}
        >
          Your profile is ready
        </h3>
        <p className="text-base mb-8 text-center max-w-md" style={{ color: '#8B8178', fontFamily: 'var(--font-body)' }}>
          We&apos;ve populated your profile from your answers. Review and fine-tune anything you&apos;d like.
        </p>
        <button
          onClick={handleFinish}
          className="px-8 py-3 rounded-full text-sm font-medium transition-all hover:opacity-90"
          style={{ backgroundColor: '#2C2825', color: '#FAF9F7' }}
        >
          Review Profile
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FAF9F7' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: '#E8E4DF' }}>
        <button
          onClick={() => router.back()}
          className="p-1 rounded-full transition-colors hover:opacity-70"
          style={{ color: '#8B8178' }}
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3">
          <span
            className="text-xs px-3 py-1 rounded-full"
            style={{ backgroundColor: '#E8E4DF', color: '#6B635B', fontFamily: 'var(--font-body)' }}
          >
            About {orgName}
          </span>
          <span className="text-sm" style={{ color: '#8B8178', fontFamily: 'var(--font-body)' }}>
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>

        <div className="w-6" />
      </div>

      {/* Progress bar */}
      <div className="px-8 pt-4">
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#E8E4DF' }}>
          <div
            className="h-full transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%`, backgroundColor: '#2C2825' }}
          />
        </div>
      </div>

      {error && (
        <div className="mx-8 mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Question */}
      {currentQuestion && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-12 space-y-4">
            <h2
              className="text-3xl md:text-4xl lg:text-5xl italic leading-tight max-w-3xl"
              style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 400 }}
            >
              {currentQuestion.question}
            </h2>
          </div>

          <div className="flex-1 flex flex-col justify-start px-8 md:px-16 py-6 space-y-4">
            <div className="max-w-3xl w-full">
              <textarea
                ref={textareaRef}
                value={answers[currentQuestion.id] || ''}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))
                }
                placeholder="Take your time..."
                className="w-full min-h-[180px] p-4 rounded-xl border text-lg resize-y leading-relaxed outline-none transition-colors"
                style={{
                  backgroundColor: 'rgba(250, 249, 247, 0.5)',
                  borderColor: '#E8E4DF',
                  color: '#2C2825',
                  fontFamily: 'var(--font-body)',
                }}
              />
            </div>
            <div className="max-w-3xl flex justify-end text-sm" style={{ color: '#B8B0A6' }}>
              <span>Press &#8984; + Enter to continue</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center justify-between px-8 py-4 border-t"
        style={{ borderColor: '#E8E4DF' }}
      >
        <button
          onClick={handleBack}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: '#8B8178' }}
        >
          <ChevronLeft className="w-5 h-5" />
          <span style={{ fontFamily: 'var(--font-body)' }}>Back</span>
        </button>

        <button
          onClick={handleNext}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#2C2825', color: '#FAF9F7', fontFamily: 'var(--font-body)' }}
        >
          <span>
            {currentIndex === questions.length - 1 ? 'Generate Profile' : 'Continue'}
          </span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
