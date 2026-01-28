'use client';

import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/notifications';
import type { NotificationWithMeta } from '@/lib/notifications';

interface NotificationItemProps {
  notification: NotificationWithMeta;
  onRead?: () => void;
  onClick?: () => void;
  compact?: boolean;
}

const typeIcons: Record<string, React.ReactNode> = {
  CONTRIBUTION_PUBLISHED: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  BADGE_EARNED: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  NEW_TOPIC_AVAILABLE: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  BOOST_OPPORTUNITY: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  TESTIMONIAL_BOOSTED: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  ),
};

const defaultIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const typeColors: Record<string, string> = {
  CONTRIBUTION_PUBLISHED: 'bg-emerald-100 text-emerald-700',
  BADGE_EARNED: 'bg-amber-100 text-amber-700',
  NEW_TOPIC_AVAILABLE: 'bg-blue-100 text-blue-700',
  BOOST_OPPORTUNITY: 'bg-purple-100 text-purple-700',
  TESTIMONIAL_BOOSTED: 'bg-pink-100 text-pink-700',
};

export function NotificationItem({
  notification,
  onRead,
  onClick,
  compact = false,
}: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.read && onRead) {
      onRead();
    }
    if (onClick) {
      onClick();
    }
  };

  const icon = typeIcons[notification.type] || defaultIcon;
  const colorClass = typeColors[notification.type] || 'bg-stone-100 text-stone-700';

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left flex items-start gap-3 p-3 rounded-lg transition-colors',
        'hover:bg-[var(--bg-elevated)]',
        !notification.read && 'bg-blue-50/50',
        compact && 'py-2'
      )}
    >
      {/* Unread indicator */}
      <div className="flex-shrink-0 pt-1">
        {!notification.read && (
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        )}
        {notification.read && <div className="w-2 h-2" />}
      </div>

      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
          colorClass
        )}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm text-[var(--text-primary)]',
            !notification.read && 'font-medium'
          )}
        >
          {notification.title}
        </p>
        <p
          className={cn(
            'text-sm text-[var(--text-secondary)] line-clamp-2',
            compact && 'line-clamp-1'
          )}
        >
          {notification.body}
        </p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>
    </button>
  );
}
