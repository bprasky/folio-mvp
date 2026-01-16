'use client';

import { Upload, Tag, Mic, Share2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuideStep {
  icon: React.ElementType;
  title: string;
  description: string;
  completed?: boolean;
}

interface GuideCardProps {
  /** Number of projects user has created */
  projectCount?: number;
  /** Number of products tagged */
  taggedCount?: number;
  /** Whether user has completed an interview */
  hasInterviewed?: boolean;
  /** Number of published projects */
  publishedCount?: number;
  /** Optional className */
  className?: string;
}

/**
 * GuideCard - Workflow guide for designers
 *
 * Shows the four-step workflow: Upload -> Tag -> Interview -> Publish
 * Steps show completion state based on user's progress
 *
 * Uses liquid glass muted styling with liquid step cards.
 */
export function GuideCard({
  projectCount = 0,
  taggedCount = 0,
  hasInterviewed = false,
  publishedCount = 0,
  className,
}: GuideCardProps) {
  const steps: GuideStep[] = [
    {
      icon: Upload,
      title: 'Upload',
      description: 'Add your completed project photos',
      completed: projectCount > 0,
    },
    {
      icon: Tag,
      title: 'Tag Products',
      description: 'Tag the products in your images',
      completed: taggedCount > 0,
    },
    {
      icon: Mic,
      title: 'AI Interview',
      description: 'Let AI capture your design story',
      completed: hasInterviewed,
    },
    {
      icon: Share2,
      title: 'Publish',
      description: 'Share with the design community',
      completed: publishedCount > 0,
    },
  ];

  const completedSteps = steps.filter(s => s.completed).length;
  const allCompleted = completedSteps === steps.length;

  return (
    <div className={cn("ridge-card p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="folio-h3 text-[var(--text-primary)]">
            Getting Started
          </h3>
          <p className="folio-meta mt-0.5">
            {allCompleted
              ? 'You have completed all steps'
              : `${completedSteps} of ${steps.length} steps complete`}
          </p>
        </div>
        {/* Progress indicator */}
        <div className="flex items-center gap-1.5">
          {steps.map((step, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                step.completed
                  ? "bg-[var(--text-primary)] shadow-[0_0_8px_rgba(26,26,26,0.3)]"
                  : "bg-[var(--ridge-outer)]"
              )}
            />
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          return (
            <div
              key={i}
              className={cn(
                "relative p-4 ridge-card ridge-card-sm",
                step.completed && "ring-2 ring-[var(--accent)]/20"
              )}
            >
              {/* Completion badge */}
              {step.completed && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-[0_2px_8px_rgba(184,132,92,0.3)]">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}

              {/* Step number */}
              <div className="folio-meta mb-2">
                Step {i + 1}
              </div>

              {/* Icon */}
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-all duration-300",
                step.completed
                  ? "bg-[var(--accent)] shadow-[0_4px_12px_rgba(184,132,92,0.2)]"
                  : "bg-[var(--bg-elevated)]"
              )}>
                <StepIcon className={cn(
                  "h-4 w-4",
                  step.completed ? "text-white" : "text-[var(--text-secondary)]"
                )} />
              </div>

              {/* Title & description */}
              <h4 className={cn(
                "folio-ui font-medium mb-0.5 transition-colors",
                step.completed ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
              )}>
                {step.title}
              </h4>
              <p className="folio-meta leading-snug">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GuideCard;
