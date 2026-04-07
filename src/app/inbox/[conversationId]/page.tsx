'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface MessageData {
  id: string;
  body: string;
  createdAt: string;
  senderUserId: string;
  sender: {
    id: string;
    name: string;
    profileImage: string | null;
  };
}

interface ConversationData {
  id: string;
  subject: string | null;
  context: string;
  attributionNote: string | null;
  initiatorUser: { id: string; name: string; profileImage: string | null } | null;
  recipientOrg: { id: string; name: string; logo: string | null } | null;
  recipientUser: { id: string; name: string; profileImage: string | null } | null;
  messages: MessageData[];
  emailThread?: {
    id: string;
    recipientEmail: string;
    recipientName: string | null;
    status: string;
  } | null;
}

export default function ThreadPage({
  params,
}: {
  params: { conversationId: string } | Promise<{ conversationId: string }>;
}) {
  const { data: session } = useSession();
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = params instanceof Promise ? await params : params;
      setResolvedId(p.conversationId);
    })();
  }, [params]);

  useEffect(() => {
    if (!resolvedId) return;
    fetch(`/api/messages/conversations/${resolvedId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        setConversation(data.conversation);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [resolvedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  async function sendReply() {
    if (!reply.trim() || !resolvedId) return;
    setSending(true);

    try {
      // For email threads, send via the email reply endpoint
      if (conversation?.context === 'FOLIO_EMAIL' && conversation.emailThread?.id) {
        const res = await fetch(`/api/email/threads/${conversation.emailThread.id}/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: reply.trim() }),
        });

        if (res.ok) {
          const newMessage: MessageData = {
            id: `temp-${Date.now()}`,
            body: reply.trim(),
            createdAt: new Date().toISOString(),
            senderUserId: currentUserId || '',
            sender: { id: currentUserId || '', name: 'You', profileImage: null },
          };
          setConversation((prev) =>
            prev ? { ...prev, messages: [...prev.messages, newMessage] } : prev
          );
          setReply('');
        }
      } else {
        const res = await fetch(`/api/messages/conversations/${resolvedId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: reply.trim() }),
        });

        if (res.ok) {
          const { message } = await res.json();
          setConversation((prev) =>
            prev
              ? { ...prev, messages: [...prev.messages, message] }
              : prev
          );
          setReply('');
        }
      }
    } catch {
      // Silently fail
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse bg-folio-border-subtle"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <p className="text-sm text-folio-text-tertiary">
          Conversation not found.
        </p>
        <Link href="/inbox" className="text-sm underline mt-2 inline-block text-folio-text-secondary">
          Back to inbox
        </Link>
      </div>
    );
  }

  // Determine the "other party" name for the header
  const currentUserId = session?.user?.id;
  const otherParty =
    conversation.initiatorUser?.id === currentUserId
      ? conversation.recipientOrg || conversation.recipientUser
      : conversation.initiatorUser;
  const otherName = otherParty?.name ?? 'Unknown';

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-folio-border-subtle">
        <Link href="/inbox" className="text-folio-text-tertiary hover:opacity-70">
          &larr;
        </Link>
        <div>
          <p className="text-sm font-medium text-folio-text-primary">
            {otherName}
          </p>
          {conversation.subject && (
            <p className="text-xs text-folio-text-tertiary">
              {conversation.subject}
            </p>
          )}
        </div>
      </div>

      {/* Email thread indicator */}
      {conversation.context === 'FOLIO_EMAIL' && conversation.emailThread && (
        <div
          className="rounded-xl px-4 py-3 mt-4 flex items-start gap-2 text-xs"
          style={{
            backgroundColor: '#F0EDF5',
            border: '1px solid #DDD8E8',
            color: '#6B5B8D',
          }}
        >
          <span className="mt-0.5 shrink-0">✉️</span>
          <span>
            Sent via Folio Email to {conversation.emailThread.recipientName || conversation.emailThread.recipientEmail}
            {conversation.emailThread.status === 'REPLIED' && ' — Reply received'}
          </span>
        </div>
      )}

      {/* Attribution note for vendor outreach */}
      {conversation.context === 'VENDOR_OUTREACH' && conversation.attributionNote && (
        <div
          className="rounded-xl px-4 py-3 mt-4 flex items-start gap-2 text-xs bg-surface-elevated border border-folio-border-subtle text-folio-text-secondary"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>{conversation.attributionNote}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {conversation.messages.map((msg) => {
          const isOwn = msg.senderUserId === currentUserId;
          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  isOwn ? 'bg-folio-text-primary text-white' : 'bg-surface-elevated text-folio-text-primary'
                }`}
              >
                {!isOwn && (
                  <p className="text-xs font-medium mb-1 text-folio-text-secondary">
                    {msg.sender.name}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap" style={{ lineHeight: '1.5' }}>
                  {msg.body}
                </p>
                <p
                  className={`text-[10px] mt-1 ${isOwn ? '' : 'text-folio-text-tertiary'}`}
                  style={isOwn ? { color: 'rgba(255,255,255,0.5)' } : undefined}
                >
                  {new Date(msg.createdAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply composer */}
      <div className="pt-4 border-t border-folio-border-subtle">
        <div
          className="rounded-xl p-3 bg-surface-elevated border border-folio-border-subtle"
        >
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            rows={3}
            className="w-full text-sm bg-transparent resize-none focus:outline-none text-folio-text-primary"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={sendReply}
              disabled={!reply.trim() || sending}
              className="px-4 py-2 rounded-lg text-white text-xs disabled:opacity-40 bg-folio-text-primary"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
