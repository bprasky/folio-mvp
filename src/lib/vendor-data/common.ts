/**
 * Common utilities for vendor data formatting and type safety
 */

export type Delta = { 
  value: number | null; 
  pct?: number | null; 
};

/**
 * Safe number conversion with default fallback
 */
export const safeNum = (n: number | undefined | null, d: number | null = null): number | null => {
  return typeof n === 'number' && !isNaN(n) ? n : d;
};

/**
 * Format integer with thousand separators
 */
export const fmtInt = (n: number | null): string => {
  if (n == null) return '—';
  return Intl.NumberFormat().format(n);
};

/**
 * Format USD currency
 */
export const fmtUsd = (n: number | null): string => {
  if (n == null) return '—';
  return Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
};

/**
 * Format percentage with sign
 */
export const fmtPct = (n: number | null): string => {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
};

/**
 * Format compact number (e.g., 1.2K, 3.4M)
 */
export const fmtCompact = (n: number | null): string => {
  if (n == null) return '—';
  if (n < 1000) return n.toString();
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1000000).toFixed(1)}M`;
};


