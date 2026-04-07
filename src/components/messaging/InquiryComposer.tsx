'use client';

import { useState } from 'react';

interface InquiryComposerProps {
  recipientOrg: { id: string; name: string };
  context?: string;
  placeholder?: string;
  onSent: (conversationId: string) => void;
}

export default function InquiryComposer({
  recipientOrg,
  context = 'CLIENT_INQUIRY',
  placeholder = 'Tell them about your project...',
  onSent,
}: InquiryComposerProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientOrgId: recipientOrg.id,
          subject: subject.trim() || undefined,
          body: body.trim(),
          context,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to send message');
        setSending(false);
        return;
      }

      const { conversationId } = await res.json();
      onSent(conversationId);
    } catch {
      setError('Something went wrong. Please try again.');
      setSending(false);
    }
  }

  return (
    <div
      className="glass-surface glass-surface-sm p-6 space-y-4"
    >
      <h3
        className="text-sm font-medium text-folio-text-secondary"
      >
        Send {recipientOrg.name} a message
      </h3>

      <input
        type="text"
        placeholder="Subject (optional)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-full text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-1 bg-surface-elevated border border-folio-border-subtle"
      />

      <textarea
        placeholder={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className="w-full text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-1 bg-surface-elevated border border-folio-border-subtle"
      />

      {error && (
        <p className="text-sm" style={{ color: '#c53030' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleSend}
        disabled={!body.trim() || sending}
        className="w-full py-3 rounded-xl text-white text-sm transition-opacity disabled:opacity-40 bg-folio-text-primary"
      >
        {sending ? 'Sending...' : 'Send message'}
      </button>

      <p
        className="text-xs text-center text-folio-text-tertiary"
      >
        Messages go to {recipientOrg.name}&apos;s Folio inbox.
        They typically respond within a few days.
      </p>
    </div>
  );
}
