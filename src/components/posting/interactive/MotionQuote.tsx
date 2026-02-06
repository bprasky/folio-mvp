'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

export default function MotionQuote({ children }: { children: string }) {
  const ref = useRef<HTMLQuoteElement>(null);
  const inView = useInView(ref, { margin: '-20% 0% -20% 0%', once: false });

  return (
    <motion.blockquote
      ref={ref}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0.6, scale: 0.99 }}
      transition={{ duration: 0.35 }}
      className="border-l-4 border-[var(--accent)] pl-6 py-4 italic text-lg md:text-xl text-gray-700 bg-gradient-to-r from-blue-50 to-transparent rounded-r-lg"
    >
      "{children}"
    </motion.blockquote>
  );
}


