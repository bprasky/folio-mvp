'use client';

import * as React from 'react';

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

interface PopoverProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({ children, open: controlledOpen, onOpenChange }: PopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = React.useCallback((newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  }, [onOpenChange]);

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative">{children}</div>
    </PopoverContext.Provider>
  );
}

interface PopoverTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function PopoverTrigger({ asChild, children, className, onClick }: PopoverTriggerProps) {
  const context = React.useContext(PopoverContext);
  if (!context) throw new Error('PopoverTrigger must be used within Popover');

  const handleClick = () => {
    context.setOpen(!context.open);
    onClick?.();
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      className: `${children.props.className ?? ''} ${className ?? ''}`,
    } as any);
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}

interface PopoverContentProps {
  children: React.ReactNode;
  className?: string;
}

export function PopoverContent({ children, className }: PopoverContentProps) {
  const context = React.useContext(PopoverContext);
  if (!context) throw new Error('PopoverContent must be used within Popover');

  if (!context.open) return null;

  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-neutral-200 bg-white shadow-lg p-3 text-xs">
      <div className={className}>{children}</div>
    </div>
  );
}


