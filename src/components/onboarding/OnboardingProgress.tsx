import { cn } from '@/lib/utils';

const STEP_ORDER = ['diagnostic', 'firm', 'bio', 'profile-preview'] as const;
type ProgressStep = (typeof STEP_ORDER)[number];

interface OnboardingProgressProps {
  current: ProgressStep;
}

// Four-dot indicator matching the existing /onboarding visual language
// (see src/app/onboarding/page.tsx). Current step extends to a gold pill;
// completed steps are filled tertiary; upcoming steps are subtle ridge.
export function OnboardingProgress({ current }: OnboardingProgressProps) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <div className="flex justify-center pb-12">
      <div className="flex items-center gap-2">
        {STEP_ORDER.map((step, idx) => (
          <div
            key={step}
            aria-hidden
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              idx === currentIndex
                ? 'w-8 bg-[var(--accent)]'
                : idx < currentIndex
                ? 'w-2 bg-[var(--text-tertiary)]'
                : 'w-2 bg-[var(--ridge-outer)]'
            )}
          />
        ))}
      </div>
    </div>
  );
}
