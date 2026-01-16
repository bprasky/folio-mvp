import * as React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'ridge';
  error?: boolean;
}

/**
 * Input component with Folio neumorphic design system styling
 *
 * Features:
 * - Inset neumorphic shadow for depth
 * - Accent focus ring
 * - Error state styling
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = 'ridge', error, ...props }, ref) => {
    const variants = {
      default: 'flex h-10 w-full rounded-lg border border-[var(--ridge-outer)] bg-[var(--bg-base)] px-3 py-2 text-sm placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
      ridge: 'ridge-input flex h-10 w-full px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50',
    };

    return (
      <input
        type={type}
        className={cn(
          variants[variant],
          error && 'border-red-500 focus:border-red-500 focus:shadow-[var(--neu-inset-sm),0_0_0_3px_rgba(239,68,68,0.15)]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

/**
 * RidgeInput - Dedicated neumorphic input component
 */
export const RidgeInput = React.forwardRef<
  HTMLInputElement,
  Omit<InputProps, 'variant'>
>(({ className, ...props }, ref) => (
  <Input ref={ref} variant="ridge" className={className} {...props} />
));
RidgeInput.displayName = 'RidgeInput';

