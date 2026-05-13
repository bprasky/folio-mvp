'use client';

import { useState, useCallback } from 'react';
import WebsiteImportCard from './WebsiteImportCard';
import BioInterviewModal from './BioInterviewModal';
import BioPreview from './BioPreview';
import type { DesignerBioData } from '@/app/designer/profile/types';

type FlowStep = 'choose' | 'interview' | 'preview' | 'published';

interface BioSetupFlowProps {
  designerBio: DesignerBioData | null;
  userWebsite: string | null;
  onPublished: () => void;
}

function resolveInitialStep(bio: DesignerBioData | null): FlowStep {
  if (!bio || bio.status === 'empty') return 'choose';
  if (bio.status === 'scraped') return 'interview';
  if (bio.status === 'interviewing') return 'interview';
  if (bio.status === 'generated') return 'preview';
  if (bio.status === 'published') return 'published';
  return 'choose';
}

export default function BioSetupFlow({ designerBio, userWebsite, onPublished }: BioSetupFlowProps) {
  const [step, setStep] = useState<FlowStep>(() => resolveInitialStep(designerBio));
  const [folioBio, setFolioBio] = useState(designerBio?.folioBio || null);

  const handleWebsiteImported = useCallback(() => {
    setStep('interview');
  }, []);

  const handleSkipWebsite = useCallback(() => {
    setStep('interview');
  }, []);

  const handleInterviewComplete = useCallback(async () => {
    // Fetch the generated bio
    try {
      const res = await fetch('/api/designer/bio');
      const data = await res.json();
      setFolioBio(data.bio?.folioBio || null);
    } catch {
      // Fall through — preview will handle empty state
    }
    setStep('preview');
  }, []);

  const handlePublished = useCallback(() => {
    setStep('published');
    onPublished();
  }, [onPublished]);

  if (step === 'choose') {
    return (
      <div className="bio-setup">
        <div className="bio-setup-header">
          <h3 className="bio-setup-title">Set up your About page</h3>
          <p className="bio-setup-desc">
            Share your story, philosophy, and process. We&rsquo;ll interview you and craft an editorial bio.
          </p>
        </div>

        <div className="bio-setup-cards">
          <WebsiteImportCard
            defaultUrl={userWebsite}
            onImported={handleWebsiteImported}
            onSkip={handleSkipWebsite}
          />

          <button onClick={handleSkipWebsite} className="bio-setup-scratch-btn">
            <div className="bio-card-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="bio-card-title">Tell us your story</span>
            <span className="bio-card-desc">
              Answer a few questions and we&rsquo;ll write your bio — no website needed.
            </span>
          </button>
        </div>

        {designerBio && designerBio.answerCount > 0 && (
          <div className="bio-setup-resume">
            <button onClick={() => setStep('interview')} className="bio-setup-resume-btn">
              Continue your interview ({designerBio.answerCount} answer{designerBio.answerCount !== 1 ? 's' : ''} so far)
            </button>
          </div>
        )}

        <style jsx>{`
          .bio-setup {
            max-width: 600px;
            margin: 0 auto;
          }
          .bio-setup-header {
            text-align: center;
            margin-bottom: 32px;
          }
          .bio-setup-title {
            font-family: var(--font-headline);
            font-size: 24px;
            font-weight: 500;
            color: var(--text-primary);
            margin: 0 0 8px;
          }
          .bio-setup-desc {
            font-family: var(--font-body);
            font-size: 15px;
            color: var(--text-secondary);
            margin: 0;
            line-height: 1.5;
          }
          .bio-setup-cards {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .bio-setup-scratch-btn {
            padding: 32px;
            border-radius: 12px;
            background: var(--surface-canvas);
            border: 1px solid var(--border);
            text-align: center;
            cursor: pointer;
            transition: border-color 0.15s;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .bio-setup-scratch-btn:hover {
            border-color: var(--text-tertiary);
          }
          .bio-card-icon {
            color: var(--text-tertiary);
            margin-bottom: 16px;
          }
          .bio-card-title {
            font-family: var(--font-headline);
            font-size: 18px;
            font-weight: 500;
            color: var(--text-primary);
            margin-bottom: 8px;
          }
          .bio-card-desc {
            font-family: var(--font-body);
            font-size: 14px;
            color: var(--text-secondary);
            line-height: 1.5;
          }
          .bio-setup-resume {
            text-align: center;
            margin-top: 20px;
          }
          .bio-setup-resume-btn {
            background: none;
            border: none;
            color: var(--accent);
            font-family: var(--font-body);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: underline;
            text-underline-offset: 2px;
          }
        `}</style>
      </div>
    );
  }

  if (step === 'interview') {
    return (
      <BioInterviewModal
        onComplete={handleInterviewComplete}
        onClose={() => setStep('choose')}
      />
    );
  }

  if (step === 'preview') {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <BioPreview initialBio={folioBio} onPublished={handlePublished} />
      </div>
    );
  }

  // published — parent will handle showing the real AboutTab content
  return null;
}
