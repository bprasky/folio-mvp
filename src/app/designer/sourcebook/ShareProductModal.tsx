'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ShareProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  vendorName: string;
  productImageUrl: string | null;
  notes: string | null;
}

type ShareMethod = 'link' | 'email' | 'copy';

export default function ShareProductModal({
  isOpen,
  onClose,
  productId,
  productName,
  vendorName,
  productImageUrl,
  notes,
}: ShareProductModalProps) {
  const [method, setMethod] = useState<ShareMethod>('link');
  const [includeImage, setIncludeImage] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(!!notes);
  const [includePricing, setIncludePricing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const productUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/products/${productId}`;

  const handleShare = async () => {
    if (method === 'copy' || method === 'link') {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    if (method === 'email') {
      const subject = encodeURIComponent(`${productName} — ${vendorName}`);
      let body = `Check out this product:\n\n${productName}\n${vendorName}\n\n${productUrl}`;
      if (includeNotes && notes) {
        body += `\n\nDesigner notes: ${notes}`;
      }
      window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(body)}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="folio-h3 text-folio-text-primary mb-1">Share Product</h3>
        <p className="text-sm text-folio-text-secondary mb-4">
          {productName} — {vendorName}
        </p>

        <div className="space-y-3 mb-4">
          <div className="text-sm font-medium text-folio-text-tertiary">Share via:</div>
          {[
            { id: 'link' as ShareMethod, label: 'Folio link (client can view on folioad.com)' },
            { id: 'email' as ShareMethod, label: 'Email (opens mail client)' },
            { id: 'copy' as ShareMethod, label: 'Copy link to clipboard' },
          ].map(opt => (
            <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="shareMethod"
                value={opt.id}
                checked={method === opt.id}
                onChange={() => setMethod(opt.id)}
                className="accent-[var(--accent)]"
              />
              <span className="text-sm text-folio-text-primary">{opt.label}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2 mb-4">
          <div className="text-sm font-medium text-folio-text-tertiary">Include:</div>
          {[
            { id: 'image', label: 'Product image', checked: includeImage, onChange: setIncludeImage, show: !!productImageUrl },
            { id: 'name', label: 'Vendor & product name', checked: true, onChange: () => {}, show: true, disabled: true },
            { id: 'notes', label: 'My notes about this product', checked: includeNotes, onChange: setIncludeNotes, show: !!notes },
            { id: 'pricing', label: 'Pricing (if available)', checked: includePricing, onChange: setIncludePricing, show: true },
          ].filter(o => o.show).map(opt => (
            <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={opt.checked}
                onChange={(e) => opt.onChange(e.target.checked)}
                disabled={opt.disabled}
                className="accent-[var(--accent)]"
              />
              <span className="text-sm text-folio-text-primary">{opt.label}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ridge" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={handleShare}>
            {copied ? 'Copied!' : 'Share'}
          </Button>
        </div>
      </div>
    </div>
  );
}
