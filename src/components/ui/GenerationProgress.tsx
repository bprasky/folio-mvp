"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ImageIcon, Search, PenTool, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

interface GenerationProgressProps {
  currentStep: number;
  messages: string[];
  isGenerating: boolean;
  error?: string | null;
  /** For error display: current attempt number */
  generationAttempts?: number;
  /** For error display: max attempts allowed */
  maxAttempts?: number;
}

const PHASE_ICONS = [ImageIcon, Search, PenTool, Sparkles];

const iconAnimation = {
  initial: { opacity: 0, y: 12, scale: 0.8 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.8 },
  transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
};

const textAnimation = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
};

function PhaseIcon({ step }: { step: number }) {
  const Icon = PHASE_ICONS[step] ?? PHASE_ICONS[0];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        {...iconAnimation}
        className="relative mx-auto flex h-16 w-16 items-center justify-center"
      >
        {/* Soft glow behind icon */}
        <div className="absolute inset-0 rounded-full bg-[var(--accent)]/10 blur-xl" />
        <div className="relative rounded-full bg-[var(--accent)]/8 p-4">
          <Icon className="h-7 w-7 text-[var(--accent)]" strokeWidth={1.5} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ProgressDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="relative flex items-center">
          <motion.div
            className="h-2 w-2 rounded-full"
            animate={{
              backgroundColor:
                i <= current
                  ? "var(--accent)"
                  : "var(--neu-ridge, rgba(0,0,0,0.08))",
              scale: i === current ? 1.3 : 1,
            }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          />
          {i < total - 1 && (
            <motion.div
              className="ml-2 h-[1.5px] w-4"
              animate={{
                backgroundColor:
                  i < current
                    ? "var(--accent)"
                    : "var(--neu-ridge, rgba(0,0,0,0.08))",
              }}
              transition={{ duration: 0.4 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function GenerationProgress({
  currentStep,
  messages,
  isGenerating,
  error,
  generationAttempts = 0,
  maxAttempts = 3,
}: GenerationProgressProps) {
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-sm rounded-[20px] bg-white/90 backdrop-blur-xl border border-white/30 p-10 shadow-neu-raised text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <Sparkles className="h-6 w-6 text-red-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-headline text-[var(--text-primary)]">
            {generationAttempts >= maxAttempts
              ? "Generation unavailable"
              : `Generation failed — attempt ${generationAttempts} of ${maxAttempts}`}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!isGenerating) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-sm rounded-[20px] bg-white/90 backdrop-blur-xl border border-white/30 p-10 shadow-neu-raised text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16">
      <div className="w-full max-w-sm rounded-[20px] bg-white/90 backdrop-blur-xl border border-white/30 p-10 shadow-neu-raised">
        <div className="text-center space-y-8">
          {/* Animated phase icon */}
          <PhaseIcon step={currentStep} />

          {/* Title + phase message */}
          <div className="space-y-2">
            <h3 className="text-2xl font-headline text-[var(--text-primary)]">
              Creating your story
            </h3>
            <AnimatePresence mode="wait">
              <motion.p
                key={currentStep}
                {...textAnimation}
                className="text-sm text-[var(--text-secondary)]"
              >
                {messages[currentStep]}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <ProgressDots total={messages.length} current={currentStep} />
        </div>
      </div>
    </div>
  );
}
