'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface PreviousOrder {
  id: string;
  createdAt: string;
  quantity: number;
  tradeAmount: number;
  notes: string | null;
}

interface ReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  vendorName: string;
}

export default function ReorderModal({
  isOpen,
  onClose,
  productId,
  productName,
  vendorName,
}: ReorderModalProps) {
  const [previousOrder, setPreviousOrder] = useState<PreviousOrder | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      // Fetch previous order for this product
      fetch(`/api/commerce/orders?productId=${productId}&limit=1`)
        .then(res => res.ok ? res.json() : { orders: [] })
        .then(data => {
          const order = data.orders?.[0];
          if (order) {
            setPreviousOrder({
              id: order.id,
              createdAt: order.createdAt,
              quantity: order.items?.[0]?.quantity || 1,
              tradeAmount: order.tradeAmountCents ? order.tradeAmountCents / 100 : 0,
              notes: order.notes,
            });
            setQuantity(order.items?.[0]?.quantity || 1);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen, productId]);

  if (!isOpen) return null;

  const handleReorder = async () => {
    setSending(true);
    setError(null);

    try {
      // Send as a structured quote request for the reorder
      const res = await fetch('/api/designer/sourcebook/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'REORDER_REQUEST',
          productId,
          payload: {
            type: 'REORDER_REQUEST',
            productId,
            productName,
            vendorName,
            quantity,
            previousOrderId: previousOrder?.id,
            previousQuantity: previousOrder?.quantity,
            previousPrice: previousOrder?.tradeAmount,
          },
          message: `Reorder request for ${productName} from ${vendorName}.\n\nQuantity: ${quantity}${previousOrder ? `\n\nPrevious order: ${new Date(previousOrder.createdAt).toLocaleDateString()} · Qty: ${previousOrder.quantity} · $${previousOrder.tradeAmount.toLocaleString()} (trade)` : ''}\n\nPlease confirm current pricing before processing.${notes ? `\n\nNotes: ${notes}` : ''}`,
        }),
      });

      const data = await res.json();

      if (data.resolutionNeeded) {
        setError('Could not find a rep for this vendor. Use Contact Rep to reach out first.');
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Failed to send reorder request');
        return;
      }

      window.location.href = `/inbox/${data.conversationId}`;
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🔄</span>
          <h3 className="folio-h3 text-folio-text-primary">Reorder</h3>
        </div>
        <p className="text-sm text-folio-text-secondary mb-4">
          {productName} — {vendorName}
        </p>

        {loading ? (
          <div className="py-4 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent)]" />
          </div>
        ) : (
          <>
            {previousOrder && (
              <div className="glass-surface rounded-lg p-3 mb-4 text-sm">
                <div className="text-folio-text-tertiary text-xs mb-1">Previous order</div>
                <div className="text-folio-text-primary">
                  {new Date(previousOrder.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}Qty: {previousOrder.quantity}
                  {previousOrder.tradeAmount > 0 && ` · $${previousOrder.tradeAmount.toLocaleString()} (trade)`}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any changes from the previous order..."
                  rows={2}
                  className="w-full px-3 py-2 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary placeholder-[#A39E97] resize-none"
                />
              </div>
            </div>

            <p className="text-xs text-folio-text-tertiary mt-3">
              Price may have changed. Quote will be confirmed before charging.
            </p>

            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ridge" onClick={onClose} disabled={sending}>Cancel</Button>
              <Button variant="accent" onClick={handleReorder} disabled={sending}>
                {sending ? 'Sending...' : 'Request Reorder Quote'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
