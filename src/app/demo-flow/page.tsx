'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheck, FaArrowRight, FaHome, FaBookmark, FaHandshake, FaPaintBrush, FaFileAlt, FaCalendarAlt, FaChartBar, FaPlay } from 'react-icons/fa';

const DEMO_STEPS = [
  {
    id: 1,
    title: 'Browse & Save',
    description: 'Browse the feed and save products or projects you like to your saved items.',
    route: '/feed',
    icon: FaHome,
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 2,
    title: 'Review Saved Items',
    description: 'View all your saved items and organize them into folders.',
    route: '/individual',
    icon: FaBookmark,
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 3,
    title: 'Hire a Designer',
    description: 'Use the hire flow to find and hire a designer who will help with your project.',
    route: '/individual/hire',
    icon: FaHandshake,
    color: 'from-green-500 to-green-600',
  },
  {
    id: 4,
    title: 'Switch to Designer View',
    description: 'Switch roles to see the project from the Designer perspective. Your saved items have been migrated to the project.',
    route: '/designer',
    icon: FaPaintBrush,
    color: 'from-orange-500 to-orange-600',
    note: 'Use the role switcher in navigation to switch to Designer role',
  },
  {
    id: 5,
    title: 'Open Your Project',
    description: 'Open the project created from your hire request. All your saved selections are now in the Designer Board.',
    route: null, // Will be dynamic
    icon: FaPaintBrush,
    color: 'from-teal-500 to-teal-600',
    note: 'Click on the project in your Designer dashboard',
  },
  {
    id: 6,
    title: 'Generate AI Images',
    description: 'Use the AI image generation feature to create concept images for your project rooms.',
    route: null, // Will be dynamic
    icon: FaPaintBrush,
    color: 'from-pink-500 to-pink-600',
    note: 'Click "Generate Images" on the Designer Board',
  },
  {
    id: 7,
    title: 'Draft Editorial',
    description: 'Create an editorial from your project that will appear in the feed.',
    route: null, // Will be dynamic
    icon: FaFileAlt,
    color: 'from-indigo-500 to-indigo-600',
    note: 'Click "Draft Editorial" button on the project page',
  },
  {
    id: 8,
    title: 'View in Feed',
    description: 'Check the feed to see your published editorial.',
    route: '/feed',
    icon: FaHome,
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 9,
    title: 'Explore Events',
    description: 'Browse vendor events and RSVP. Save products from events to your projects.',
    route: '/events',
    icon: FaCalendarAlt,
    color: 'from-red-500 to-red-600',
  },
  {
    id: 10,
    title: 'Vendor Analytics',
    description: 'Switch to Vendor role to see event analytics and insights dashboard.',
    route: '/vendor/dashboard',
    icon: FaChartBar,
    color: 'from-yellow-500 to-yellow-600',
    note: 'Use the role switcher to switch to Vendor role',
  },
];

export default function DemoFlowPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleNext = () => {
    if (currentStep < DEMO_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGoToStep = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  const handleCompleteStep = () => {
    setCompletedSteps(new Set([...completedSteps, currentStep]));
  };

  const handleNavigate = () => {
    const step = DEMO_STEPS[currentStep];
    if (step.route) {
      router.push(step.route);
      handleCompleteStep();
    }
  };

  const currentStepData = DEMO_STEPS[currentStep];
  const Icon = currentStepData.icon;
  const isCompleted = completedSteps.has(currentStep);
  const isLastStep = currentStep === DEMO_STEPS.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">Demo Flow Guide</h1>
          <p className="text-[var(--text-secondary)]">Follow these steps to explore the complete Folio experience</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Step {currentStep + 1} of {DEMO_STEPS.length}
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              {completedSteps.size} completed
            </span>
          </div>
          <div className="w-full bg-[var(--bg-elevated)] rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / DEMO_STEPS.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Step Cards Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-8">
          {DEMO_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isStepCompleted = completedSteps.has(index);
            const isStepCurrent = index === currentStep;
            return (
              <button
                key={step.id}
                onClick={() => handleGoToStep(index)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  isStepCurrent
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : isStepCompleted
                    ? 'border-green-500 bg-green-50'
                    : 'border-[var(--ridge-outer)] bg-white hover:border-[var(--ridge-outer)]'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  {isStepCompleted ? (
                    <FaCheck className="w-5 h-5 text-green-600" />
                  ) : (
                    <StepIcon className={`w-5 h-5 ${isStepCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`} />
                  )}
                  <span className={`text-xs font-medium text-center ${isStepCurrent ? 'text-[var(--accent)]' : isStepCompleted ? 'text-green-600' : 'text-[var(--text-secondary)]'}`}>
                    {step.title}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Current Step Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-lg p-8 mb-6"
          >
            <div className="flex items-start gap-6">
              <div className={`p-4 rounded-xl bg-gradient-to-r ${currentStepData.color} text-white`}>
                <Icon className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">{currentStepData.title}</h2>
                  {isCompleted && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      Completed
                    </span>
                  )}
                </div>
                <p className="text-[var(--text-secondary)] mb-4 text-lg">{currentStepData.description}</p>
                {currentStepData.note && (
                  <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-lg p-3 mb-4">
                    <p className="text-sm text-[var(--accent-hover)]">
                      <strong>Note:</strong> {currentStepData.note}
                    </p>
                  </div>
                )}
                {currentStepData.route && (
                  <button
                    onClick={handleNavigate}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
                  >
                    <FaPlay className="w-4 h-4" />
                    Go to {currentStepData.title}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-6 py-3 bg-white border border-[var(--ridge-outer)] rounded-lg font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Previous
          </button>

          <div className="flex items-center gap-2">
            {DEMO_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => handleGoToStep(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-[var(--accent)] w-8'
                    : completedSteps.has(index)
                    ? 'bg-green-500'
                    : 'bg-[var(--text-tertiary)]/30'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={isLastStep}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            Next Step
            <FaArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 p-6 bg-[var(--bg-elevated)] rounded-xl">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Quick Links</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => router.push('/feed')}
              className="p-3 bg-white rounded-lg border border-[var(--ridge-outer)] hover:border-[var(--accent)] hover:shadow-md transition-all text-left"
            >
              <FaHome className="w-5 h-5 text-[var(--accent)] mb-2" />
              <div className="text-sm font-medium text-[var(--text-primary)]">Feed</div>
            </button>
            <button
              onClick={() => router.push('/individual')}
              className="p-3 bg-white rounded-lg border border-[var(--ridge-outer)] hover:border-purple-500 hover:shadow-md transition-all text-left"
            >
              <FaBookmark className="w-5 h-5 text-purple-600 mb-2" />
              <div className="text-sm font-medium text-[var(--text-primary)]">Saved Items</div>
            </button>
            <button
              onClick={() => router.push('/individual/hire')}
              className="p-3 bg-white rounded-lg border border-[var(--ridge-outer)] hover:border-green-500 hover:shadow-md transition-all text-left"
            >
              <FaHandshake className="w-5 h-5 text-green-600 mb-2" />
              <div className="text-sm font-medium text-[var(--text-primary)]">Hire Designer</div>
            </button>
            <button
              onClick={() => router.push('/events')}
              className="p-3 bg-white rounded-lg border border-[var(--ridge-outer)] hover:border-red-500 hover:shadow-md transition-all text-left"
            >
              <FaCalendarAlt className="w-5 h-5 text-red-600 mb-2" />
              <div className="text-sm font-medium text-[var(--text-primary)]">Events</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}




