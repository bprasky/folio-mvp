'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface TourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  {
    id: 'step-1',
    target: '[data-tour="meeting-notes-tab"]',
    title: 'Meeting Notes',
    description:
      'In a real workflow, you would upload your client meeting notes here. These notes help our AI understand the project context.',
    position: 'bottom',
  },
  {
    id: 'step-2',
    target: '[data-tour="meeting-notes-content"]',
    title: 'Add Your Notes',
    description:
      'You can add notes manually, upload transcripts, or connect external sources. The AI will process these to understand your project.',
    position: 'right',
  },
  {
    id: 'step-3',
    target: '[data-tour="project-understanding"]',
    title: 'Project Understanding',
    description:
      'After processing your notes, the AI generates a project understanding with mood keywords, style tags, and room-specific insights.',
    position: 'left',
  },
  {
    id: 'step-4',
    target: '[data-tour="refresh-button"]',
    title: 'Refresh Understanding',
    description:
      'Click this button to process all meeting notes and update the project understanding. The AI analyzes patterns and extracts key information.',
    position: 'left',
  },
];

export default function DemoTour() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const demoTour = searchParams.get('demoTour');
    if (demoTour === 'events-to-project-1') {
      setIsActive(true);
      setCurrentStep(0);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isActive || currentStep === null) return;

    const step = tourSteps[currentStep];
    if (!step) {
      // Tour complete
      setIsActive(false);
      setCurrentStep(null);
      // Remove query parameter
      const params = new URLSearchParams(searchParams.toString());
      params.delete('demoTour');
      router.replace(`?${params.toString()}`);
      return;
    }

    // Wait for target element to be available
    const checkElement = setInterval(() => {
      const element = document.querySelector(step.target);
      if (element) {
        clearInterval(checkElement);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    return () => clearInterval(checkElement);
  }, [currentStep, isActive, searchParams, router]);

  const handleNext = () => {
    if (currentStep !== null && currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // End tour
      setIsActive(false);
      setCurrentStep(null);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('demoTour');
      router.replace(`?${params.toString()}`);
    }
  };

  const handleSkip = () => {
    setIsActive(false);
    setCurrentStep(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('demoTour');
    router.replace(`?${params.toString()}`);
  };

  if (!isActive || currentStep === null) return null;

  const step = tourSteps[currentStep];
  if (!step) return null;

  const element = document.querySelector(step.target);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  const position = step.position || 'bottom';

  let tooltipStyle: React.CSSProperties = {};
  if (position === 'bottom') {
    tooltipStyle = {
      top: `${rect.bottom + 10}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: 'translateX(-50%)',
    };
  } else if (position === 'top') {
    tooltipStyle = {
      bottom: `${window.innerHeight - rect.top + 10}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: 'translateX(-50%)',
    };
  } else if (position === 'right') {
    tooltipStyle = {
      top: `${rect.top}px`,
      left: `${rect.right + 10}px`,
    };
  } else if (position === 'left') {
    tooltipStyle = {
      top: `${rect.top}px`,
      right: `${window.innerWidth - rect.left + 10}px`,
    };
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        style={{
          clipPath: `polygon(
            0% 0%,
            0% 100%,
            ${rect.left}px 100%,
            ${rect.left}px ${rect.top}px,
            ${rect.right}px ${rect.top}px,
            ${rect.right}px ${rect.bottom}px,
            ${rect.left}px ${rect.bottom}px,
            ${rect.left}px 100%,
            100% 100%,
            100% 0%
          )`,
        }}
        onClick={handleNext}
      />

      {/* Highlight */}
      <div
        className="fixed z-40 border-2 border-[var(--accent)] rounded-lg pointer-events-none"
        style={{
          left: `${rect.left - 4}px`,
          top: `${rect.top - 4}px`,
          width: `${rect.width + 8}px`,
          height: `${rect.height + 8}px`,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-50 bg-surface-ground rounded-lg shadow-xl p-4 max-w-sm"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-folio-text-primary">{step.title}</h3>
            <p className="folio-ui text-folio-text-secondary mt-1">{step.description}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <span className="folio-meta text-folio-text-tertiary">
            Step {currentStep + 1} of {tourSteps.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              className="folio-meta text-folio-text-secondary hover:text-folio-text-primary"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="folio-meta px-3 py-1 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)]"
            >
              {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}




