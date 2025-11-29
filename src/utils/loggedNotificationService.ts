/**
 * Logged Notification Service
 * 
 * Wrapper untuk notificationService yang menambahkan logging
 */

import { notificationService } from '@/services/notificationService';
import { interactionLogger } from './interactionLogger';

class LoggedNotificationService {
  /**
   * Mark notification as read with logging
   */
  async markAsRead(notificationId: string, userAddress: string): Promise<any> {
    const logId = interactionLogger.logStart('MARK_READ_NOTIF', 'USER', {
      notificationId,
      fromUser: userAddress,
    });

    try {
      const result = await notificationService.markAsRead(notificationId, userAddress);

      interactionLogger.logSuccess(
        logId,
        result?.txHash || 'N/A',
        result?.publisherAddress || userAddress,
        {
          notificationId,
          ...result,
        }
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read with logging
   */
  async markAllAsRead(userAddress: string): Promise<any> {
    const logId = interactionLogger.logStart('MARK_READ_NOTIF', 'USER', {
      fromUser: userAddress,
      content: 'Mark all as read',
    });

    try {
      const result = await notificationService.markAllAsRead(userAddress);

      interactionLogger.logSuccess(
        logId,
        'BATCH',
        userAddress,
        {
          action: 'mark_all_read',
          ...result,
        }
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  // Proxy all read methods
  getNotifications = notificationService.getNotifications.bind(notificationService);
  getUnreadCount = notificationService.getUnreadCount.bind(notificationService);
  subscribeToNotifications = notificationService.subscribeToNotifications.bind(notificationService);
}

export const loggedNotificationService = new LoggedNotificationService();
export default loggedNotificationService;
