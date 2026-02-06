import * as React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'accent' | 'ridge' | 'pill' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
}

/**
 * Button component with Folio neumorphic design system variants
 *
 * Variants:
 * - accent: Primary CTA button with warm accent color
 * - ridge: Secondary button with double-ridge border pattern
 * - pill: Rounded pill-shaped button with ridge styling
 * - default: Legacy default blue button
 * - outline/secondary/ghost/destructive: Legacy variants
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

    const variants = {
      // Folio Design System Variants
      accent: 'accent-btn',
      ridge: 'ridge-btn',
      pill: 'ridge-btn pill-btn',
      // Legacy variants (mapped to Folio where appropriate)
      default: 'bg-[var(--accent)] text-white border border-[rgba(0,0,0,0.1)] rounded-[10px] shadow-[var(--neu-raised),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.1)] hover:bg-[var(--accent-hover)] hover:-translate-y-[1px] hover:shadow-md active:translate-y-[0.5px] active:shadow-sm',
      outline: 'ridge-btn',
      secondary: 'ridge-btn',
      ghost: 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-[10px] hover:-translate-y-[0.5px] active:translate-y-[0.5px]',
      destructive: 'bg-red-600 text-white border border-[rgba(0,0,0,0.1)] rounded-[10px] shadow-[var(--neu-raised)] hover:bg-red-700 hover:-translate-y-[0.5px] active:translate-y-[0.5px]',
    };

    const sizes = {
      default: 'px-4 py-2.5 text-sm',
      sm: 'px-3 py-1.5 text-xs',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

/**
 * AccentButton - Dedicated primary CTA component
 */
export const AccentButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'variant'>
>(({ className, ...props }, ref) => (
  <Button ref={ref} variant="accent" className={className} {...props} />
));
AccentButton.displayName = 'AccentButton';

/**
 * RidgeButton - Dedicated secondary button component
 */
export const RidgeButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'variant'>
>(({ className, ...props }, ref) => (
  <Button ref={ref} variant="ridge" className={className} {...props} />
));
RidgeButton.displayName = 'RidgeButton';

/**
 * PillButton - Rounded pill-shaped button
 */
export const PillButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'variant'>
>(({ className, ...props }, ref) => (
  <Button ref={ref} variant="pill" className={className} {...props} />
));
PillButton.displayName = 'PillButton';

