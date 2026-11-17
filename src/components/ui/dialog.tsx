'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  backdropClassName?: string;
  placement?: 'center' | 'right';
  /** Decorative only; interactive children belong in DialogContent. */
  backgroundLayer?: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children, backdropClassName = 'glass-backdrop', placement = 'center', backgroundLayer }: DialogProps) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={cn('fixed inset-0 z-[70] grid overflow-y-auto overscroll-contain', placement === 'right' ? 'justify-items-end' : 'place-items-center p-4 md:p-8 lg:p-12', backdropClassName)}>
        {backgroundLayer && <div className="pointer-events-none absolute inset-0" aria-hidden>{backgroundLayer}</div>}
        {children}
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { placement?: 'center' | 'right' }
>(({ className, placement = 'center', onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const previousFocus = React.useRef<HTMLElement | null>(null);
  return <DialogPrimitive.Content
    ref={ref}
    className={cn('relative min-w-0 overscroll-contain focus:outline-none', placement === 'right' ? 'overflow-hidden' : 'glass-overlay w-full max-w-lg overflow-y-auto', className)}
    {...props}
    // Bound caller-supplied vh heights as the viewport gets shorter, too.
    style={{ ...props.style, maxHeight: placement === 'right' ? '100dvh' : 'calc(100dvh - clamp(2rem, 8vw, 6rem))' }}
    onOpenAutoFocus={event => {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onOpenAutoFocus?.(event);
    }}
    onCloseAutoFocus={event => {
      onCloseAutoFocus?.(event);
      if (!event.defaultPrevented && previousFocus.current?.isConnected) {
        event.preventDefault();
        previousFocus.current.focus();
      }
    }}
  />;
});
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pt-6 pb-4', className)} {...props} />;
}
export function DialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-lg font-semibold text-folio-text-primary', className)} {...props} />;
}
export function DialogDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-folio-text-secondary', className)} {...props} />;
}
// Existing callers own triggers outside the controlled root.
export function DialogTrigger({ children }: { children: React.ReactNode; asChild?: boolean }) {
  return <>{children}</>;
}
