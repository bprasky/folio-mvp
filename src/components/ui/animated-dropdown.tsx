'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedDropdownProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

const dropdownVariants = {
  initial: { opacity: 0, y: -4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
};

/**
 * AnimatedDropdown
 *
 * A wrapper for dropdown menus, popovers, and tooltips.
 * Provides subtle entry/exit animations.
 *
 * Usage:
 * <AnimatedDropdown isOpen={isMenuOpen}>
 *   <DropdownMenu>...</DropdownMenu>
 * </AnimatedDropdown>
 */
export function AnimatedDropdown({
  isOpen,
  children,
  className,
}: AnimatedDropdownProps) {
  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.12 };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={cn("origin-top", className)}
          variants={dropdownVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AnimatedDropdown;
