// Formatting utilities for the application

/**
 * Format currency values for display
 */
export function formatCurrency(
  amount: number, 
  currency: string = 'USD',
  compact: boolean = false
): string {
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  };

  if (compact && Math.abs(amount) >= 1000000) {
    options.notation = 'compact';
    options.compactDisplay = 'short';
  }

  return new Intl.NumberFormat('en-US', options).format(amount);
}

/**
 * Format percentage values
 */
export function formatPercentage(
  value: number, 
  decimals: number = 0
): string {
  // Handle both decimal (0.45) and percentage (45) inputs
  const percentageValue = value > 1 ? value / 100 : value;
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(percentageValue);
}

/**
 * Format compact numbers (e.g., 1.2K, 3.4M)
 */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value);
}

/**
 * Format dates for display
 */
export function formatDate(
  date: string | Date | null | undefined, 
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short', 
    day: 'numeric'
  }
): string {
  if (!date) return '—';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    console.warn('[formatDate] Invalid date:', date);
    return '—';
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
}

/**
 * Format date range
 * Handles both Date objects and date strings, or a pre-formatted string
 */
export function formatDateRange(
  start: string | Date | null | undefined, 
  end?: string | Date | null | undefined
): string {
  // If start is already a formatted string (like "May 15–20"), return it
  if (typeof start === 'string' && !start.match(/^\d{4}-\d{2}-\d{2}/) && !end) {
    return start;
  }
  
  if (!start || !end) {
    if (typeof start === 'string' && start) {
      return start; // Return the string if it exists
    }
    return '—';
  }
  
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  
  // Check if dates are valid
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.warn('[formatDateRange] Invalid dates:', { start, end });
    // If start is a string, try to return it as-is
    if (typeof start === 'string') return start;
    return '—';
  }
  
  const startStr = formatDate(startDate, { month: 'short', day: 'numeric' });
  const endStr = formatDate(endDate, { 
    month: startDate.getMonth() === endDate.getMonth() ? undefined : 'short',
    day: 'numeric',
    year: startDate.getFullYear() === endDate.getFullYear() ? undefined : 'numeric'
  });
  
  return `${startStr} - ${endStr}`;
}

/**
 * Format project value with appropriate units
 */
export function formatProjectValue(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

/**
 * Format delta percentage with appropriate styling
 */
export function formatDelta(delta: number): {
  text: string;
  isPositive: boolean;
} {
  const isPositive = delta > 0;
  const prefix = isPositive ? '+' : '';
  return {
    text: `${prefix}${delta.toFixed(0)}%`,
    isPositive
  };
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
