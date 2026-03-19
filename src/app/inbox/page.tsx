'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ConversationPreview {
  id: string;
  subject: string | null;
  context: string;
  lastMessageAt: string | null;
  initiatorUser: { id: string; name: string; profileImage: string | null } | null;
  initiatorOrg: { id: string; name: string; logo: string | null } | null;
  recipientOrg: { id: string; name: string; logo: string | null } | null;
  messages: {
    id: string;
    body: string;
    sender: { id: string; name: string; profileImage: string | null };
  }[];
  participants: { unreadCount: number }[];
}

type Filter = 'all' | 'unread' | 'inquiries';

export default function InboxPage() {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/messages/inbox?filter=${filter}`)
      .then((res) => res.json())
      .then((data) => {
        setConversations(data.conversations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'inquiries', label: 'Inquiries' },
  ];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium" style={{ color: '#2C2825' }}>
          Inbox
        </h1>
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="px-3 py-1.5 rounded-full text-xs transition-colors"
              style={{
                backgroundColor: filter === f.id ? '#2C2825' : '#F0EDE9',
                color: filter === f.id ? '#fff' : '#5C554D',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl animate-pulse"
              style={{ backgroundColor: '#E8E4DF' }}
            />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: '#A69E96' }}>
            No messages yet.
          </p>
          <p className="text-xs mt-1" style={{ color: '#A69E96' }}>
            When someone reaches out through your profile, it&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <ConversationRow key={conv.id} conversation={conv} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationRow({ conversation }: { conversation: ConversationPreview }) {
  const lastMessage = conversation.messages[0];
  const unread = (conversation.participants[0]?.unreadCount ?? 0) > 0;
  const sender = conversation.initiatorUser || conversation.initiatorOrg;
  const senderName = sender?.name ?? 'Unknown';
  const senderImage = (sender as any)?.profileImage || (sender as any)?.logo || null;

  return (
    <Link href={`/inbox/${conversation.id}`}>
      <div
        className="flex items-start gap-4 p-4 rounded-xl border transition-colors cursor-pointer"
        style={{
          backgroundColor: unread ? '#fff' : 'rgba(245,243,240,0.5)',
          borderColor: unread ? '#E8E4DF' : 'transparent',
          boxShadow: unread ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
        }}
      >
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-medium"
          style={{
            backgroundColor: senderImage ? 'transparent' : '#E8E4DF',
            color: '#5C554D',
            overflow: 'hidden',
          }}
        >
          {senderImage ? (
            <img src={senderImage} alt={senderName} className="w-full h-full object-cover" />
          ) : (
            senderName.charAt(0).toUpperCase()
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span
              className="text-sm"
              style={{
                fontWeight: unread ? 600 : 400,
                color: unread ? '#2C2825' : '#5C554D',
              }}
            >
              {senderName}
            </span>
            <span className="text-xs" style={{ color: '#A69E96' }}>
              {conversation.lastMessageAt
                ? formatRelativeTime(conversation.lastMessageAt)
                : ''}
            </span>
          </div>

          {conversation.subject && (
            <p className="text-xs mt-0.5" style={{ color: '#8B8178' }}>
              {conversation.subject}
            </p>
          )}

          {lastMessage && (
            <p className="text-xs mt-1 truncate" style={{ color: '#8B8178' }}>
              {lastMessage.body}
            </p>
          )}
        </div>

        {unread && (
          <div
            className="w-2 h-2 rounded-full mt-1.5 shrink-0"
            style={{ backgroundColor: '#2C2825' }}
          />
        )}
      </div>
    </Link>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
