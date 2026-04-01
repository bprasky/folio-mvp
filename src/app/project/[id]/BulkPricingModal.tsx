'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';

interface SelectionItem {
  productId: string;
  productName: string;
  vendorName: string;
  roomName: string | null;
  hasPricing: boolean;
  currentPrice: number | null;
}

interface BulkPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  selections: SelectionItem[];
  onSent: (sentCount: number) => void;
}

export default function BulkPricingModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  selections,
  onSent,
}: BulkPricingModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(selections.filter(s => !s.hasPricing).map(s => s.productId))
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [timeline, setTimeline] = useState('flexible');
  const [designerNote, setDesignerNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group by vendor
  const byVendor = useMemo(() => {
    const map = new Map<string, SelectionItem[]>();
    for (const sel of selections) {
      const vendor = sel.vendorName || 'Unknown';
      if (!map.has(vendor)) map.set(vendor, []);
      map.get(vendor)!.push(sel);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [selections]);

  const selectedCount = selectedIds.size;
  const vendorCount = new Set(
    selections.filter(s => selectedIds.has(s.productId)).map(s => s.vendorName || 'Unknown')
  ).size;

  if (!isOpen) return null;

  const toggleProduct = (productId: string) => {
    const next = new Set(selectedIds);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    setSelectedIds(next);
  };

  const selectAllUnpriced = () => {
    setSelectedIds(new Set(selections.filter(s => !s.hasPricing).map(s => s.productId)));
  };

  const handleSend = async () => {
    if (selectedCount === 0) return;
    setSending(true);
    setError(null);

    const products = selections
      .filter(s => selectedIds.has(s.productId))
      .map(s => ({
        productId: s.productId,
        productName: s.productName,
        vendorName: s.vendorName,
        quantity: quantities[s.productId] || 1,
      }));

    try {
      const res = await fetch(`/api/projects/${projectId}/bulk-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products, timeline, designerNote: designerNote.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to send requests');
        return;
      }

      const data = await res.json();
      onSent(data.sent);
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[85vh] overflow-y-auto">
        <h3 className="folio-h3 text-[var(--text-primary)] mb-1">Request Pricing</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {projectName}
        </p>

        <button
          onClick={selectAllUnpriced}
          className="text-sm text-[var(--accent)] hover:underline mb-4"
        >
          Select all unpriced ({selections.filter(s => !s.hasPricing).length} products)
        </button>

        <div className="space-y-4 mb-4">
          {byVendor.map(([vendorName, vendorProducts]) => (
            <div key={vendorName}>
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                {vendorName} ({vendorProducts.length} products)
              </h4>
              <div className="space-y-1.5">
                {vendorProducts.map(sel => (
                  <label
                    key={sel.productId}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(sel.productId)}
                      onChange={() => toggleProduct(sel.productId)}
                      className="accent-[var(--accent)]"
                      disabled={sel.hasPricing}
                    />
                    <span className={`text-sm flex-grow ${sel.hasPricing ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]'}`}>
                      {sel.productName}
                      {sel.hasPricing && sel.currentPrice != null && (
                        <span className="ml-2 text-green-600">(${sel.currentPrice.toLocaleString()})</span>
                      )}
                    </span>
                    {!sel.hasPricing && selectedIds.has(sel.productId) && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-[var(--text-tertiary)]">Qty:</span>
                        <input
                          type="number"
                          min={1}
                          value={quantities[sel.productId] || 1}
                          onChange={(e) => setQuantities(prev => ({
                            ...prev,
                            [sel.productId]: Math.max(1, parseInt(e.target.value) || 1),
                          }))}
                          className="w-16 px-2 py-1 text-xs bg-white border border-[#E8E6E3] rounded text-center"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-[var(--text-tertiary)] mb-1 font-medium">Timeline</label>
              <select
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E8E6E3] rounded-lg text-sm text-[#2C2925]"
              >
                <option value="urgent">Urgent</option>
                <option value="2-4_weeks">2–4 weeks</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-tertiary)] mb-1 font-medium">
              Note to all vendors (optional)
            </label>
            <textarea
              value={designerNote}
              onChange={(e) => setDesignerNote(e.target.value)}
              placeholder="Residential project targeting Fall 2026 install. Please provide trade pricing."
              rows={2}
              className="w-full px-3 py-2 bg-white border border-[#E8E6E3] rounded-lg text-[#2C2925] placeholder-[#A39E97] text-sm resize-none"
            />
          </div>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mt-3">
          This will send {vendorCount} quote request{vendorCount !== 1 ? 's' : ''} to {vendorCount} vendor{vendorCount !== 1 ? 's' : ''} for {selectedCount} product{selectedCount !== 1 ? 's' : ''}.
        </p>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ridge" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button variant="accent" onClick={handleSend} disabled={selectedCount === 0 || sending}>
            {sending ? 'Sending...' : 'Send All Requests'}
          </Button>
        </div>
      </div>
    </div>
  );
}
