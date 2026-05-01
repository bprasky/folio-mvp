'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '@/types/structured-requests';

interface ConversationPreview {
  id: string;
  subject: string | null;
  context: string;
  category?: string;
  structuredData?: Record<string, unknown>;
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

type Filter = 'all' | 'unread' | 'inquiries' | 'emails';
type CategoryFilter = 'all' | 'SAMPLE_REQUEST' | 'QUOTE_REQUEST' | 'LEAD_TIME_REQUEST' | 'PHOTO_REQUEST' | 'SPEC_REQUEST' | 'GENERAL' | 'COLLABORATION';

export default function InboxPage() {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [isVendor, setIsVendor] = useState(false);

  // Detect vendor user
  useEffect(() => {
    const role = (session?.user as Record<string, unknown>)?.role;
    setIsVendor(role === 'VENDOR');
  }, [session]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ filter });
    if (categoryFilter !== 'all') {
      params.set('category', categoryFilter);
    }
    fetch(`/api/messages/inbox?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setConversations(data.conversations || []);
        setCategoryCounts(data.categoryCounts || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter, categoryFilter]);

  const baseFilters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'inquiries', label: 'Inquiries' },
    { id: 'emails', label: 'Emails' },
  ];

  const categoryFilters: { id: CategoryFilter; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: '' },
    { id: 'SAMPLE_REQUEST', label: 'Samples', icon: CATEGORY_ICONS.SAMPLE_REQUEST },
    { id: 'QUOTE_REQUEST', label: 'Quotes', icon: CATEGORY_ICONS.QUOTE_REQUEST },
    { id: 'LEAD_TIME_REQUEST', label: 'Lead Time', icon: CATEGORY_ICONS.LEAD_TIME_REQUEST },
    { id: 'PHOTO_REQUEST', label: 'Photos', icon: CATEGORY_ICONS.PHOTO_REQUEST },
    { id: 'GENERAL', label: 'General', icon: CATEGORY_ICONS.GENERAL },
    { id: 'COLLABORATION', label: 'Collaborations', icon: CATEGORY_ICONS.COLLABORATION },
  ];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-medium" style={{ color: '#2C2825' }}>
          Inbox
        </h1>
        <div className="flex gap-1">
          {baseFilters.map((f) => (
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

      {/* Category tabs — shown for vendor users or when category data exists */}
      {(isVendor || Object.keys(categoryCounts).length > 1) && (
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {categoryFilters.map((cf) => {
            const count = cf.id === 'all'
              ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
              : categoryCounts[cf.id] || 0;

            return (
              <button
                key={cf.id}
                onClick={() => setCategoryFilter(cf.id)}
                className="px-3 py-1.5 rounded-full text-xs transition-colors whitespace-nowrap flex items-center gap-1"
                style={{
                  backgroundColor: categoryFilter === cf.id ? '#2C2825' : '#F0EDE9',
                  color: categoryFilter === cf.id ? '#fff' : '#5C554D',
                }}
              >
                {cf.icon && <span>{cf.icon}</span>}
                {cf.label}
                {count > 0 && (
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded-full text-[var(--type-fine)]"
                    style={{
                      backgroundColor: categoryFilter === cf.id ? 'rgba(255,255,255,0.2)' : '#E0DCD7',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

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
  const isEmail = conversation.context === 'FOLIO_EMAIL';
  const sender = conversation.initiatorUser || conversation.initiatorOrg;
  const senderName = sender?.name ?? 'Unknown';
  const senderImage = (sender as Record<string, unknown>)?.profileImage as string | null
    || (sender as Record<string, unknown>)?.logo as string | null
    || null;
  const category = conversation.category;
  const categoryIcon = category ? CATEGORY_ICONS[category] : undefined;
  const categoryLabel = category ? CATEGORY_LABELS[category] : undefined;

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
            <div className="flex items-center gap-2">
              <span
                className="text-sm"
                style={{
                  fontWeight: unread ? 600 : 400,
                  color: unread ? '#2C2825' : '#5C554D',
                }}
              >
                {senderName}
              </span>
              {isEmail && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#EDE8F5', color: '#6B5B8D' }}>
                  ✉️ via Folio Email
                </span>
              )}
              {!isEmail && categoryIcon && categoryLabel && categoryLabel !== 'General' && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#F0EDE9', color: '#5C554D' }}>
                  {categoryIcon} {categoryLabel}
                </span>
              )}
            </div>
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
