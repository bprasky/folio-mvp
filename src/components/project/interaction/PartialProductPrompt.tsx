'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { NormalizedTag } from './types';
import { getMissingFields } from './productCompleteness';

interface PartialProductPromptProps {
  isOpen: boolean;
  onClose: () => void;
  tag: NormalizedTag;
  onSaveAnyway: () => void;
}

/**
 * Lightweight prompt for incomplete products on tagged images.
 *
 * Single primary action: "Add to project" which also fires a spec request
 * to the vendor automatically. User sees confirmation: "Saved — requesting
 * more info for you." No navigation to dead pages.
 */
export function PartialProductPrompt({
  isOpen,
  onClose,
  tag,
  onSaveAnyway,
}: PartialProductPromptProps) {
  const [done, setDone] = useState(false);
  const missing = getMissingFields(tag);

  useEffect(() => {
    if (!isOpen) {
      setDone(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleSaveAndRequest = () => {
    // Save to project
    onSaveAnyway();

    // Fire-and-forget: request vendor to complete specs
    if (tag.productId) {
      fetch('/api/vendor/invite-to-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: tag.productId,
          vendorName: tag.vendorName || tag.label,
        }),
      }).catch(() => {});
    }

    setDone(true);
    setTimeout(() => onClose(), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            className="relative z-10 w-[90vw] max-w-xs glass-surface rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(15,14,10,0.4)]"
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="px-5 py-5">
              {done ? (
                /* Confirmation state */
                <div className="text-center py-2">
                  <div className="w-10 h-10 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-folio-text-primary">
                    Saved to project
                  </p>
                  <p className="text-[12px] text-folio-text-secondary mt-1">
                    {tag.vendorName
                      ? `Requesting full specs from ${tag.vendorName} for you.`
                      : 'Requesting more info for you.'
                    }
                  </p>
                </div>
              ) : (
                /* Prompt state */
                <>
                  <h3 className="text-sm font-semibold text-folio-text-primary">
                    {tag.label}
                  </h3>
                  {tag.vendorName && (
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-folio-text-secondary">
                      {tag.vendorName}
                    </p>
                  )}

                  <p className="mt-3 text-[12px] text-folio-text-secondary leading-relaxed">
                    This product has limited details.
                    {tag.vendorName
                      ? ` We'll request complete specs from ${tag.vendorName} when you save.`
                      : " We'll request more info when you save."
                    }
                  </p>

                  <button
                    type="button"
                    className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--text-primary)] px-3 py-2.5 text-[12px] font-medium text-white hover:opacity-90 transition-colors"
                    onClick={handleSaveAndRequest}
                  >
                    <span>+</span>
                    <span>Add to project</span>
                  </button>

                  <button
                    type="button"
                    className="mt-2 w-full text-center text-[11px] text-folio-text-tertiary hover:text-folio-text-secondary py-1 transition-colors"
                    onClick={onClose}
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
