'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ManualQuoteEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  productId: string;
  productName: string;
  vendorName: string;
  roomId?: string | null;
  onSaved: () => void;
}

export default function ManualQuoteEntryModal({
  isOpen,
  onClose,
  projectId,
  productId,
  productName,
  vendorName,
  roomId,
  onSaved,
}: ManualQuoteEntryModalProps) {
  const [unitPrice, setUnitPrice] = useState('');
  const [leadTimeWeeks, setLeadTimeWeeks] = useState('');
  const [validThrough, setValidThrough] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!unitPrice) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          roomId: roomId || null,
          unitPriceTrade: parseFloat(unitPrice),
          leadTimeWeeks: leadTimeWeeks ? parseInt(leadTimeWeeks, 10) : null,
          validThrough: validThrough || null,
          quoteSource: 'MANUAL',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save quote');
        return;
      }

      onSaved();
      onClose();
      setUnitPrice('');
      setLeadTimeWeeks('');
      setValidThrough('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="folio-h3 text-[var(--text-primary)] mb-1">Enter Quote</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {productName} — {vendorName}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-tertiary)] mb-1 font-medium">
              Unit price (trade) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 bg-white border border-[#E8E6E3] rounded-lg text-[#2C2925] placeholder-[#A39E97] focus:outline-none focus:border-[#C9C4BC] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-tertiary)] mb-1 font-medium">
              Lead time (weeks)
            </label>
            <input
              type="number"
              min="0"
              value={leadTimeWeeks}
              onChange={(e) => setLeadTimeWeeks(e.target.value)}
              placeholder="e.g. 14"
              className="w-full px-3 py-2 bg-white border border-[#E8E6E3] rounded-lg text-[#2C2925] placeholder-[#A39E97] focus:outline-none focus:border-[#C9C4BC] transition-all"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-tertiary)] mb-1 font-medium">
              Valid through
            </label>
            <input
              type="date"
              value={validThrough}
              onChange={(e) => setValidThrough(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#E8E6E3] rounded-lg text-[#2C2925] focus:outline-none focus:border-[#C9C4BC] transition-all"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ridge" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="accent" onClick={handleSave} disabled={!unitPrice || saving}>
            {saving ? 'Saving...' : 'Save Quote'}
          </Button>
        </div>
      </div>
    </div>
  );
}
