'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

interface SelectTriggerProps {
  className?: string;
  children: React.ReactNode;
}

interface SelectContentProps {
  children: React.ReactNode;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = React.useState(0);

  React.useEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  const handleSelect = (newValue: string) => {
    onValueChange(newValue);
    setOpen(false);
  };

  return (
    <div className="relative">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          if (child.type === SelectTrigger) {
            return React.cloneElement(child, { 
              ref: triggerRef,
              onClick: () => setOpen(!open),
              'aria-expanded': open 
            });
          }
          if (child.type === SelectContent && open) {
            return (
              <div 
                className="absolute top-full left-0 z-50 mt-1 bg-white border border-neutral-300 rounded-lg shadow-lg"
                style={{ width: triggerWidth }}
              >
                {React.Children.map(child.props.children, item => {
                  if (React.isValidElement(item) && item.type === SelectItem) {
                    return React.cloneElement(item, {
                      onClick: () => handleSelect(item.props.value)
                    });
                  }
                  return item;
                })}
              </div>
            );
          }
        }
        return child;
      })}
    </div>
  );
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

SelectTrigger.displayName = 'SelectTrigger';

export function SelectContent({ children }: SelectContentProps) {
  return <>{children}</>;
}

export const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ value, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className="px-3 py-2 text-sm hover:bg-neutral-100 cursor-pointer"
        {...props}
      >
        {children}
      </div>
    );
  }
);

SelectItem.displayName = 'SelectItem';

export function SelectValue({ children }: { children: React.ReactNode }) {
  return <span>{children}</span>;
}

