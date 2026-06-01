'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  Gate,
  CtaAction,
  PublishReadiness,
} from '@/lib/publish/computePublishReadiness';

const STEPS: Array<{ key: Gate; label: string }> = [
  { key: 'photos', label: 'Photos' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'tags', label: 'Tags' },
  { key: 'story', label: 'Story' },
  { key: 'publish', label: 'Publish' },
];

interface PublishSpineProps {
  readiness: PublishReadiness;
  /** Dispatches the single CTA action. The page owns the actual handlers. */
  onAction: (action: CtaAction) => void;
  /** Secondary text action, only meaningful while the Story gate is current. */
  onSkipStory?: () => void;
  isBusy?: boolean;
}

/**
 * PublishSpine — the legible, gated spine. One primary action at any moment;
 * its label is always the next incomplete gate. Spec 20 §2, §5, §9.
 *
 * Sits on white-background chrome (glass-sticky + warm mesh allowed). Never
 * over a photo.
 */
export default function PublishSpine({
  readiness,
  onAction,
  onSkipStory,
  isBusy = false,
}: PublishSpineProps) {
  const { gates, nextGate, ctaLabel, ctaAction, statusLine } = readiness;
  const showSkipStory = ctaAction === 'startInterview' && !!onSkipStory;

  return (
    <div className="sticky top-0 z-30 -mx-10 px-10 mb-6">
      <div className="glass-sticky warm-mesh rounded-b-2xl border border-folio-border-subtle border-t-0 px-6 py-4">
        <div className="relative z-[1] flex flex-wrap items-center justify-between gap-4">
          {/* Step rail + status line */}
          <div className="min-w-0">
            <StepRail gates={gates} current={nextGate} />
            <p className="mt-2 folio-meta text-folio-text-secondary tabular-nums">
              {statusLine}
            </p>
          </div>

          {/* Single primary CTA */}
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={() => onAction(ctaAction)}
              disabled={isBusy}
              className="px-6 py-3 folio-ui font-semibold text-white bg-[var(--accent)] rounded-2xl hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
            >
              {isBusy ? 'Working…' : ctaLabel}
            </button>
            {showSkipStory && (
              <button
                onClick={onSkipStory}
                className="folio-meta text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
              >
                Skip story for now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepRail({
  gates,
  current,
}: {
  gates: PublishReadiness['gates'];
  current: Gate;
}) {
  return (
    <ol className="flex items-center gap-1.5 flex-wrap">
      {STEPS.map((step, i) => {
        const complete = gates[step.key].complete;
        const isCurrent = step.key === current && !complete;
        return (
          <li key={step.key} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-folio-text-tertiary/60 text-xs" aria-hidden>
                ·
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-medium transition-colors',
                complete && 'text-[var(--folio-gold)]',
                isCurrent &&
                  'text-[var(--folio-gold)] border-b-2 border-[var(--folio-gold)] pb-0.5',
                !complete && !isCurrent && 'text-folio-text-tertiary',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {complete && (
                <Check className="w-3.5 h-3.5 text-[var(--folio-gold)]" aria-hidden />
              )}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
