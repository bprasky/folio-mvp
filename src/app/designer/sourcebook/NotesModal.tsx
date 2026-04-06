'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productId: string;
  initialNotes: string | null;
  onSave: (productId: string, notes: string | null) => Promise<void>;
}

export default function NotesModal({
  isOpen,
  onClose,
  productName,
  productId,
  initialNotes,
  onSave,
}: NotesModalProps) {
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(initialNotes || '');
  }, [initialNotes, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(productId, notes.trim() || null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl">
        <h3 className="folio-h3 text-folio-text-primary mb-1">Notes</h3>
        <p className="text-sm text-folio-text-secondary mb-4">{productName}</p>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Lead times, quality observations, best use cases, client reactions..."
          rows={6}
          className="w-full px-3 py-2 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary placeholder-[#A39E97] focus:outline-none focus:border-folio-border-strong focus:shadow-[0_0_0_3px_rgba(0,0,0,0.03)] transition-all resize-none"
        />

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ridge" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Notes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
