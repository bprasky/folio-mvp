'use client';
import { motion } from 'framer-motion';

export default function BrandMark({ variant='default' }: { variant?: 'default' | 'metrics' }) {
  // Use the same layoutId for shared layout transitions across navs
  return (
    <motion.span
      layoutId="folio-logo"
      className={variant === 'metrics'
        ? 'text-[var(--type-h4)] tracking-tight font-semibold'
        : 'text-[var(--type-h4)] tracking-tight font-semibold'}
    >
      FOLIO
    </motion.span>
  );
}





