'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ContactRepModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  vendorName: string;
  recipientUserId?: string;
  onSent: (conversationId: string) => void;
  onNeedResolution: () => void;
}

export default function ContactRepModal({
  isOpen,
  onClose,
  productId,
  productName,
  vendorName,
  recipientUserId,
  onSent,
  onNeedResolution,
}: ContactRepModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/designer/sourcebook/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'GENERAL',
          productId,
          recipientUserId,
          payload: {
            type: 'GENERAL',
            productId,
            productName,
            vendorName,
          },
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (data.resolutionNeeded) {
        onClose();
        onNeedResolution();
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Failed to send message');
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
          <span className="text-lg">💬</span>
          <h3 className="folio-h3 text-[var(--text-primary)]">Contact Rep</h3>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {productName} — {vendorName}
        </p>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Quick question about finishes, lead times, pricing..."
          rows={5}
          className="w-full px-3 py-2 bg-white border border-[#E8E6E3] rounded-lg text-[#2C2925] placeholder-[#A39E97] focus:outline-none focus:border-[#C9C4BC] transition-all resize-none"
        />

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ridge" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button variant="accent" onClick={handleSend} disabled={!message.trim() || sending}>
            {sending ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </div>
    </div>
  );
}
