'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateCardProps {
  title: string;
  description: string;
  buttonText: string;
  onAction: () => void;
  icon?: React.ReactNode;
  estimatedTime?: string;
  className?: string;
}

export function EmptyStateCard({
  title,
  description,
  buttonText,
  onAction,
  icon,
  estimatedTime,
  className
}: EmptyStateCardProps) {
  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-8 flex flex-col items-center text-center space-y-4',
        className
      )}
      style={{
        borderColor: 'var(--ridge-outer)',
        background: 'linear-gradient(to bottom, var(--surface-ground), transparent)'
      }}
    >
      {icon && (
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.1)' }}
        >
          {icon}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-lg" style={{ fontFamily: 'Georgia, serif' }}>
          {title}
        </h3>
        <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>

      <Button onClick={onAction}>{buttonText}</Button>

      {estimatedTime && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          ~{estimatedTime}
        </p>
      )}
    </div>
  );
}
