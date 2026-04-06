import * as React from 'react';
import { cn } from '@/lib/utils';

interface RidgeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'default' | 'sm' | 'lg';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  asChild?: boolean;
}

/**
 * RidgeCard - Core elevated surface component for the Folio neumorphic design system
 *
 * Features:
 * - Double-ridge border pattern (outer + inner ::before border)
 * - Neumorphic shadows (light from top-left)
 * - White base with warm shadow tones
 *
 * Usage:
 * <RidgeCard>Content</RidgeCard>
 * <RidgeCard size="lg" padding="xl">Large padded card</RidgeCard>
 */
const RidgeCard = React.forwardRef<HTMLDivElement, RidgeCardProps>(
  ({ className, size = 'default', padding = 'md', children, ...props }, ref) => {
    const sizeClasses = {
      default: 'glass-surface',
      sm: 'glass-surface glass-surface-sm',
      lg: 'glass-surface',
    };

    const paddingClasses = {
      none: '',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-6',
      xl: 'p-8',
    };

    return (
      <div
        ref={ref}
        className={cn(sizeClasses[size], paddingClasses[padding], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

RidgeCard.displayName = 'RidgeCard';

/**
 * RidgeCardHeader - Header section for ridge cards
 */
const RidgeCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 pb-4', className)}
    {...props}
  />
));
RidgeCardHeader.displayName = 'RidgeCardHeader';

/**
 * RidgeCardTitle - Title element for ridge cards
 */
const RidgeCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('folio-h3', className)}
    {...props}
  />
));
RidgeCardTitle.displayName = 'RidgeCardTitle';

/**
 * RidgeCardDescription - Description text for ridge cards
 */
const RidgeCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('folio-body', className)}
    {...props}
  />
));
RidgeCardDescription.displayName = 'RidgeCardDescription';

/**
 * RidgeCardContent - Main content area for ridge cards
 */
const RidgeCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props} />
));
RidgeCardContent.displayName = 'RidgeCardContent';

/**
 * RidgeCardFooter - Footer section for ridge cards
 */
const RidgeCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-4', className)}
    {...props}
  />
));
RidgeCardFooter.displayName = 'RidgeCardFooter';

/**
 * StatsCard - Specialized card for displaying statistics
 */
interface StatsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number;
  label: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
}

const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  ({ className, value, label, trend, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('glass-surface stats-card', className)}
      {...props}
    >
      <div className="flex items-baseline justify-between">
        <span className="stats-value">{value}</span>
        {trend && (
          <span
            className={cn(
              'text-sm font-medium',
              trend.direction === 'up' && 'text-green-600',
              trend.direction === 'down' && 'text-red-600',
              trend.direction === 'neutral' && 'text-folio-text-tertiary'
            )}
          >
            {trend.direction === 'up' && '↑'}
            {trend.direction === 'down' && '↓'}
            {trend.direction === 'neutral' && '→'}
            {' '}{Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className="stats-label">{label}</p>
    </div>
  )
);
StatsCard.displayName = 'StatsCard';

export {
  RidgeCard,
  RidgeCardHeader,
  RidgeCardTitle,
  RidgeCardDescription,
  RidgeCardContent,
  RidgeCardFooter,
  StatsCard,
};
