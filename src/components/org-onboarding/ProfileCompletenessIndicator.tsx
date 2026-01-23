'use client';

import { CheckCircle2, Circle } from 'lucide-react';

interface ProfileCompletenessProps {
  progress: {
    bioInterviewComplete: boolean;
    studioDetailsComplete: boolean;
    teamSetupComplete: boolean;
    processComplete: boolean;
    recognitionComplete: boolean;
    pinnedWorkComplete: boolean;
  };
}

const STEPS = [
  { key: 'bioInterviewComplete', label: 'Bio interview' },
  { key: 'studioDetailsComplete', label: 'Studio details' },
  { key: 'teamSetupComplete', label: 'Team members' },
  { key: 'processComplete', label: 'Design process' },
  { key: 'recognitionComplete', label: 'Recognition & press' },
  { key: 'pinnedWorkComplete', label: 'Featured work' }
] as const;

export function ProfileCompletenessIndicator({ progress }: ProfileCompletenessProps) {
  const completed = STEPS.filter((step) => progress[step.key]).length;
  const percentage = Math.round((completed / STEPS.length) * 100);

  return (
    <div
      className="space-y-4 p-4 rounded-lg"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Profile Completeness</span>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {percentage}%
        </span>
      </div>

      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{
            width: `${percentage}%`,
            backgroundColor: percentage === 100 ? 'rgb(34, 197, 94)' : 'var(--accent)'
          }}
        />
      </div>

      <div className="space-y-2">
        {STEPS.map((step) => (
          <div key={step.key} className="flex items-center gap-2 text-sm">
            {progress[step.key] ? (
              <CheckCircle2 className="w-4 h-4" style={{ color: 'rgb(34, 197, 94)' }} />
            ) : (
              <Circle className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            )}
            <span style={{ color: progress[step.key] ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
