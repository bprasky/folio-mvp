'use client';

import { cn } from '@/lib/utils';

type Status =
  | 'INVITED'
  | 'DECLINED'
  | 'ACCEPTED'
  | 'ROUND1_VENDOR'
  | 'ROUND1_DESIGNER'
  | 'ROUND1_COMPLETE'
  | 'ROUND2_VENDOR'
  | 'ROUND2_DESIGNER'
  | 'ROUND2_COMPLETE'
  | 'ROUND3_VENDOR'
  | 'ROUND3_DESIGNER'
  | 'ROUND3_COMPLETE'
  | 'GENERATING'
  | 'REVIEW'
  | 'VENDOR_APPROVED'
  | 'DESIGNER_APPROVED'
  | 'PUBLISHED'
  | 'ARCHIVED';

interface CollaborationProgressProps {
  status: Status;
  role: 'vendor' | 'designer';
  vendorName: string;
  designerName: string;
  className?: string;
}

interface Step {
  id: string;
  label: string;
  vendorStatus: 'waiting' | 'active' | 'complete';
  designerStatus: 'waiting' | 'active' | 'complete';
}

function getSteps(status: Status): Step[] {
  const steps: Step[] = [
    { id: 'invite', label: 'Invitation', vendorStatus: 'complete', designerStatus: 'waiting' },
    { id: 'round1', label: 'Round 1', vendorStatus: 'waiting', designerStatus: 'waiting' },
    { id: 'round2', label: 'Round 2', vendorStatus: 'waiting', designerStatus: 'waiting' },
    { id: 'round3', label: 'Round 3', vendorStatus: 'waiting', designerStatus: 'waiting' },
    { id: 'generate', label: 'Generate', vendorStatus: 'waiting', designerStatus: 'waiting' },
    { id: 'review', label: 'Review', vendorStatus: 'waiting', designerStatus: 'waiting' },
    { id: 'publish', label: 'Publish', vendorStatus: 'waiting', designerStatus: 'waiting' },
  ];

  // Update steps based on current status
  switch (status) {
    case 'INVITED':
      steps[0].designerStatus = 'active';
      break;
    case 'DECLINED':
      steps[0].designerStatus = 'complete';
      break;
    case 'ACCEPTED':
      steps[0].designerStatus = 'complete';
      steps[1].vendorStatus = 'active';
      steps[1].designerStatus = 'active';
      break;
    case 'ROUND1_VENDOR':
      steps[0].designerStatus = 'complete';
      steps[1].vendorStatus = 'active';
      steps[1].designerStatus = 'waiting';
      break;
    case 'ROUND1_DESIGNER':
      steps[0].designerStatus = 'complete';
      steps[1].vendorStatus = 'complete';
      steps[1].designerStatus = 'active';
      break;
    case 'ROUND1_COMPLETE':
      steps[0].designerStatus = 'complete';
      steps[1].vendorStatus = 'complete';
      steps[1].designerStatus = 'complete';
      steps[2].vendorStatus = 'active';
      steps[2].designerStatus = 'active';
      break;
    case 'ROUND2_VENDOR':
      steps[0].designerStatus = 'complete';
      steps[1].vendorStatus = 'complete';
      steps[1].designerStatus = 'complete';
      steps[2].vendorStatus = 'active';
      steps[2].designerStatus = 'waiting';
      break;
    case 'ROUND2_DESIGNER':
      steps[0].designerStatus = 'complete';
      steps[1].vendorStatus = 'complete';
      steps[1].designerStatus = 'complete';
      steps[2].vendorStatus = 'complete';
      steps[2].designerStatus = 'active';
      break;
    case 'ROUND2_COMPLETE':
      steps[0].designerStatus = 'complete';
      steps[1].vendorStatus = 'complete';
      steps[1].designerStatus = 'complete';
      steps[2].vendorStatus = 'complete';
      steps[2].designerStatus = 'complete';
      steps[3].vendorStatus = 'active';
      steps[3].designerStatus = 'active';
      break;
    case 'ROUND3_VENDOR':
      steps.slice(0, 3).forEach((s) => {
        s.vendorStatus = 'complete';
        s.designerStatus = 'complete';
      });
      steps[3].vendorStatus = 'active';
      steps[3].designerStatus = 'waiting';
      break;
    case 'ROUND3_DESIGNER':
      steps.slice(0, 3).forEach((s) => {
        s.vendorStatus = 'complete';
        s.designerStatus = 'complete';
      });
      steps[3].vendorStatus = 'complete';
      steps[3].designerStatus = 'active';
      break;
    case 'ROUND3_COMPLETE':
      steps.slice(0, 4).forEach((s) => {
        s.vendorStatus = 'complete';
        s.designerStatus = 'complete';
      });
      steps[4].vendorStatus = 'active';
      steps[4].designerStatus = 'active';
      break;
    case 'GENERATING':
      steps.slice(0, 4).forEach((s) => {
        s.vendorStatus = 'complete';
        s.designerStatus = 'complete';
      });
      steps[4].vendorStatus = 'active';
      steps[4].designerStatus = 'active';
      break;
    case 'REVIEW':
      steps.slice(0, 5).forEach((s) => {
        s.vendorStatus = 'complete';
        s.designerStatus = 'complete';
      });
      steps[5].vendorStatus = 'active';
      steps[5].designerStatus = 'active';
      break;
    case 'VENDOR_APPROVED':
      steps.slice(0, 5).forEach((s) => {
        s.vendorStatus = 'complete';
        s.designerStatus = 'complete';
      });
      steps[5].vendorStatus = 'complete';
      steps[5].designerStatus = 'active';
      break;
    case 'DESIGNER_APPROVED':
      steps.slice(0, 5).forEach((s) => {
        s.vendorStatus = 'complete';
        s.designerStatus = 'complete';
      });
      steps[5].vendorStatus = 'active';
      steps[5].designerStatus = 'complete';
      break;
    case 'PUBLISHED':
    case 'ARCHIVED':
      steps.forEach((s) => {
        s.vendorStatus = 'complete';
        s.designerStatus = 'complete';
      });
      break;
  }

  return steps;
}

