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
    <div className={cn("liquid-glass-muted p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-[#1a1a1a]">
            Getting Started
          </h3>
          <p className="text-sm text-[#666] mt-0.5">
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
                  ? "bg-[#1a1a1a] shadow-[0_0_8px_rgba(26,26,26,0.3)]"
                  : "bg-[#ddd]"
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
                "relative p-4 liquid-step",
                step.completed && "completed"
              )}
            >
              {/* Completion badge */}
              {step.completed && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1a1a1a] flex items-center justify-center shadow-[0_2px_8px_rgba(26,26,26,0.3)]">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}

              {/* Step number */}
              <div className="text-xs text-[#888] font-medium mb-2">
                Step {i + 1}
              </div>

              {/* Icon */}
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-all duration-300",
                step.completed
                  ? "bg-[#1a1a1a] shadow-[0_4px_12px_rgba(26,26,26,0.2)]"
                  : "bg-white/70"
              )}>
                <StepIcon className={cn(
                  "h-4 w-4",
                  step.completed ? "text-white" : "text-[#5C5C57]"
                )} />
              </div>

              {/* Title & description */}
              <h4 className={cn(
                "text-sm font-medium mb-0.5 transition-colors",
                step.completed ? "text-[#1a1a1a]" : "text-[#666]"
              )}>
                {step.title}
              </h4>
              <p className="text-xs text-[#888] leading-snug">
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
