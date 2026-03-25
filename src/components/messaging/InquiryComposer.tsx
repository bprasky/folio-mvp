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
      className="glass-surface-sm rounded-2xl p-6 space-y-4"
    >
      <h3
        className="text-sm font-medium"
        style={{ color: '#5C554D' }}
      >
        Send {recipientOrg.name} a message
      </h3>

      <input
        type="text"
        placeholder="Subject (optional)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-full text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-1"
        style={{
          backgroundColor: '#F5F3F0',
          borderColor: '#E8E4DF',
          border: '1px solid #E8E4DF',
        }}
      />

      <textarea
        placeholder={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className="w-full text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-1"
        style={{
          backgroundColor: '#F5F3F0',
          borderColor: '#E8E4DF',
          border: '1px solid #E8E4DF',
        }}
      />

      {error && (
        <p className="text-sm" style={{ color: '#c53030' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleSend}
        disabled={!body.trim() || sending}
        className="w-full py-3 rounded-xl text-white text-sm transition-opacity disabled:opacity-40"
        style={{ backgroundColor: '#2C2825' }}
      >
        {sending ? 'Sending...' : 'Send message'}
      </button>

      <p
        className="text-xs text-center"
        style={{ color: '#A69E96' }}
      >
        Messages go to {recipientOrg.name}&apos;s Folio inbox.
        They typically respond within a few days.
      </p>
    </div>
  );
}
