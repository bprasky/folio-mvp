import { cn } from '@/lib/utils';
import { OnboardingProgress } from './OnboardingProgress';

interface OnboardingShellProps {
  step: 'diagnostic' | 'firm' | 'bio' | 'profile-preview';
  prompt: string;
  children: React.ReactNode;
  containerClassName?: string;
}

// Shared chrome for the four onboarding steps. Warm Ground canvas, editorial
// prompt in Cormorant Garamond, progress dots fixed at the bottom.
export function OnboardingShell({
  step,
  prompt,
  children,
  containerClassName,
}: OnboardingShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-surface-ground">
      <div className="absolute top-6 left-6">
        <span className="folio-logo-text text-folio-text-tertiary">Folio</span>
      </div>

      <div className="flex-1 flex items-start justify-center px-6 py-16 md:py-24">
        <div className={cn('w-full max-w-2xl space-y-10', containerClassName)}>
          <h1 className="folio-quote text-3xl md:text-4xl text-center text-folio-text-primary">
            {prompt}
          </h1>
          {children}
        </div>
      </div>

      <OnboardingProgress current={step} />
    </div>
  );
}
