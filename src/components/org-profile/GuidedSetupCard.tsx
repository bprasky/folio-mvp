'use client';

import Link from 'next/link';

interface SetupState {
  profileComplete: boolean;
  recognitionComplete: boolean;
  teamInviteComplete: boolean;
  firstProjectPublished: boolean;
}

interface GuidedSetupCardProps {
  orgId: string;
  setupState: SetupState;
  onOpenRecognitionModal: () => void;
  onOpenInviteModal: () => void;
}

interface StepConfig {
  key: keyof SetupState;
  title: string;
  description: string;
  completeSummary: string;
  cta: {
    label: string;
    type: 'link' | 'button';
    href?: string;
    onClick?: () => void;
  };
}

export default function GuidedSetupCard({
  orgId,
  setupState,
  onOpenRecognitionModal,
  onOpenInviteModal,
}: GuidedSetupCardProps) {
  const steps: StepConfig[] = [
    {
      key: 'profileComplete',
      title: 'Complete your studio profile',
      description:
        'Photo, bio, location, and specialties \u2014 this is what designers and vendors see first.',
      completeSummary: 'Studio profile complete',
      cta: {
        label: 'Edit Profile',
        type: 'link',
        href: `/org/${orgId}/settings`,
      },
    },
    {
      key: 'recognitionComplete',
      title: 'Add your recognitions',
      description:
        'Published in a magazine? Won an award? Add links and they\u2019ll appear in your feed.',
      completeSummary: 'Recognitions added',
      cta: {
        label: 'Add Recognition',
        type: 'button',
        onClick: onOpenRecognitionModal,
      },
    },
    {
      key: 'teamInviteComplete',
      title: 'Invite your team',
      description:
        'Bring your associates and partners into your studio on Folio.',
      completeSummary: 'Team invites sent',
      cta: {
        label: 'Invite Team',
        type: 'button',
        onClick: onOpenInviteModal,
      },
    },
    {
      key: 'firstProjectPublished',
      title: 'Create your first project',
      description:
        'Upload your project photos and Folio will generate magazine-quality editorial content.',
      completeSummary: 'First project published',
      cta: {
        label: '+ Create Project',
        type: 'link',
        href: '/designer/create',
      },
    },
  ];

  // Find the first incomplete step to highlight
  const firstIncompleteIndex = steps.findIndex((s) => !setupState[s.key]);

  return (
    <div
      className="glass-overlay rounded-[20px] p-8 md:p-10"
    >
      {/* Headline */}
      <h2
        className="text-3xl md:text-4xl italic mb-2"
        style={{
          fontFamily: 'var(--font-headline)',
          color: '#2C2825',
          fontWeight: 400,
        }}
      >
        Welcome to Folio
      </h2>

      {/* Subtext */}
      <p
        className="text-sm md:text-base mb-8"
        style={{
          fontFamily: 'var(--font-body)',
          color: '#6B635B',
          lineHeight: 1.6,
        }}
      >
        Your profile is your portfolio&apos;s front door.
        <br />A few things to get you started.
      </p>

      {/* Steps */}
      <div className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const isComplete = setupState[step.key];
          const isNext = index === firstIncompleteIndex;

          return (
            <StepRow
              key={step.key}
              step={step}
              isComplete={isComplete}
              isNext={isNext}
            />
          );
        })}
      </div>
    </div>
  );
}

function StepRow({
  step,
  isComplete,
  isNext,
}: {
  step: StepConfig;
  isComplete: boolean;
  isNext: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5 transition-all"
      style={{
        background: isNext
          ? 'rgba(255, 255, 255, 0.9)'
          : 'rgba(255, 255, 255, 0.6)',
        border: isNext
          ? '1px solid rgba(184, 132, 92, 0.2)'
          : '1px solid rgba(232, 228, 223, 0.5)',
        borderLeft: isNext
          ? '3px solid var(--folio-gold)'
          : '1px solid rgba(232, 228, 223, 0.5)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div className="flex-shrink-0 mt-0.5">
          {isComplete ? (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
              style={{ backgroundColor: 'rgba(184, 132, 92, 0.15)', color: 'var(--folio-gold)' }}
            >
              &#10003;
            </div>
          ) : (
            <div
              className="w-5 h-5 rounded-full border-2"
              style={{ borderColor: isNext ? 'var(--folio-gold)' : '#D4CEC6' }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium"
            style={{
              fontFamily: 'var(--font-body)',
              color: isComplete ? '#8B8178' : '#2C2825',
            }}
          >
            {isComplete ? step.completeSummary : step.title}
          </p>

          {!isComplete && (
            <p
              className="text-xs mt-1"
              style={{
                fontFamily: 'var(--font-body)',
                color: '#8B8178',
                lineHeight: 1.5,
              }}
            >
              {step.description}
            </p>
          )}
        </div>

        {/* CTA */}
        {!isComplete && (
          <div className="flex-shrink-0">
            {step.cta.type === 'link' ? (
              <Link
                href={step.cta.href!}
                className="px-4 py-1.5 text-xs rounded-full transition-all hover:opacity-80"
                style={{
                  backgroundColor: isNext ? '#2C2825' : 'transparent',
                  color: isNext ? '#FAF9F7' : '#6B635B',
                  border: isNext ? 'none' : '1px solid #D4CEC6',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                {step.cta.label}
              </Link>
            ) : (
              <button
                onClick={step.cta.onClick}
                className="px-4 py-1.5 text-xs rounded-full transition-all hover:opacity-80"
                style={{
                  backgroundColor: isNext ? '#2C2825' : 'transparent',
                  color: isNext ? '#FAF9F7' : '#6B635B',
                  border: isNext ? 'none' : '1px solid #D4CEC6',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                {step.cta.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
