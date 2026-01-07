'use client';

import { motion } from 'framer-motion';

interface ChartInsightProps {
  insight: string;
  className?: string;
}

export function ChartInsight({ insight, className = '' }: ChartInsightProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={`bg-[#F7F4F1] border-l-4 border-[#8C8278] pl-4 py-2 ${className}`}
    >
      <p className="text-sm text-[#2B2B2B] font-medium">{insight}</p>
    </motion.div>
  );
}









