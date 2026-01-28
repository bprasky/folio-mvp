'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationItem } from './NotificationItem';
import { groupNotificationsByDate } from '@/lib/notifications';
import type { NotificationWithMeta } from '@/lib/notifications';
import { Button } from '@/components/ui/button';

interface NotificationListProps {
  initialNotifications?: NotificationWithMeta[];
  initialUnreadCount?: number;
}

export function NotificationList({
  initialNotifications = [],
  initialUnreadCount = 0,
}: NotificationListProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationWithMeta[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(!initialNotifications.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const fetchNotifications = useCallback(async (currentOffset: number, append: boolean = false) => {
    try {
      const response = await fetch(
        `/api/notifications?limit=${LIMIT}&offset=${currentOffset}`
      );
      if (response.ok) {
        const data = await response.json();
        if (append) {
          setNotifications((prev) => [...prev, ...data.notifications]);
        } else {
          setNotifications(data.notifications);
        }
        setUnreadCount(data.unreadCount);
        setHasMore(data.notifications.length === LIMIT);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!initialNotifications.length) {
      setLoading(true);
      fetchNotifications(0).finally(() => setLoading(false));
    }
  }, [fetchNotifications, initialNotifications.length]);

  const handleLoadMore = async () => {
    const newOffset = offset + LIMIT;
    setLoadingMore(true);
    await fetchNotifications(newOffset, true);
    setOffset(newOffset);
    setLoadingMore(false);
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true, readAt: new Date() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, read: true, readAt: new Date() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleNotificationClick = (notification: NotificationWithMeta) => {
    if (!notification.read) {
      handleMarkRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const groupedNotifications = groupNotificationsByDate(notifications);

  if (loading) {
    return (
      <div className="py-12 text-center text-[var(--text-secondary)]">
        Loading notifications...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="py-12 text-center">
        <svg
          className="w-16 h-16 mx-auto mb-4 text-[var(--text-tertiary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <h3 className="folio-h3 mb-2">No notifications yet</h3>
        <p className="folio-body text-[var(--text-secondary)]">
          When you have new activity, it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with mark all read */}
      {unreadCount > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            Mark all as read ({unreadCount})
          </button>
        </div>
      )}

      {/* Grouped notifications */}
      <div className="space-y-6">
        {Object.entries(groupedNotifications).map(([group, items]) => (
          <div key={group}>
            <h3 className="folio-meta text-[var(--text-secondary)] mb-3 px-3">
              {group}
            </h3>
            <div className="bg-white rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
              {items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => handleMarkRead(notification.id)}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-6 text-center">
          <Button
            variant="ridge"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
