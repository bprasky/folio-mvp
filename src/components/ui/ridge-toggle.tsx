import * as React from 'react';
import { cn } from '@/lib/utils';

interface RidgeToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

/**
 * RidgeToggleGroup - Container for toggle items with neumorphic inset styling
 *
 * Usage:
 * <RidgeToggleGroup value={selected} onValueChange={setSelected}>
 *   <RidgeToggleItem value="option1">Option 1</RidgeToggleItem>
 *   <RidgeToggleItem value="option2">Option 2</RidgeToggleItem>
 * </RidgeToggleGroup>
 */
const RidgeToggleGroup = React.forwardRef<HTMLDivElement, RidgeToggleGroupProps>(
  ({ className, value, onValueChange, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('ridge-toggle-group', className)}
        role="radiogroup"
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<RidgeToggleItemProps>, {
              isActive: (child as React.ReactElement<RidgeToggleItemProps>).props.value === value,
              onClick: () => {
                const itemValue = (child as React.ReactElement<RidgeToggleItemProps>).props.value;
                if (itemValue && onValueChange) {
                  onValueChange(itemValue);
                }
              },
            });
          }
          return child;
        })}
      </div>
    );
  }
);

RidgeToggleGroup.displayName = 'RidgeToggleGroup';

interface RidgeToggleItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  isActive?: boolean;
}

/**
 * RidgeToggleItem - Individual toggle item within a toggle group
 */
const RidgeToggleItem = React.forwardRef<HTMLButtonElement, RidgeToggleItemProps>(
  ({ className, value, isActive, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isActive}
        data-state={isActive ? 'active' : 'inactive'}
        className={cn(
          'ridge-toggle-item',
          isActive && 'active',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

RidgeToggleItem.displayName = 'RidgeToggleItem';

export { RidgeToggleGroup, RidgeToggleItem };
