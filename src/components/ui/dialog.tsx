'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  backdropClassName?: string;
  /** Decorative only; interactive children belong in DialogContent. */
  backgroundLayer?: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children, backdropClassName = 'glass-backdrop', backgroundLayer }: DialogProps) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={cn('fixed inset-0 z-[70] grid place-items-center overflow-y-auto overscroll-contain p-4 md:p-8 lg:p-12', backdropClassName)}>
        {backgroundLayer && <div className="pointer-events-none absolute inset-0" aria-hidden>{backgroundLayer}</div>}
        {children}
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const previousFocus = React.useRef<HTMLElement | null>(null);
  return <DialogPrimitive.Content
    ref={ref}
    className={cn('glass-overlay relative w-full min-w-0 max-w-lg overflow-y-auto overscroll-contain focus:outline-none', className)}
    {...props}
    // Bound caller-supplied vh heights as the viewport gets shorter, too.
    style={{ ...props.style, maxHeight: 'calc(100dvh - clamp(2rem, 8vw, 6rem))' }}
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