export function CollaborationProgress({
  status,
  role,
  vendorName,
  designerName,
  className,
}: CollaborationProgressProps) {
  const steps = getSteps(status);

  return (
    <div className={cn('bg-surface-canvas rounded-xl border border-neutral-200 p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-neutral-900">Progress</h3>
        <span
          className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            status === 'PUBLISHED'
              ? 'bg-green-100 text-green-700'
              : status === 'DECLINED'
              ? 'bg-red-100 text-red-700'
              : status === 'ARCHIVED'
              ? 'bg-neutral-100 text-neutral-700'
              : 'bg-[var(--accent)]/10 text-[var(--accent-hover)]'
          )}
        >
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--accent)]" />
          <span className="text-neutral-600">{vendorName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-neutral-600">{designerName}</span>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3">
            {/* Step number */}
            <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-medium text-neutral-500">
              {index + 1}
            </div>

            {/* Step label */}
            <div className="flex-1">
              <span className="text-sm text-neutral-700">{step.label}</span>
            </div>

            {/* Status indicators */}
            <div className="flex items-center gap-1">
              {/* Vendor status */}
              <div
                className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center',
                  step.vendorStatus === 'complete'
                    ? 'bg-[var(--accent)]'
                    : step.vendorStatus === 'active'
                    ? 'bg-blue-200 animate-pulse'
                    : 'bg-neutral-200'
                )}
              >
                {step.vendorStatus === 'complete' && (
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* Designer status */}
              <div
                className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center',
                  step.designerStatus === 'complete'
                    ? 'bg-purple-500'
                    : step.designerStatus === 'active'
                    ? 'bg-purple-200 animate-pulse'
                    : 'bg-neutral-200'
                )}
              >
                {step.designerStatus === 'complete' && (
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Current action hint */}
      <div className="mt-6 pt-4 border-t border-neutral-100">
        <p className="text-sm text-neutral-600">
          {getActionHint(status, role)}
        </p>
      </div>
    </div>
  );
}

function getActionHint(status: Status, role: 'vendor' | 'designer'): string {
  switch (status) {
    case 'INVITED':
      return role === 'vendor'
        ? 'Waiting for designer to respond...'
        : 'You have a pending invitation to review.';
    case 'DECLINED':
      return 'This collaboration was declined.';
    case 'ACCEPTED':
      return 'Both parties can start Round 1 questions.';
    case 'ROUND1_VENDOR':
      return role === 'vendor'
        ? 'Complete your Round 1 questions.'
        : 'Vendor is working on Round 1. You can start yours too!';
    case 'ROUND1_DESIGNER':
      return role === 'designer'
        ? 'Complete your Round 1 questions.'
        : 'Designer is working on Round 1. Vendor has completed.';
    case 'ROUND1_COMPLETE':
      return 'Round 1 complete! Move on to Round 2.';
    case 'ROUND2_VENDOR':
    case 'ROUND2_DESIGNER':
      return 'Answer the personalized follow-up questions.';
    case 'ROUND2_COMPLETE':
      return 'Round 2 complete! Time for the cross-dialogue.';
    case 'ROUND3_VENDOR':
    case 'ROUND3_DESIGNER':
      return 'Respond to what your partner shared.';
    case 'ROUND3_COMPLETE':
      return 'All rounds complete! Ready to generate the story.';
    case 'GENERATING':
      return 'AI is assembling your narrative...';
    case 'REVIEW':
      return 'Review the generated story and approve.';
    case 'VENDOR_APPROVED':
      return role === 'vendor'
        ? 'You approved! Waiting for designer approval.'
        : 'Vendor approved. Please review and approve.';
    case 'DESIGNER_APPROVED':
      return role === 'designer'
        ? 'You approved! Waiting for vendor approval.'
        : 'Designer approved. Please review and approve.';
    case 'PUBLISHED':
      return 'Your collaboration story is live!';
    case 'ARCHIVED':
      return 'This story has been archived.';
    default:
      return '';
  }
}
