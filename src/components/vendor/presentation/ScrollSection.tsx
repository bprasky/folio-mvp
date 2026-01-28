'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface ScrollSectionProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  /** Ref callback for scroll tracking */
  trackRef?: (el: HTMLElement | null) => void;
  /** Full-bleed mode removes max-width constraints */
  fullBleed?: boolean;
  /** Animation variant */
  animation?: 'fade-up' | 'fade-in' | 'slide-left' | 'slide-right' | 'none';
  /** Background style */
  bg?: 'default' | 'elevated' | 'warm' | 'dark';
}

const bgClasses: Record<string, string> = {
  default: 'bg-[var(--bg-base)]',
  elevated: 'bg-[var(--bg-elevated)]',
  warm: 'bg-[#F5F3EF]',
  dark: 'bg-[#1A1A1A] text-white',
};

const animationVariants = {
  'fade-up': {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  },
  'fade-in': {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  'slide-left': {
    hidden: { opacity: 0, x: 60 },
    visible: { opacity: 1, x: 0 },
  },
  'slide-right': {
    hidden: { opacity: 0, x: -60 },
    visible: { opacity: 1, x: 0 },
  },
  none: {
    hidden: {},
    visible: {},
  },
};

export default function ScrollSection({
  id,
  children,
  className = '',
  trackRef,
  fullBleed = false,
  animation = 'fade-up',
  bg = 'default',
}: ScrollSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-10% 0px' });

  const handleRef = (el: HTMLElement | null) => {
    (ref as React.MutableRefObject<HTMLElement | null>).current = el;
    trackRef?.(el);
  };

  return (
    <section
      id={id}
      ref={handleRef}
      className={`${bgClasses[bg]} ${className}`}
    >
      <motion.div
        className={fullBleed ? '' : 'mx-auto max-w-4xl px-6 py-20 md:py-28'}
        variants={animationVariants[animation]}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </section>
  );
}
