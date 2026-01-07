'use client';
import { motion } from 'framer-motion';

export default function BrandMark({ variant='default' }: { variant?: 'default' | 'metrics' }) {
  // Use the same layoutId for shared layout transitions across navs
  return (
    <motion.span
      layoutId="folio-logo"
      className={variant === 'metrics'
        ? 'text-[18px] tracking-tight font-semibold'
        : 'text-[20px] tracking-tight font-semibold'}
    >
      FOLIO
    </motion.span>
  );
}





