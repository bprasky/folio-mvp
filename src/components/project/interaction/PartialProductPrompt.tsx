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
 * Lightweight prompt for partial products (incomplete data).
 * Shows what's missing and offers three paths:
 * 1. Save anyway (product still gets saved)
 * 2. Complete it yourself (designer edit form)
 * 3. Ask the vendor (triggers vendor invite/claim flow)
 */
export function PartialProductPrompt({
  isOpen,
  onClose,
  tag,
  onSaveAnyway,
}: PartialProductPromptProps) {
  const [vendorEmailInput, setVendorEmailInput] = useState('');
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const missing = getMissingFields(tag);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  const handleAskVendor = async () => {
    if (!tag.productId) return;

    // If we have vendor info, send invite directly
    if (tag.vendorName && !showVendorForm) {
      // Try sending invite via API
      try {
        await fetch('/api/vendor/invite-to-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: tag.productId,
            vendorName: tag.vendorName,
            vendorEmail: vendorEmailInput || undefined,
          }),
        });
        setInviteSent(true);
        setTimeout(() => onClose(), 2000);
      } catch {
        // Show email form as fallback
        setShowVendorForm(true);
      }
      return;
    }

    // No vendor info → show email input
    if (!showVendorForm) {
      setShowVendorForm(true);
      return;
    }

    // Submit vendor email
    if (vendorEmailInput.includes('@')) {
      try {
        await fetch('/api/vendor/invite-to-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: tag.productId,
            vendorName: tag.vendorName || tag.label,
            vendorEmail: vendorEmailInput,
          }),
        });
        setInviteSent(true);
        setTimeout(() => onClose(), 2000);
      } catch {
        // Silently fail — not blocking
      }
    }
  };

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
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Prompt */}
          <motion.div
            className="relative z-10 w-[90vw] max-w-sm glass-surface rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(15,14,10,0.4)]"
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/10 text-folio-text-secondary hover:bg-black/20 transition-colors"
              aria-label="Close"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>

            <div className="px-5 py-5">
              {inviteSent ? (
                <div className="text-center py-4">
                  <div className="text-lg mb-1">Invite sent</div>
                  <p className="text-sm text-folio-text-secondary">
                    The vendor will be asked to complete this product's details.
                  </p>
                </div>
              ) : (
                <>
                  {/* Product name */}
                  <h3 className="text-sm font-semibold text-folio-text-primary pr-6">
                    {tag.label}
                  </h3>
                  {tag.vendorName && (
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-folio-text-secondary">
                      {tag.vendorName}
                    </p>
                  )}

                  {/* Missing fields */}
                  <div className="mt-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200/40">
                    <p className="text-[11px] font-medium text-amber-800 mb-1.5">
                      Missing details
                    </p>
                    <ul className="space-y-1">
                      {missing.map((field) => (
                        <li
                          key={field.key}
                          className="flex items-center gap-1.5 text-[11px] text-amber-700"
                        >
                          <span className="w-3.5 h-3.5 rounded-full border border-amber-300 flex-shrink-0" />
                          {field.label}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Vendor email form (shown when "Ask vendor" is clicked without known email) */}
                  {showVendorForm && (
                    <div className="mt-3">
                      <label className="text-[11px] text-folio-text-secondary block mb-1">
                        Vendor email
                      </label>
                      <input
                        type="email"
                        value={vendorEmailInput}
                        onChange={(e) => setVendorEmailInput(e.target.value)}
                        placeholder="rep@vendor.com"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-folio-border bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                        autoFocus
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 space-y-2">
                    {/* Primary: Save anyway */}
                    <button
                      type="button"
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--text-primary)] px-3 py-2.5 text-[12px] font-medium text-white hover:opacity-90 transition-colors"
                      onClick={onSaveAnyway}
                    >
                      <span>+</span>
                      <span>Save to Project</span>
                    </button>

                    {/* Secondary row */}
                    <div className="flex gap-2">
                      {/* Complete yourself */}
                      {tag.productId && (
                        <a
                          href={`/products/${tag.productId}/edit`}
                          className="flex-1 inline-flex items-center justify-center rounded-full border border-folio-border px-3 py-2 text-[11px] font-medium text-folio-text-primary hover:bg-surface-ground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Complete it
                        </a>
                      )}

                      {/* Ask vendor */}
                      <button
                        type="button"
                        className="flex-1 inline-flex items-center justify-center rounded-full border border-folio-border px-3 py-2 text-[11px] font-medium text-folio-text-primary hover:bg-surface-ground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAskVendor();
                        }}
                      >
                        {showVendorForm ? 'Send invite' : 'Ask vendor'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
