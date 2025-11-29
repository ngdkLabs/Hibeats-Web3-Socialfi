/**
 * Logged Messaging Service
 * 
 * Wrapper untuk messagingServiceV2 yang menambahkan logging
 */

import { messagingServiceV2 } from '@/services/messagingServiceV2';
import { interactionLogger } from './interactionLogger';

class LoggedMessagingService {
  /**
   * Send message with logging
   */
  async sendMessage(
    recipientAddress: string,
    content: string,
    contentType: string = 'text',
    metadata?: any
  ): Promise<any> {
    const logId = interactionLogger.logStart('SEND_MESSAGE', 'USER', {
      recipientAddress,
      content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      contentType,
    });

    try {
      const result = await messagingServiceV2.sendMessage(
        recipientAddress,
        content,
        contentType,
        metadata
      );

      interactionLogger.logSuccess(
        logId,
        result.txHash || 'N/A',
        result.publisherAddress || 'N/A',
        {
          messageId: result.messageId,
          conversationId: result.conversationId,
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
  getConversations = messagingServiceV2.getConversations.bind(messagingServiceV2);
  getMessages = messagingServiceV2.getMessages.bind(messagingServiceV2);
  markAsRead = messagingServiceV2.markAsRead.bind(messagingServiceV2);
  deleteMessage = messagingServiceV2.deleteMessage.bind(messagingServiceV2);
  getUnreadCount = messagingServiceV2.getUnreadCount.bind(messagingServiceV2);
}

export const loggedMessagingService = new LoggedMessagingService();
export default loggedMessagingService;
