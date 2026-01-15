import * as React from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'ridge';
  error?: boolean;
}

/**
 * Textarea component with Folio neumorphic design system styling
 *
 * Features:
 * - Inset neumorphic shadow for depth
 * - Accent focus ring
 * - Error state styling
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = 'ridge', error, ...props }, ref) => {
    const variants = {
      default: 'flex min-h-[80px] w-full rounded-lg border border-[var(--ridge-outer)] bg-[var(--bg-base)] px-3 py-2 text-sm placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
      ridge: 'ridge-input flex min-h-[80px] w-full px-3 py-2 resize-none disabled:cursor-not-allowed disabled:opacity-50',
    };

    return (
      <textarea
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

Textarea.displayName = 'Textarea';

/**
 * RidgeTextarea - Dedicated neumorphic textarea component
 */
export const RidgeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  Omit<TextareaProps, 'variant'>
>(({ className, ...props }, ref) => (
  <Textarea ref={ref} variant="ridge" className={className} {...props} />
));
RidgeTextarea.displayName = 'RidgeTextarea';

