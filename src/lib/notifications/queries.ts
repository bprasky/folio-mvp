/**
 * Notification Queries
 * Functions for fetching and managing notifications
 */

import { prisma } from '@/lib/prisma';

export interface NotificationWithMeta {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  metadata: Record<string, any> | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationsResponse {
  notifications: NotificationWithMeta[];
  unreadCount: number;
  total: number;
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(
  userId: string,
  limit: number = 10
): Promise<NotificationWithMeta[]> {
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      read: false,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return notifications.map((n) => ({
    ...n,
    metadata: n.metadata as Record<string, any> | null,
  }));
}

/**
 * Get notifications for a user with pagination
 */
export async function getNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    includeRead?: boolean;
  } = {}
): Promise<NotificationsResponse> {
  const { limit = 20, offset = 0, includeRead = true } = options;

  const whereClause = {
    userId,
    ...(includeRead ? {} : { read: false }),
  };

  const [notifications, unreadCount, total] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({
      where: { userId, read: false },
    }),
    prisma.notification.count({
      where: whereClause,
    }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      ...n,
      metadata: n.metadata as Record<string, any> | null,
    })),
    unreadCount,
    total,
  };
}

/**
 * Get unread count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

/**
 * Mark a notification as read
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<NotificationWithMeta | null> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) return null;

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  return {
    ...updated,
    metadata: updated.metadata as Record<string, any> | null,
  };
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  return result.count;
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) return false;

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return true;
}

/**
 * Group notifications by date for display
 */
export function groupNotificationsByDate(
  notifications: NotificationWithMeta[]
): Record<string, NotificationWithMeta[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<string, NotificationWithMeta[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Earlier: [],
  };

  for (const notification of notifications) {
    const createdAt = new Date(notification.createdAt);

    if (createdAt >= today) {
      groups['Today'].push(notification);
    } else if (createdAt >= yesterday) {
      groups['Yesterday'].push(notification);
    } else if (createdAt >= thisWeek) {
      groups['This Week'].push(notification);
    } else {
      groups['Earlier'].push(notification);
    }
  }

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(groups).filter(([, items]) => items.length > 0)
  );
}

/**
 * Get icon name for notification type
 */
export function getNotificationIcon(type: string): string {
  const icons: Record<string, string> = {
    CONTRIBUTION_PUBLISHED: 'sparkles',
    BADGE_EARNED: 'trophy',
    NEW_TOPIC_AVAILABLE: 'document',
    BOOST_OPPORTUNITY: 'currency',
    TESTIMONIAL_BOOSTED: 'megaphone',
  };
  return icons[type] || 'bell';
}

/**
 * Format time ago for notifications
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
