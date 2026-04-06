"use client";
import clsx from "clsx";

type Props = {
  projectCount: number;
  hasBrandAssets: boolean;
  hasAestheticProfile: boolean;
};

export default function ProfileProgressIndicator({
  projectCount,
  hasBrandAssets,
  hasAestheticProfile,
}: Props) {
  const steps = [
    {
      label: "Projects",
      done: projectCount >= 2,
      partial: projectCount === 1,
      detail:
        projectCount === 0
          ? "Add 2+ projects"
          : projectCount === 1
          ? "1 of 2"
          : `${projectCount} projects`,
    },
    {
      label: "Brand",
      done: hasBrandAssets,
      detail: hasBrandAssets ? "Complete" : "Optional but recommended",
    },
    {
      label: "Profile Generated",
      done: hasAestheticProfile,
      detail: hasAestheticProfile ? "Live" : "Unlocks at 2 projects",
    },
  ];

  const completedSteps = steps.filter((s) => s.done).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-surface-canvas rounded-2xl shadow-xl border border-folio-border-subtle p-4 w-72">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-folio-text-primary">
            Profile Completion
          </span>
          <span className="text-sm text-folio-text-secondary">{Math.round(progress)}%</span>
        </div>

        <div className="h-1.5 bg-surface-ground rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-[var(--text-primary)] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className={clsx(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs",
                  step.done
                    ? "bg-green-500 text-white"
                    : step.partial
                    ? "bg-amber-500 text-white"
                    : "bg-surface-ground text-folio-text-tertiary"
                )}
              >
                {step.done ? "✓" : step.partial ? "½" : i + 1}
              </div>
              <div className="flex-1">
                <p
                  className={clsx(
                    "text-sm",
                    step.done ? "text-folio-text-primary" : "text-folio-text-secondary"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-folio-text-tertiary">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


