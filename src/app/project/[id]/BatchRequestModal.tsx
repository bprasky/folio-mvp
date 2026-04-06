'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';

interface SelectionItem {
  productId: string;
  productName: string;
  vendorName: string;
  roomName: string | null;
}

interface BatchRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  selections: SelectionItem[];
  requestType: 'lead-time' | 'availability';
  onSent: (sentCount: number) => void;
}

const CONFIG = {
  'lead-time': {
    title: 'Request Lead Times',
    icon: '⏱',
    endpoint: 'lead-time-request',
    description: 'Request current lead times from vendors.',
    buttonText: 'Send Lead Time Requests',
  },
  'availability': {
    title: 'Check Availability',
    icon: '📋',
    endpoint: 'availability-check',
    description: 'Check current availability from vendors.',
    buttonText: 'Send Availability Checks',
  },
};

export default function BatchRequestModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  selections,
  requestType,
  onSent,
}: BatchRequestModalProps) {
  const config = CONFIG[requestType];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(selections.map(s => s.productId))
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      }));

    try {
      const res = await fetch(`/api/projects/${projectId}/${config.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
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
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{config.icon}</span>
          <h3 className="folio-h3 text-folio-text-primary">{config.title}</h3>
        </div>
        <p className="text-sm text-folio-text-secondary mb-4">
          {projectName} — {config.description}
        </p>

        <div className="space-y-4 mb-4">
          {byVendor.map(([vendorName, vendorProducts]) => (
            <div key={vendorName}>
              <h4 className="text-sm font-semibold text-folio-text-primary mb-2">
                {vendorName} ({vendorProducts.length})
              </h4>
              <div className="space-y-1.5">
                {vendorProducts.map(sel => (
                  <label
                    key={sel.productId}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-ground transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(sel.productId)}
                      onChange={() => toggleProduct(sel.productId)}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-sm text-folio-text-primary">{sel.productName}</span>
                    {sel.roomName && (
                      <span className="text-xs text-folio-text-tertiary ml-auto">{sel.roomName}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-folio-text-secondary">
          This will send {vendorCount} request{vendorCount !== 1 ? 's' : ''} to {vendorCount} vendor{vendorCount !== 1 ? 's' : ''} for {selectedCount} product{selectedCount !== 1 ? 's' : ''}.
        </p>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ridge" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button variant="accent" onClick={handleSend} disabled={selectedCount === 0 || sending}>
            {sending ? 'Sending...' : config.buttonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
