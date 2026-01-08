'use client';

import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  level: 'high' | 'medium' | 'low' | string | null | undefined;
  className?: string;
}

export function ConfidenceBadge({ level, className }: ConfidenceBadgeProps) {
  const config = {
    high: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-700',
      label: 'High',
    },
    medium: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: 'Medium',
    },
    low: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Low',
    },
  };

  const { bg, text, label } = config[level as keyof typeof config] || config.low;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        bg,
        text,
        className
      )}
    >
      {label}
    </span>
  );
}
