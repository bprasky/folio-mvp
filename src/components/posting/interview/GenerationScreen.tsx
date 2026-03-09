"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, ImageIcon, Scan, PenLine, FileCheck } from "lucide-react";

const GENERATION_STEPS = [
  { label: "Analyzing your images…", icon: ImageIcon },
  { label: "Detecting rooms and products…", icon: Scan },
  { label: "Writing your story…", icon: PenLine },
  { label: "Finalizing draft…", icon: FileCheck },
];

interface GenerationScreenProps {
  images: Array<{ id: string; url: string; name?: string }>;
  generationStep: number;
  isGenerating: boolean;
  error: string | null;
  generationAttempts: number;
  maxAttempts: number;
}

export function GenerationScreen({
  images,
  generationStep,
  isGenerating,
  error,
  generationAttempts,
  maxAttempts,
}: GenerationScreenProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const hasImages = images.length > 0;

  // Cycle through images every 5 seconds
  useEffect(() => {
    if (!isGenerating || !hasImages) return;
    const interval = setInterval(() => {
      setImageIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isGenerating, hasImages, images.length]);

  if (!isGenerating && error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        <div className="text-center space-y-6">
          <div>
            <h3 className="text-xl font-serif text-[var(--text-primary)] mb-2">
              {generationAttempts >= maxAttempts
                ? "Generation unavailable"
                : `Generation failed — attempt ${generationAttempts} of ${maxAttempts}`}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isGenerating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent mx-auto" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 px-8 py-12 md:py-16">
      {/* Image Carousel */}
      {hasImages && (
        <div className="relative w-full max-w-sm md:max-w-md aspect-[4/3] rounded-2xl overflow-hidden shadow-lg bg-stone-100 shrink-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={imageIndex}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                className="absolute inset-0"
                initial={{ scale: 1.0 }}
                animate={{ scale: 1.08 }}
                transition={{ duration: 5, ease: "easeOut" }}
              >
                <Image
                  src={images[imageIndex].url}
                  alt={images[imageIndex].name || "Project image"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                  priority
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>
          {/* Subtle overlay gradient at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Checklist */}
      <div className={`flex flex-col ${hasImages ? "" : "items-center"}`}>
        <h3 className="text-xl font-serif text-[var(--text-primary)] mb-6">
          Creating your story...
        </h3>
        <ol className="space-y-4">
          {GENERATION_STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const status =
              i < generationStep ? "complete" : i === generationStep ? "active" : "pending";

            return (
              <motion.li
                key={i}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
              >
                {/* Status icon */}
                <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                  <AnimatePresence mode="wait">
                    {status === "complete" ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center"
                      >
                        <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.5} />
                      </motion.div>
                    ) : status === "active" ? (
                      <motion.div
                        key="spinner"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-7 h-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center"
                      >
                        <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="pending"
                        className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center"
                      >
                        <StepIcon className="w-3.5 h-3.5 text-stone-400" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Label */}
                <span
                  className={`text-sm transition-colors duration-300 ${
                    status === "complete"
                      ? "text-emerald-700"
                      : status === "active"
                      ? "text-[var(--text-primary)] font-medium"
                      : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {step.label}
                </span>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
