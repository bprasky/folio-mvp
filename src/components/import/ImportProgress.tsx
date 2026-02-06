'use client';

import { cn } from '@/lib/utils';

type ImportStep = 'source' | 'upload' | 'processing' | 'review';

interface ImportProgressProps {
  step: ImportStep;
  className?: string;
}

const steps: { key: ImportStep; label: string }[] = [
  { key: 'source', label: 'Source' },
  { key: 'upload', label: 'Upload' },
  { key: 'processing', label: 'Processing' },
  { key: 'review', label: 'Review' },
];

export function ImportProgress({ step, className }: ImportProgressProps) {
  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className={cn('flex items-center justify-center space-x-2', className)}>
      {steps.map((s, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={s.key} className="flex items-center">
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                {
                  'bg-emerald-500 text-white': isCompleted,
                  'bg-[var(--accent)] text-white': isCurrent,
                  'bg-stone-200 text-stone-500': !isCompleted && !isCurrent,
                }
              )}
            >
              {isCompleted ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            <span
              className={cn('ml-2 text-sm hidden sm:inline', {
                'text-stone-900 font-medium': isCurrent,
                'text-stone-500': !isCurrent,
              })}
            >
              {s.label}
            </span>
            {index < steps.length - 1 && (
              <div
                className={cn('w-8 h-0.5 mx-2', {
                  'bg-emerald-500': isCompleted,
                  'bg-stone-200': !isCompleted,
                })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
