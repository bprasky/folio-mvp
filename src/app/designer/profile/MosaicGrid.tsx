'use client';

import React from 'react';

export type MosaicSize = 'large' | 'medium' | 'small';

export interface MosaicItem {
  id: string;
  type: 'project' | 'product' | 'quote' | 'team' | 'recognition' | 'collaboration';
  size: MosaicSize;
  data: any;
}

interface MosaicGridProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MosaicGrid: a CSS grid that accepts children with data-size attributes.
 * - 4 columns on desktop, 2 on tablet, 1 on mobile
 * - Children with data-size="large" span 2 columns and 2 rows
 * - Children with data-size="medium" span 1 column and 2 rows
 * - Children with data-size="small" span 1 column and 1 row
 */
export default function MosaicGrid({ children, className = '' }: MosaicGridProps) {
  return (
    <div className={`mosaic-grid ${className}`}>
      {children}
      <style jsx>{`
        .mosaic-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-auto-rows: minmax(100px, auto);
          gap: 12px;
        }
        @media (max-width: 1024px) {
          .mosaic-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .mosaic-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Wrapper that applies the correct grid-column/row span based on size.
 */
export function MosaicCell({
  size,
  children,
  className = '',
}: {
  size: MosaicSize;
  children: React.ReactNode;
  className?: string;
}) {
  const sizeClasses: Record<MosaicSize, string> = {
    large: 'mosaic-cell-large',
    medium: 'mosaic-cell-medium',
    small: 'mosaic-cell-small',
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      {children}
      <style jsx>{`
        .mosaic-cell-large {
          grid-column: span 2;
          grid-row: span 2;
        }
        .mosaic-cell-medium {
          grid-row: span 2;
        }
        .mosaic-cell-small {
          /* default: 1x1 */
        }
        @media (max-width: 640px) {
          .mosaic-cell-large {
            grid-column: span 1;
            grid-row: span 1;
          }
          .mosaic-cell-medium {
            grid-row: span 1;
          }
        }
      `}</style>
    </div>
  );
}
