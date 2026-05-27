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
  // Marker for special conversation kinds (join requests, etc.) — see
  // pingAdminsOnJoinRequest in /api/orgs/[orgId]/join/route.ts for the
  // shape written. Unknown shapes are tolerated.
  structuredData: {
    kind?: string;
    joinRequestId?: string | null;
    organizationId?: string;
    requesterUserId?: string;
  } | null;
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
  // Inline Approve / Decline state for join-request conversations.
  const [joinAction, setJoinAction] = useState<'idle' | 'pending' | 'approved' | 'declined'>('idle');
  const [joinError, setJoinError] = useState<string | null>(null);

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

  async function handleJoinAction(action: 'approve' | 'reject') {
    const sd = conversation?.structuredData;
    if (!sd || sd.kind !== 'orgJoinRequest' || !sd.organizationId || !sd.joinRequestId) return;
    setJoinAction('pending');
    setJoinError(null);
    try {
      const res = await fetch(`/api/orgs/${sd.organizationId}/join`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: sd.joinRequestId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || `Could not ${action} the request.`);
        setJoinAction('idle');
        return;
      }
      setJoinAction(action === 'approve' ? 'approved' : 'declined');
    } catch {
      setJoinError(`Could not ${action} the request. Please try again.`);
      setJoinAction('idle');
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse"
              style={{ backgroundColor: '#E8E4DF' }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <p className="text-sm" style={{ color: '#A69E96' }}>
          Conversation not found.
        </p>
        <Link href="/inbox" className="text-sm underline mt-2 inline-block" style={{ color: '#5C554D' }}>
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
      <div className="flex items-center gap-3 pb-4" style={{ borderBottom: '1px solid #E8E4DF' }}>
        <Link href="/inbox" style={{ color: '#A69E96' }} className="hover:opacity-70">
          &larr;
        </Link>
        <div>
          <p className="text-sm font-medium" style={{ color: '#2C2825' }}>
            {otherName}
          </p>
          {conversation.subject && (
            <p className="text-xs" style={{ color: '#A69E96' }}>
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
          className="rounded-xl px-4 py-3 mt-4 flex items-start gap-2 text-xs"
          style={{
            backgroundColor: '#F5F3F0',
            borderColor: '#E8E4DF',
            border: '1px solid #E8E4DF',
            color: '#8B8178',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>{conversation.attributionNote}</span>
        </div>
      )}

      {/* Inline Approve / Decline for org join-request conversations.
          The banner appears only for admins (the requester themself sees the
          thread but no action bar, since they're matched out below). The
          PATCH endpoint enforces OWNER/ADMIN role server-side. */}
      {conversation.structuredData?.kind === 'orgJoinRequest' &&
        conversation.structuredData.organizationId &&
        conversation.structuredData.joinRequestId &&
        currentUserId !== conversation.structuredData.requesterUserId && (
          <div
            className="rounded-xl px-4 py-3 mt-4 flex items-center gap-3"
            style={{
              backgroundColor: '#F5F3F0',
              border: '1px solid #E8E4DF',
              color: '#2C2825',
            }}
          >
            <div className="flex-1 min-w-0">
              {joinAction === 'approved' ? (
                <p className="text-sm" style={{ color: '#3A6B47' }}>
                  Approved. They&rsquo;re now a member.
                </p>
              ) : joinAction === 'declined' ? (
                <p className="text-sm" style={{ color: '#A14040' }}>
                  Declined.
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium">Request to join</p>
                  <p className="text-xs" style={{ color: '#8B8178' }}>
                    Approve to add as a member. Decline to dismiss.
                  </p>
                </>
              )}
              {joinError ? (
                <p className="text-xs mt-1" style={{ color: '#A14040' }} role="alert">
                  {joinError}
                </p>
              ) : null}
            </div>
            {joinAction !== 'approved' && joinAction !== 'declined' ? (
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleJoinAction('reject')}
                  disabled={joinAction === 'pending'}
                  className="px-3 py-1.5 text-xs rounded-full transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ color: '#6B635B', border: '1px solid #D4CEC6' }}
                >
                  {joinAction === 'pending' ? '…' : 'Decline'}
                </button>
                <button
                  type="button"
                  onClick={() => handleJoinAction('approve')}
                  disabled={joinAction === 'pending'}
                  className="px-3 py-1.5 text-xs rounded-full transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: '#2C2825', color: '#fff' }}
                >
                  {joinAction === 'pending' ? 'Saving…' : 'Approve'}
                </button>
              </div>
            ) : null}
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
                className="max-w-[75%] rounded-2xl px-4 py-3"
                style={{
                  backgroundColor: isOwn ? '#2C2825' : '#F5F3F0',
                  color: isOwn ? '#fff' : '#2C2825',
                }}
              >
                {!isOwn && (
                  <p className="text-xs font-medium mb-1" style={{ color: '#8B8178' }}>
                    {msg.sender.name}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap" style={{ lineHeight: 'var(--lh-body)' }}>
                  {msg.body}
                </p>
                <p
                  className="text-[var(--type-fine)] mt-1"
                  style={{ color: isOwn ? 'rgba(255,255,255,0.5)' : '#A69E96' }}
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
      <div className="pt-4" style={{ borderTop: '1px solid #E8E4DF' }}>
        <div
          className="rounded-xl p-3"
          style={{ backgroundColor: '#F5F3F0', border: '1px solid #E8E4DF' }}
        >
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            rows={3}
            className="w-full text-sm bg-transparent resize-none focus:outline-none"
            style={{ color: '#2C2825' }}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={sendReply}
              disabled={!reply.trim() || sending}
              className="px-4 py-2 rounded-lg text-white text-xs disabled:opacity-40"
              style={{ backgroundColor: '#2C2825' }}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
