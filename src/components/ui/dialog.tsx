'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /**
   * Class for the full-screen backdrop layer. Defaults to the frosted
   * `glass-backdrop`. Pass a custom class (e.g. a dark scrim) when rendering a
   * `backgroundLayer` so the two read as one surface.
   */
  backdropClassName?: string;
  /**
   * Optional node painted behind the centered content, filling the backdrop —
   * e.g. a blurred hero image for a cinematic effect. Clicks on it fall through
   * to the backdrop, so click-outside-to-close still works. Keep it decorative
   * (aria-hidden, no interactive children).
   */
  backgroundLayer?: React.ReactNode;
}

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogHeaderProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  children,
  backdropClassName = 'glass-backdrop',
  backgroundLayer,
}: DialogProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8 lg:p-12',
        backdropClassName,
      )}
      onClick={() => onOpenChange(false)}
    >
      {backgroundLayer}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogContent({ className, children }: DialogContentProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    // Prevent spacebar from scrolling the dialog when focused on input/textarea
    // This is a common browser issue: spacebar scrolls scrollable containers even when inputs are focused
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle spacebar
      if (e.key === ' ' || e.keyCode === 32) {
        const activeElement = document.activeElement as HTMLElement;
        
        // If focus is in an input/textarea/contenteditable, prevent scrolling
        if (
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
           activeElement.tagName === 'TEXTAREA' ||
           activeElement.isContentEditable ||
           activeElement.closest('textarea') ||
           activeElement.closest('input'))
        ) {
          // Prevent default scrolling behavior
          // The browser will still insert the space character normally
          e.preventDefault();
          e.stopPropagation();
          
          // For textareas and inputs, manually insert space and trigger React's onChange
          if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
            const input = activeElement as HTMLInputElement | HTMLTextAreaElement;
            const start = input.selectionStart ?? 0;
            const end = input.selectionEnd ?? 0;
            const newValue = input.value.slice(0, start) + ' ' + input.value.slice(end);
            
            // Use React's input event system
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement?.prototype || window.HTMLInputElement?.prototype,
              'value'
            )?.set;
            
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(input, newValue);
            } else {
              input.value = newValue;
            }
            
            // Set cursor position
            input.setSelectionRange(start + 1, start + 1);
            
            // Dispatch input event for React
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            input.dispatchEvent(inputEvent);
            
            // Also dispatch change event for good measure
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            input.dispatchEvent(changeEvent);
          } else if (activeElement.isContentEditable) {
            // For contenteditable, use insertText command
            document.execCommand('insertText', false, ' ');
          }
        }
      }
    };

    // Use capture phase to intercept before other handlers
    content.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      content.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  return (
    <div
      ref={contentRef}
      className={cn(
        "glass-overlay max-w-lg w-full max-h-[90vh] overflow-y-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ className, children }: DialogHeaderProps) {
  return (
    <div className={cn("px-6 pt-6 pb-4", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ className, children }: DialogTitleProps) {
  return (
    <h2 className={cn("text-lg font-semibold text-folio-text-primary", className)}>
      {children}
    </h2>
  );
}

interface DialogDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

export function DialogDescription({ className, children }: DialogDescriptionProps) {
  return (
    <p className={cn("text-sm text-folio-text-secondary", className)}>
      {children}
    </p>
  );
}

interface DialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DialogTrigger({ children }: DialogTriggerProps) {
  // This is a pass-through component for compatibility
  // The actual trigger logic should be handled by the parent
  return <>{children}</>;
}

