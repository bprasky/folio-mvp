'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const contentVariants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 8 },
};

/**
 * AnimatedModal
 *
 * A wrapper component that adds entry/exit animations to modal content.
 * Uses Framer Motion's AnimatePresence for smooth transitions.
 *
 * Features:
 * - Fade + scale animation for content
 * - Backdrop blur effect
 * - Escape key to close
 * - Click outside to close
 * - Respects prefers-reduced-motion
 */
export function AnimatedModal({
  isOpen,
  onClose,
  children,
  className,
}: AnimatedModalProps) {
  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.15, ease: [0.4, 0, 0.2, 1] };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transition}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Content */}
          <motion.div
            className={cn(
              "fixed inset-0 z-50 flex items-center justify-center p-4",
              className
            )}
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transition}
          >
            <div
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default AnimatedModal;
