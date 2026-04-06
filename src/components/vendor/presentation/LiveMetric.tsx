'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

interface LiveMetricProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  /** Duration of count-up animation in seconds */
  duration?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: {
    value: 'text-2xl font-semibold',
    label: 'text-folio-meta text-folio-text-secondary',
  },
  md: {
    value: 'text-folio-stat',
    label: 'text-folio-body text-folio-text-secondary',
  },
  lg: {
    value: 'text-5xl md:text-6xl font-semibold tracking-tight',
    label: 'text-folio-body text-folio-text-secondary mt-2',
  },
};

export default function LiveMetric({
  value,
  label,
  prefix = '',
  suffix = '',
  duration = 1.5,
  className = '',
  size = 'md',
}: LiveMetricProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-5% 0px' });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const startTime = Date.now();
    const endTime = startTime + duration * 1000;

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * value);
      setDisplayValue(current);

      if (now < endTime) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, value, duration]);

  const styles = sizeClasses[size];

  return (
    <motion.div
      ref={ref}
      className={`text-center ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.value}>
        {prefix}
        {displayValue.toLocaleString()}
        {suffix}
      </div>
      <div className={styles.label}>{label}</div>
    </motion.div>
  );
}
