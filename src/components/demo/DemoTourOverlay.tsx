'use client';

/**
 * Demo Tour Overlay Component
 * 
 * Renders the guided tour overlays for Designer Demo Mode.
 * Supports both fullscreen intro screens and overlay-style steps.
 * 
 * Design principles:
 * - Quiet, editorial, professional (aligned with Folio brand)
 * - Non-intrusive navigation controls
 * - Smooth transitions
 * - Highlight-focused overlays for feed/project/events steps
 */

import { useEffect, useRef, useState } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function DemoTourOverlay() {
  const {
    enabled,
    active,
    currentStep,
    isFirstStep,
    isLastStep,
    nextStep,
    previousStep,
    endDemo,
    enableFreeExplore,
  } = useDemoMode();

  const [highlightElement, setHighlightElement] = useState<HTMLElement | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Find and highlight the target element
  useEffect(() => {
    if (!active || !enabled || !currentStep?.highlightSelector) {
      setHighlightElement(null);
      return;
    }

    const findElement = () => {
      const element = document.querySelector(currentStep.highlightSelector || '') as HTMLElement;
      if (element) {
        setHighlightElement(element);
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Retry after a short delay if element not found (may be loading)
        setTimeout(findElement, 500);
      }
    };

    findElement();
  }, [active, enabled, currentStep?.highlightSelector, currentStep?.id]);

  // Auto-scroll effect for feed step
  useEffect(() => {
    if (!active || !enabled || !currentStep?.autoScroll) {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      return;
    }

    // Slowly scroll the feed container
    const container = highlightElement || document.documentElement;
    scrollIntervalRef.current = setInterval(() => {
      setScrollPosition((prev) => {
        const newPos = prev + 1;
        container.scrollTop = newPos;
        return newPos;
      });
    }, 50);

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, [active, enabled, currentStep?.autoScroll, highlightElement]);

  if (!enabled || !active || !currentStep) {
    return null;
  }

  const isFullscreen = currentStep.type === 'fullscreen_intro';
  const isOverlay = currentStep.type.endsWith('_overlay');

  // Render fullscreen intro screens
  if (isFullscreen) {
    return (
      <AnimatePresence>
        <motion.div
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
              {currentStep.title}
            </motion.h1>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-6 text-lg md:text-xl text-folio-ink/80 leading-relaxed font-sans"
            >
              {currentStep.body && (
                <p className="whitespace-pre-line">{currentStep.body}</p>
              )}
              {currentStep.body2 && (
                <p className="whitespace-pre-line mt-6">{currentStep.body2}</p>
              )}
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-4 pt-8"
            >
              {!isFirstStep && (
                <button
                  onClick={previousStep}
                  className="px-6 py-3 text-sm font-medium text-folio-ink/60 hover:text-folio-ink transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={nextStep}
                className="px-8 py-3 bg-folio-ink text-white font-medium rounded-sm hover:bg-folio-ink/90 transition-colors"
              >
                {currentStep.ctaLabel || 'Next'}
              </button>
            </motion.div>

            {/* Exit button (top-right) */}
            <button
              onClick={endDemo}
              className="absolute top-6 right-6 text-sm text-folio-ink/40 hover:text-folio-ink/60 transition-colors"
            >
              Exit Demo
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Render overlay-style steps (feed, project, events, future)
  if (isOverlay) {
    // Calculate highlight position if element exists
    const highlightRect = highlightElement?.getBoundingClientRect();
    const highlightStyle = highlightRect
      ? {
          position: 'fixed' as const,
          top: highlightRect.top,
          left: highlightRect.left,
          width: highlightRect.width,
          height: highlightRect.height,
          borderRadius: '0.5rem',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 0 2px rgba(255, 255, 255, 0.5)',
          pointerEvents: 'none' as const,
        }
      : null;

    return (
      <AnimatePresence>
        <>
          {/* Layer 1: Backdrop - dims the entire UI once, independent layer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60"
            aria-hidden="true"
          />

          {/* Layer 2: Highlight mask - independent layer for element highlighting */}
          {highlightStyle && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                ...highlightStyle,
                zIndex: 85,
              }}
              className="transition-all duration-300"
            />
          )}

          {/* Layer 3: Panel - crisp modal, no opacity dimming, uses background-color alpha */}
          <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-end md:justify-center pointer-events-none">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="pointer-events-auto w-full max-w-md lg:max-w-lg mx-4 mb-8 md:mr-8 md:mb-0 rounded-[20px] bg-[var(--bg-elevated)] shadow-2xl p-6 md:p-8 space-y-4 relative"
            >
              <h2 className="text-2xl font-serif text-folio-ink font-light">
                {currentStep.title}
              </h2>

              <div className="space-y-3 text-sm md:text-base text-folio-ink/70 leading-relaxed font-sans">
                {currentStep.body && (
                  <p className="whitespace-pre-line">{currentStep.body}</p>
                )}
                {currentStep.body2 && (
                  <p className="whitespace-pre-line mt-3">{currentStep.body2}</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 pt-4 border-t border-folio-border/20">
                <div className="flex items-center gap-2">
                  {!isFirstStep && (
                    <button
                      onClick={previousStep}
                      className="px-4 py-2 text-sm font-medium text-folio-ink/60 hover:text-folio-ink transition-colors"
                    >
                      Back
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {isLastStep && (
                    <button
                      onClick={enableFreeExplore}
                      className="px-4 py-2 text-sm font-medium text-folio-ink/60 hover:text-folio-ink transition-colors"
                    >
                      Explore Folio freely
                    </button>
                  )}
                  <button
                    onClick={isLastStep ? endDemo : nextStep}
                    className="px-6 py-2 bg-folio-ink text-white text-sm font-medium rounded-sm hover:bg-folio-ink/90 transition-colors"
                  >
                    {currentStep.ctaLabel || (isLastStep ? 'Finish Demo' : 'Next')}
                  </button>
                </div>
              </div>

              {/* Exit button (top-right of overlay) */}
              <button
                onClick={endDemo}
                className="absolute top-4 right-4 text-xs text-folio-ink/40 hover:text-folio-ink/60 transition-colors"
              >
                Exit Demo
              </button>
            </motion.div>
          </div>
        </>
      </AnimatePresence>
    );
  }

  return null;
}

