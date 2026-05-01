'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Check,
  Loader2,
  X,
  Link as LinkIcon,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  ORG_ABOUT_QUESTIONS,
  type ConversationalQuestion,
} from '@/lib/org-onboarding/conversational-interview-questions';

type Step =
  | 'choose-path'    // Two-path: import bio vs start from scratch
  | 'import-bio'     // URL + paste text input
  | 'analyzing'      // Spinner while Claude analyzes
  | 'coverage'       // Coverage summary screen
  | 'interview'      // Gap questions (or full interview if from scratch)
  | 'generating'     // Extraction + bio generation
  | 'complete';      // Done

interface CoverageResult {
  questionId: string;
  depth: 'full' | 'partial' | 'none';
  extractedAnswer: string | null;
  gapNote: string | null;
}

export default function OrgAboutInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const orgId = params.orgId as string;
  const returnTo = searchParams.get('returnTo');

  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('choose-path');
  const [error, setError] = useState<string | null>(null);

  // Bio import state
  const [bioUrl, setBioUrl] = useState('');
  const [bioText, setBioText] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [importedBioText, setImportedBioText] = useState('');
  const [bioImportType, setBioImportType] = useState<'FRESH' | 'IMPORTED_URL' | 'IMPORTED_TEXT'>('FRESH');

  // Coverage state
  const [coverage, setCoverage] = useState<CoverageResult[]>([]);

  // Interview state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Determine which questions to ask based on coverage
  const [activeQuestions, setActiveQuestions] = useState<ConversationalQuestion[]>(ORG_ABOUT_QUESTIONS);
  const currentQuestion = activeQuestions[currentIndex];
  const progress = activeQuestions.length > 0 ? Math.round((currentIndex / activeQuestions.length) * 100) : 0;

  // Build follow-up question text for partial coverage
  const getQuestionText = (question: ConversationalQuestion): string => {
    const cov = coverage.find((c) => c.questionId === question.id);
    if (cov?.depth === 'partial' && cov.extractedAnswer) {
      return `You mentioned: "${cov.extractedAnswer}" — can you go a bit deeper on that?`;
    }
    return question.question;
  };

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

  // --- Handlers ---

  const handleStartFromScratch = () => {
    setBioImportType('FRESH');
    setActiveQuestions(ORG_ABOUT_QUESTIONS);
    setCurrentIndex(0);
    setStep('interview');
  };

  const handleFetchUrl = async () => {
    if (!bioUrl.trim()) return;
    setFetchingUrl(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/fetch-bio-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: bioUrl.trim() }),
      });
      const data = await res.json();
      if (data.text) {
        setBioText(data.text);
      } else {
        setError(
          data.error === 'couldnt_access'
            ? "We couldn't access that page — paste your bio text instead."
            : data.error === 'no_bio_found'
              ? "We couldn't find a bio on that page — try pasting the text directly."
              : 'Something went wrong fetching that URL.'
        );
      }
    } catch {
      setError("We couldn't access that page — paste your bio text instead.");
    } finally {
      setFetchingUrl(false);
    }
  };

  const handleAnalyzeBio = async () => {
    const text = bioText.trim();
    if (!text) return;

    setImportedBioText(text);
    setBioImportType(bioUrl.trim() ? 'IMPORTED_URL' : 'IMPORTED_TEXT');
    setStep('analyzing');
    setError(null);

    try {
      const res = await fetch('/api/profile/analyze-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bioText: text, context: 'org' }),
      });

      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      const coverageResults: CoverageResult[] = data.coverage;
      setCoverage(coverageResults);

      // Determine gap questions
      const gapQuestionIds = coverageResults
        .filter((c) => c.depth !== 'full')
        .map((c) => c.questionId);

      const gapQuestions = ORG_ABOUT_QUESTIONS.filter((q) =>
        gapQuestionIds.includes(q.id)
      );

      setActiveQuestions(gapQuestions);
      setCurrentIndex(0);
      setStep('coverage');
    } catch (err) {
      console.error('Bio analysis error:', err);
      setError('Failed to analyze your bio. You can start from scratch instead.');
      setStep('import-bio');
    }
  };

  const handleCoverageContinue = async () => {
    if (activeQuestions.length === 0) {
      // All questions covered — skip to extraction
      await handleSubmit();
    } else {
      setStep('interview');
    }
  };

  const handleNext = async () => {
    if (currentIndex < activeQuestions.length - 1) {
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
      // Save conversational answers (may be partial if bio imported)
      const saveRes = await fetch(`/api/orgs/${orgId}/bio-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.keys(answers).length > 0 ? answers : {},
          format: 'conversational',
          importedBioText: importedBioText || null,
          importedBioUrl: bioUrl.trim() || null,
          bioImportType,
        }),
      });
      if (!saveRes.ok) throw new Error('Failed to save interview');

      // Save coverage records if we have them
      if (coverage.length > 0) {
        // Fire and forget — coverage is diagnostic, not blocking
        fetch(`/api/orgs/${orgId}/bio-interview/coverage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coverage }),
        }).catch(() => {});
      }

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

  // --- Renders ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--surface-ground)' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#8B8178' }} />
      </div>
    );
  }

  // Step: Choose Path
  if (step === 'choose-path') {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--surface-ground)' }}>
        <div className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: '#E8E4DF' }}>
          <button
            onClick={() => router.back()}
            className="p-1 rounded-full transition-colors hover:opacity-70"
            style={{ color: '#8B8178' }}
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="w-6" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="max-w-lg text-center">
            <h1
              className="text-4xl md:text-5xl italic mb-4"
              style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 400 }}
            >
              Let&apos;s build your studio profile.
            </h1>
            <p
              className="text-base mb-12 max-w-md mx-auto"
              style={{ color: '#8B8178' }}
            >
              We&apos;ll ask you a few questions about your work — or if you already have a bio written somewhere, we can start there instead.
            </p>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => setStep('import-bio')}
                className="flex items-center gap-3 px-8 py-4 rounded-full text-sm font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
              >
                <LinkIcon className="w-4 h-4" />
                Link or paste a bio
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleStartFromScratch}
                className="text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                style={{ color: '#8B8178' }}
              >
                Start from scratch
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step: Import Bio
  if (step === 'import-bio') {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--surface-ground)' }}>
        <div className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: '#E8E4DF' }}>
          <button
            onClick={() => setStep('choose-path')}
            className="p-1 rounded-full transition-colors hover:opacity-70"
            style={{ color: '#8B8178' }}
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span
            className="text-xs px-3 py-1 rounded-full"
            style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
          >
            Import Bio
          </span>
          <div className="w-6" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="max-w-lg w-full">
            <h2
              className="text-3xl italic mb-2 text-center"
              style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 400 }}
            >
              Bring in your existing bio
            </h2>
            <p
              className="text-sm text-center mb-8"
              style={{ color: '#8B8178' }}
            >
              We&apos;ll analyze what you already have and only ask about what&apos;s missing.
            </p>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* URL input */}
            <div className="mb-6">
              <label
                className="text-xs font-medium mb-1.5 block"
                style={{ color: '#6B635B' }}
              >
                Paste a URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={bioUrl}
                  onChange={(e) => setBioUrl(e.target.value)}
                  placeholder="Your website, Houzz profile, LinkedIn, etc."
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[var(--folio-gold)]"
                  style={{
                    borderColor: '#E8E4DF',
                    backgroundColor: 'var(--surface-ground)',
                    color: '#2C2825'
                    }}
                />
                <button
                  onClick={handleFetchUrl}
                  disabled={fetchingUrl || !bioUrl.trim()}
                  className="px-4 py-2.5 text-sm rounded-xl transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ border: '1px solid #D4CEC6', color: '#6B635B' }}
                >
                  {fetchingUrl ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Fetch'
                  )}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px" style={{ backgroundColor: '#E8E4DF' }} />
              <span className="text-xs" style={{ color: '#B8B0A6' }}>
                or paste text directly
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: '#E8E4DF' }} />
            </div>

            {/* Text input */}
            <textarea
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              placeholder="Paste your studio's about text here..."
              className="w-full min-h-[200px] px-4 py-3 text-sm rounded-xl border outline-none transition-colors focus:border-[var(--folio-gold)] resize-y leading-relaxed"
              style={{
                borderColor: '#E8E4DF',
                backgroundColor: 'var(--surface-ground)',
                color: '#2C2825'
                }}
            />

            <div className="flex justify-center mt-8">
              <button
                onClick={handleAnalyzeBio}
                disabled={!bioText.trim()}
                className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
              >
                <FileText className="w-4 h-4" />
                Analyze my bio
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step: Analyzing
  if (step === 'analyzing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--surface-ground)' }}>
        <Sparkles className="w-12 h-12 animate-pulse mb-6" style={{ color: 'var(--folio-gold)' }} />
        <h3
          className="text-2xl italic mb-3"
          style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 400 }}
        >
          Analyzing your bio...
        </h3>
        <p className="text-sm" style={{ color: '#8B8178' }}>
          We&apos;re checking what&apos;s already covered.
        </p>
      </div>
    );
  }

  // Step: Coverage Summary
  if (step === 'coverage') {
    const gapCount = coverage.filter((c) => c.depth !== 'full').length;
    const allCovered = gapCount === 0;

    const depthIcon = (depth: string) => {
      switch (depth) {
        case 'full':
          return <Check className="w-4 h-4" style={{ color: 'rgb(34, 197, 94)' }} />;
        case 'partial':
          return (
            <div
              className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
              style={{ borderColor: 'var(--folio-gold)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--folio-gold)' }} />
            </div>
          );
        default:
          return <X className="w-4 h-4" style={{ color: '#D4736C' }} />;
      }
    };

    const depthLabel = (depth: string) => {
      switch (depth) {
        case 'full':
          return 'Covered';
        case 'partial':
          return 'Partially covered';
        default:
          return 'Not found';
      }
    };

    // Map questionId back to a friendly label
    const questionLabel = (questionId: string) => {
      const labels: Record<string, string> = {
        founding: 'How the studio started',
        approach: 'How you approach projects',
        clients: 'Client relationships',
        location: "Where you're based & work",
        work_style: 'Types of work you take on',
        materials: 'Materials & details you use',
        team: 'Studio size & structure',
      };
      return labels[questionId] || questionId;
    };

    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--surface-ground)' }}>
        <div className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: '#E8E4DF' }}>
          <button
            onClick={() => setStep('import-bio')}
            className="p-1 rounded-full transition-colors hover:opacity-70"
            style={{ color: '#8B8178' }}
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span
            className="text-xs px-3 py-1 rounded-full"
            style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
          >
            Bio Analysis
          </span>
          <div className="w-6" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="max-w-lg w-full">
            <h2
              className="text-3xl italic mb-2 text-center"
              style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 400 }}
            >
              {allCovered ? 'Your bio is already pretty complete.' : "Here's what we found in your bio"}
            </h2>

            <div className="mt-8 space-y-3">
              {coverage.map((c) => (
                <div
                  key={c.questionId}
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ backgroundColor: 'rgba(232, 228, 223, 0.4)' }}
                >
                  <div className="flex items-center gap-3">
                    {depthIcon(c.depth)}
                    <span className="text-sm" style={{ color: '#2C2825' }}>
                      {questionLabel(c.questionId)}
                    </span>
                  </div>
                  <span
                    className="text-xs"
                    style={{
                      color: c.depth === 'full' ? 'rgb(34, 197, 94)' : c.depth === 'partial' ? 'var(--folio-gold)' : '#D4736C',
                    }}
                  >
                    {depthLabel(c.depth)}
                  </span>
                </div>
              ))}
            </div>

            <p
              className="text-sm text-center mt-8 mb-6"
              style={{ color: '#8B8178' }}
            >
              {allCovered
                ? "We'll use this to build your profile. You can always refine it after."
                : `We'll ask you ${gapCount} quick follow-up question${gapCount === 1 ? '' : 's'} to fill the gaps.`}
            </p>

            <div className="flex justify-center">
              <button
                onClick={handleCoverageContinue}
                className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
              >
                {allCovered ? 'Build my profile' : 'Continue'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step: Generating
  if (step === 'generating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--surface-ground)' }}>
        <Sparkles className="w-16 h-16 animate-pulse mb-6" style={{ color: 'var(--folio-gold)' }} />
        <h3
          className="text-3xl italic mb-3"
          style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 400 }}
        >
          Crafting your story...
        </h3>
        <p className="text-base mb-6" style={{ color: '#8B8178' }}>
          We&apos;re generating your bio and populating your profile from what you shared.
        </p>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#8B8178' }} />
      </div>
    );
  }

  // Step: Complete
  if (step === 'complete') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--surface-ground)' }}>
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
        <p className="text-base mb-8 text-center max-w-md" style={{ color: '#8B8178' }}>
          We&apos;ve populated your profile from {bioImportType !== 'FRESH' ? 'your bio and follow-up answers' : 'your answers'}. Review and fine-tune anything you&apos;d like.
        </p>
        <button
          onClick={handleFinish}
          className="px-8 py-3 rounded-full text-sm font-medium transition-all hover:opacity-90"
          style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
        >
          Review Profile
        </button>
      </div>
    );
  }

  // Step: Interview (gap questions or full)
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--surface-ground)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: '#E8E4DF' }}>
        <button
          onClick={() => {
            if (bioImportType !== 'FRESH' && currentIndex === 0) {
              setStep('coverage');
            } else {
              router.back();
            }
          }}
          className="p-1 rounded-full transition-colors hover:opacity-70"
          style={{ color: '#8B8178' }}
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3">
          <span
            className="text-xs px-3 py-1 rounded-full"
            style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
          >
            {bioImportType !== 'FRESH' ? 'Follow-up' : `About ${orgName}`}
          </span>
          <span className="text-sm" style={{ color: '#8B8178' }}>
            Question {currentIndex + 1} of {activeQuestions.length}
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
              {getQuestionText(currentQuestion)}
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
                  color: '#2C2825'
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
          <span>Back</span>
        </button>

        <button
          onClick={handleNext}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
        >
          <span>
            {currentIndex === activeQuestions.length - 1 ? 'Generate Profile' : 'Continue'}
          </span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
