'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NotificationItem } from './NotificationItem';
import type { NotificationWithMeta } from '@/lib/notifications';

interface NotificationDropdownProps {
  notifications: NotificationWithMeta[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onClose,
  loading = false,
}: NotificationDropdownProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleNotificationClick = (notification: NotificationWithMeta) => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
      onClose();
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-[var(--border-subtle)] z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="font-semibold text-[var(--text-primary)]">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-sm font-normal text-[var(--text-secondary)]">
              {unreadCount} unread
            </span>
          )}
        </h3>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-[var(--text-secondary)]">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-secondary)]">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-[var(--text-tertiary)]"
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
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={() => onMarkRead(notification.id)}
                onClick={() => handleNotificationClick(notification)}
                compact
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <Link
            href="/notifications"
            onClick={onClose}
            className="text-sm text-[var(--accent)] hover:underline block text-center"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
