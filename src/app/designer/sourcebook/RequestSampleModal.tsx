'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SampleRequestPayload } from '@/types/structured-requests';

interface RequestSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  vendorName: string;
  recipientUserId?: string;
  onSent: (conversationId: string) => void;
  onNeedResolution: () => void;
}

export default function RequestSampleModal({
  isOpen,
  onClose,
  productId,
  productName,
  vendorName,
  recipientUserId,
  onSent,
  onNeedResolution,
}: RequestSampleModalProps) {
  const [finishOrColorway, setFinishOrColorway] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [designerNote, setDesignerNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    setSending(true);
    setError(null);

    const payload: SampleRequestPayload = {
      type: 'SAMPLE_REQUEST',
      productId,
      productName,
      vendorName,
      finishOrColorway: finishOrColorway.trim() || undefined,
      shippingAddress: shippingAddress.trim() || undefined,
      designerNote: designerNote.trim() || undefined,
    };

    try {
      const res = await fetch('/api/designer/sourcebook/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'SAMPLE_REQUEST',
          productId,
          recipientUserId,
          payload,
        }),
      });

      const data = await res.json();

      if (data.resolutionNeeded) {
        onClose();
        onNeedResolution();
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Failed to send request');
        return;
      }

      onSent(data.conversationId);
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
      <div className="relative glass-surface rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📦</span>
          <h3 className="folio-h3 text-folio-text-primary">Request a Sample</h3>
        </div>
        <p className="text-sm text-folio-text-secondary mb-4">
          {productName} — {vendorName}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">
              Specific finish or colorway (optional)
            </label>
            <input
              type="text"
              value={finishOrColorway}
              onChange={(e) => setFinishOrColorway(e.target.value)}
              placeholder="e.g. Brass, Matte Black, Weathered White"
              className="w-full px-3 py-2 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary placeholder-[#A39E97] focus:outline-none focus:border-folio-border-strong transition-all"
            />
          </div>

          <div>
            <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">
              Ship to (optional)
            </label>
            <textarea
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="Your studio or project site address"
              rows={3}
              className="w-full px-3 py-2 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary placeholder-[#A39E97] focus:outline-none focus:border-folio-border-strong transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">
              Note to vendor (optional)
            </label>
            <textarea
              value={designerNote}
              onChange={(e) => setDesignerNote(e.target.value)}
              placeholder="I'm specifying this for an upcoming residential project..."
              rows={3}
              className="w-full px-3 py-2 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary placeholder-[#A39E97] focus:outline-none focus:border-folio-border-strong transition-all resize-none"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ridge" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button variant="accent" onClick={handleSend} disabled={sending}>
            {sending ? 'Sending...' : 'Send Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}
