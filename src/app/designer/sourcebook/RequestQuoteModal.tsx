'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { QuoteRequestPayload } from '@/types/structured-requests';

interface Project {
  id: string;
  title: string;
}

interface RequestQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  vendorName: string;
  recipientUserId?: string;
  onSent: (conversationId: string) => void;
  onNeedResolution: () => void;
}

export default function RequestQuoteModal({
  isOpen,
  onClose,
  productId,
  productName,
  vendorName,
  recipientUserId,
  onSent,
  onNeedResolution,
}: RequestQuoteModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [timeline, setTimeline] = useState<'urgent' | '2-4_weeks' | 'flexible'>('flexible');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [notes, setNotes] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/projects?mine=true')
        .then(res => res.json())
        .then(data => setProjects(data.projects || data || []))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find(p => p.id === projectId);
    setSelectedProjectName(project?.title || '');
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);

    const payload: QuoteRequestPayload = {
      type: 'QUOTE_REQUEST',
      productId,
      productName,
      vendorName,
      quantity,
      timeline,
      projectId: selectedProjectId || undefined,
      projectName: selectedProjectName || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      const res = await fetch('/api/designer/sourcebook/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'QUOTE_REQUEST',
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
          <span className="text-lg">💰</span>
          <h3 className="folio-h3 text-folio-text-primary">Request a Quote</h3>
        </div>
        <p className="text-sm text-folio-text-secondary mb-4">
          {productName} — {vendorName}
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">
                Quantity
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary focus:outline-none focus:border-folio-border-strong transition-all"
              />
            </div>

            <div>
              <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">
                Timeline
              </label>
              <select
                value={timeline}
                onChange={(e) => setTimeline(e.target.value as typeof timeline)}
                className="w-full px-3 py-2 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary focus:outline-none focus:border-folio-border-strong transition-all"
              >
                <option value="urgent">Urgent</option>
                <option value="2-4_weeks">2–4 weeks</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">
              Project (optional)
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full px-3 py-2 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary focus:outline-none focus:border-folio-border-strong transition-all"
            >
              <option value="">Select a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Specific finish, custom dimensions, trade pricing..."
              rows={3}
              className="w-full px-3 py-2 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary placeholder-[#A39E97] focus:outline-none focus:border-folio-border-strong transition-all resize-none"
            />
          </div>
        </div>

        <p className="text-xs text-folio-text-tertiary mt-3">
          Please provide pricing including trade discount if applicable. Resale cert on file with Folio.
        </p>

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
