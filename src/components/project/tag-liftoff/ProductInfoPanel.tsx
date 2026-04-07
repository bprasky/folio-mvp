'use client';

import { motion } from 'framer-motion';

interface ProductInfoPanelProps {
  name: string;
  vendorName?: string | null;
  thumbnailUrl?: string | null;
  href?: string;
  productId?: string;
  onAddToProject?: () => void;
}

/**
 * Product info panel that slides in during the lift-off inspect state.
 * Shows product name, vendor, thumbnail, and action buttons.
 */
export function ProductInfoPanel({
  name,
  vendorName,
  thumbnailUrl,
  href,
  productId,
  onAddToProject,
}: ProductInfoPanelProps) {
  return (
    <motion.div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[15] w-max max-w-[280px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="glass-surface rounded-2xl px-4 py-3 shadow-[0_14px_40px_rgba(15,14,10,0.25)]">
        <div className="flex items-center gap-3">
          {thumbnailUrl && (
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-surface-ground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt={name}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="truncate font-medium text-folio-text-primary text-sm">
              {href ? (
                <a href={href} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                  {name}
                </a>
              ) : (
                name
              )}
            </div>
            {vendorName && (
              <div className="truncate text-[10px] uppercase tracking-[0.16em] text-folio-text-secondary">
                {vendorName}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {href && (
            <a
              href={href}
              className="flex-1 inline-flex items-center justify-center rounded-full border border-folio-border px-3 py-1.5 text-[11px] font-medium text-folio-text-primary hover:bg-surface-ground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              View Product
            </a>
          )}
          {productId && onAddToProject && (
            <button
              type="button"
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-[var(--text-primary)] px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onAddToProject();
              }}
            >
              <span>+</span>
              <span>Add to project</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
