'use client';

import { useState } from 'react';
import Link from 'next/link';

interface IncompleteProductPageProps {
  productId: string;
  productName: string;
  vendorName: string | null;
  vendorEmail: string | null;
  brand: string;
  productUrl: string | null;
  hasImage: boolean;
}

/**
 * Shown instead of a full product page when product data is incomplete.
 * Routes users to proper avenues: request info from vendor, or save for later.
 *
 * If vendor info is available, "Request Info" goes directly to the vendor.
 * If no vendor info, users can request that details be added.
 */
export function IncompleteProductPage({
  productId,
  productName,
  vendorName,
  vendorEmail,
  brand,
  productUrl,
  hasImage,
}: IncompleteProductPageProps) {
  const [requestSent, setRequestSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  const displayVendor = vendorName || brand || null;
  const hasVendorContact = !!(vendorEmail || vendorName);

  const handleRequestInfo = async () => {
    // If we have vendor contact, send request directly to vendor
    if (hasVendorContact) {
      setSending(true);
      try {
        await fetch('/api/vendor/invite-to-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            vendorName: displayVendor || productName,
            vendorEmail: vendorEmail || emailInput || undefined,
          }),
        });
        setRequestSent(true);
      } catch {
        // Silent fail
      } finally {
        setSending(false);
      }
      return;
    }

    // No vendor info — show email input
    if (!showEmailForm) {
      setShowEmailForm(true);
      return;
    }

    // Submit with provided email
    if (emailInput.includes('@')) {
      setSending(true);
      try {
        await fetch('/api/vendor/invite-to-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            vendorName: displayVendor || productName,
            vendorEmail: emailInput,
          }),
        });
        setRequestSent(true);
      } catch {
        // Silent fail
      } finally {
        setSending(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface-ground flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="glass-surface rounded-2xl p-6 shadow-sm">
          {/* Product icon placeholder */}
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/50 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>

          {/* Product name */}
          <h1 className="text-lg font-semibold text-folio-text-primary">
            {productName}
          </h1>
          {displayVendor && (
            <p className="mt-0.5 text-[var(--type-eyebrow)] uppercase tracking-[var(--ls-eyebrow)] text-folio-text-secondary">
              {displayVendor}
            </p>
          )}

          {/* Status message */}
          <div className="mt-4 p-3 rounded-xl bg-amber-50/60 border border-amber-200/40">
            <p className="text-[var(--type-meta)] text-amber-800 leading-relaxed">
              This product hasn't been fully catalogued yet.
              {hasVendorContact
                ? ` Request complete specifications directly from ${displayVendor}.`
                : ' Help us get the full specs by requesting more information.'
              }
            </p>
          </div>

          {requestSent ? (
            <div className="mt-5 text-center py-3">
              <div className="text-sm font-medium text-green-700 mb-1">
                Request sent
              </div>
              <p className="text-[var(--type-meta)] text-folio-text-secondary">
                {hasVendorContact
                  ? `${displayVendor} will be notified to complete this product's specifications.`
                  : 'Our team will follow up to get the complete details.'
                }
              </p>
            </div>
          ) : (
            <>
              {/* Vendor email form (when no vendor contact available) */}
              {showEmailForm && (
                <div className="mt-4">
                  <label className="text-[var(--type-eyebrow)] text-folio-text-secondary block mb-1">
                    Know the vendor's email?
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="rep@vendor.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-folio-border bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                    autoFocus
                  />
                </div>
              )}

              {/* Actions */}
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={handleRequestInfo}
                  disabled={sending || (showEmailForm && !emailInput.includes('@'))}
                  className="w-full rounded-full bg-[var(--text-primary)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {sending
                    ? 'Sending...'
                    : hasVendorContact
                    ? `Request specs from ${displayVendor}`
                    : showEmailForm
                    ? 'Send request'
                    : 'Request product info'
                  }
                </button>

                {productUrl && (
                  <a
                    href={productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center rounded-full border border-folio-border px-4 py-2.5 text-sm font-medium text-folio-text-primary hover:bg-surface-ground transition-colors"
                  >
                    Visit vendor website
                  </a>
                )}
              </div>
            </>
          )}

          {/* Back link */}
          <div className="mt-5 text-center">
            <Link
              href="/"
              className="text-[var(--type-meta)] text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
            >
              Back to Folio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
