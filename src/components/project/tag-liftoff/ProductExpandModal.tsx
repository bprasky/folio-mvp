'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductExpandModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  name: string;
  vendorName?: string | null;
  href?: string;
  productId?: string;
  onAddToProject?: () => void;
}

/**
 * Expand modal for 2D products (wallpaper, tile, textiles, paint, art).
 * Shows the product image large with quick actions — no 3D, just a clean
 * full-view of the product with save/view buttons.
 */
export function ProductExpandModal({
  isOpen,
  onClose,
  imageUrl,
  name,
  vendorName,
  href,
  productId,
  onAddToProject,
}: ProductExpandModalProps) {
  // Escape key dismisses
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal content */}
          <motion.div
            className="relative z-10 w-[90vw] max-w-lg max-h-[85vh] flex flex-col glass-surface rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(15,14,10,0.4)]"
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 transition-colors"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>

            {/* Product image */}
            {imageUrl && (
              <div className="relative w-full aspect-square bg-surface-ground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={name}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Product info + actions */}
            <div className="px-5 py-4">
              <h3 className="text-sm font-medium text-folio-text-primary truncate">
                {name}
              </h3>
              {vendorName && (
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-folio-text-secondary truncate">
                  {vendorName}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                {href && (
                  <a
                    href={href}
                    className="flex-1 inline-flex items-center justify-center rounded-full border border-folio-border px-3 py-2 text-[11px] font-medium text-folio-text-primary hover:bg-surface-ground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Product
                  </a>
                )}
                {productId && onAddToProject && (
                  <button
                    type="button"
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-[var(--text-primary)] px-3 py-2 text-[11px] font-medium text-white hover:opacity-90 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToProject();
                    }}
                  >
                    <span>+</span>
                    <span>Save to Project</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
