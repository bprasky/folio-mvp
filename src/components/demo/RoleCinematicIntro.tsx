'use client';

/**
 * Role Cinematic Intro Component
 * 
 * Generalized cinematic intro component that reuses the same visual style
 * as the existing designer demo intro. Can be used for Individual, Designer, and Vendor roles.
 * 
 * Reuses the same fullscreen intro pattern from DemoTourOverlay.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CinematicIntroSection } from './introConfig';

interface RoleCinematicIntroProps {
  role: 'individual' | 'designer' | 'vendor';
  sections: CinematicIntroSection[];
  onContinue: () => void;
  onClose?: () => void;
}

export default function RoleCinematicIntro({
  role,
  sections,
  onContinue,
  onClose,
}: RoleCinematicIntroProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const currentSection = sections[currentSectionIndex];
  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex === sections.length - 1;

  const handleNext = () => {
    if (isLastSection) {
      onContinue();
    } else {
      setCurrentSectionIndex(currentSectionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstSection) {
      setCurrentSectionIndex(currentSectionIndex - 1);
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentSectionIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-folio-background flex items-center justify-center p-8"
      >
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-6xl font-serif text-folio-ink font-light tracking-tight"
          >
            {currentSection.title}
          </motion.h1>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-6 text-lg md:text-xl text-folio-ink/80 leading-relaxed font-sans"
          >
            {currentSection.body && (
              <p className="whitespace-pre-line">{currentSection.body}</p>
            )}
            {currentSection.body2 && (
              <p className="whitespace-pre-line mt-6">{currentSection.body2}</p>
            )}
            {currentSection.bullets && (
              <ul className="list-none space-y-3 mt-6 text-left max-w-2xl mx-auto">
                {currentSection.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-folio-ink/60 mt-1">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-4 pt-8"
          >
            {!isFirstSection && (
              <button
                onClick={handlePrevious}
                className="px-6 py-3 text-sm font-medium text-folio-ink/60 hover:text-folio-ink transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-8 py-3 bg-folio-ink text-white font-medium rounded-sm hover:bg-folio-ink/90 transition-colors"
            >
              {currentSection.ctaLabel || (isLastSection ? 'Continue' : 'Next')}
            </button>
          </motion.div>

          {/* Exit button (top-right) */}
          {(onClose || !isFirstSection) && (
            <button
              onClick={onClose || onContinue}
              className="absolute top-6 right-6 text-sm text-folio-ink/40 hover:text-folio-ink/60 transition-colors"
            >
              Skip
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}




