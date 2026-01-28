/**
 * Notification System
 * Centralized notification handling
 */

// Creation/sending functions
export {
  notifyContributionPublished,
  notifyBadgeEarned,
  notifyNewTopicMatchingUsers,
  CONTRIBUTION_NOTIFICATION_TYPES,
} from './contribution';

// Query functions
export {
  getUnreadNotifications,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  groupNotificationsByDate,
  getNotificationIcon,
  formatTimeAgo,
  type NotificationWithMeta,
  type NotificationsResponse,
} from './queries';
