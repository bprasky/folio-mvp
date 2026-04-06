'use client';

import { motion } from 'framer-motion';

interface InsightCalloutProps {
  message: string;
  className?: string;
}

export default function InsightCallout({ message, className = '' }: InsightCalloutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`absolute top-2 right-2 bg-white border border-folio-border-strong text-folio-text-secondary text-xs px-3 py-1.5 rounded-lg shadow-sm z-10 ${className}`}
    >
      {message}
    </motion.div>
  );
}
