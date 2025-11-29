/**
 * Logged Datastream Service
 * 
 * Wrapper untuk somniaDatastreamService.v3 yang menambahkan logging
 * untuk semua write operations
 */

import { somniaDatastreamService } from '@/services/somniaDatastreamService.v3';
import { interactionLogger } from './interactionLogger';
import type { PostDataV3, InteractionDataV3 } from '@/config/somniaDataStreams.v3';

class LoggedDatastreamService {
  /**
   * Create post with logging
   */
  async createPost(
    content: string,
    contentType: number,
    mediaHashes: string = '',
    quotedPostId: number = 0,
    replyToId: number = 0,
    mentions: string = '',
    userWalletAddress?: string
  ): Promise<any> {
    const wallet = userWalletAddress ? 'USER' : 'SERVER';
    const logId = interactionLogger.logStart('POST', wallet, {
      content,
      contentType,
      mediaHashes,
      quotedPostId,
      replyToId,
      mentions,
      author: userWalletAddress || 'server',
    });

    try {
      const result = await somniaDatastreamService.createPost(
        content,
        contentType,
        mediaHashes,
        quotedPostId,
        replyToId,
        mentions,
        userWalletAddress
      );

      interactionLogger.logSuccess(
        logId,
        result.txHash,
        result.publisherAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Create quote post with logging
   */
  async createQuotePost(
    content: string,
    quotedPostId: number,
    userWalletAddress?: string
  ): Promise<any> {
    const wallet = userWalletAddress ? 'USER' : 'SERVER';
    const logId = interactionLogger.logStart('QUOTE', wallet, {
      content,
      quotedPostId,
      author: userWalletAddress || 'server',
    });

    try {
      const result = await somniaDatastreamService.createPost(
        content,
        0, // TEXT
        '',
        quotedPostId,
        0,
        '',
        userWalletAddress
      );

      interactionLogger.logSuccess(
        logId,
        result.txHash,
        result.publisherAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Like post with logging
   */
  async likePost(postId: number, userWalletAddress?: string): Promise<any> {
    const wallet = userWalletAddress ? 'USER' : 'SERVER';
    const logId = interactionLogger.logStart('LIKE', wallet, {
      targetId: postId,
      fromUser: userWalletAddress || 'server',
    });

    try {
      const result = await somniaDatastreamService.likePost(postId, userWalletAddress);

      interactionLogger.logSuccess(
        logId,
        result.txHash,
        result.publisherAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Unlike post with logging
   */
  async unlikePost(postId: number, userWalletAddress?: string): Promise<any> {
    const wallet = userWalletAddress ? 'USER' : 'SERVER';
    const logId = interactionLogger.logStart('UNLIKE', wallet, {
      targetId: postId,
      fromUser: userWalletAddress || 'server',
    });

    try {
      const result = await somniaDatastreamService.unlikePost(postId, userWalletAddress);

      interactionLogger.logSuccess(
        logId,
        result.txHash,
        result.publisherAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Comment on post with logging
   */
  async commentOnPost(
    postId: number,
    content: string,
    userWalletAddress?: string
  ): Promise<any> {
    const wallet = userWalletAddress ? 'USER' : 'SERVER';
    const logId = interactionLogger.logStart('COMMENT', wallet, {
      targetId: postId,
      content,
      fromUser: userWalletAddress || 'server',
    });

    try {
      const result = await somniaDatastreamService.createPost(
        content,
        0, // TEXT
        '',
        0,
        postId, // replyToId
        '',
        userWalletAddress
      );

      interactionLogger.logSuccess(
        logId,
        result.txHash,
        result.publisherAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Repost with logging
   */
  async repost(postId: number, userWalletAddress?: string): Promise<any> {
    const wallet = userWalletAddress ? 'USER' : 'SERVER';
    const logId = interactionLogger.logStart('REPOST', wallet, {
      targetId: postId,
      fromUser: userWalletAddress || 'server',
    });

    try {
      const result = await somniaDatastreamService.repost(postId, userWalletAddress);

      interactionLogger.logSuccess(
        logId,
        result.txHash,
        result.publisherAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Unrepost with logging
   */
  async unrepost(postId: number, userWalletAddress?: string): Promise<any> {
    const wallet = userWalletAddress ? 'USER' : 'SERVER';
    const logId = interactionLogger.logStart('UNREPOST', wallet, {
      targetId: postId,
      fromUser: userWalletAddress || 'server',
    });

    try {
      const result = await somniaDatastreamService.unrepost(postId, userWalletAddress);

      interactionLogger.logSuccess(
        logId,
        result.txHash,
        result.publisherAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Bookmark post with logging
   */
  async bookmarkPost(postId: number, userWalletAddress?: string): Promise<any> {
    const wallet = userWalletAddress ? 'USER' : 'SERVER';
    const logId = interactionLogger.logStart('BOOKMARK', wallet, {
      targetId: postId,
      fromUser: userWalletAddress || 'server',
    });

    try {
      const result = await somniaDatastreamService.bookmarkPost(postId, userWalletAddress);

      interactionLogger.logSuccess(
        logId,
        result.txHash,
        result.publisherAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Unbookmark post with logging
   */
  async unbookmarkPost(postId: number, userWalletAddress?: string): Promise<any> {
    const wallet = userWalletAddress ? 'USER' : 'SERVER';
    const logId = interactionLogger.logStart('UNBOOKMARK', wallet, {
      targetId: postId,
      fromUser: userWalletAddress || 'server',
    });

    try {
      const result = await somniaDatastreamService.unbookmarkPost(postId, userWalletAddress);

      interactionLogger.logSuccess(
        logId,
        result.txHash,
        result.publisherAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  // Proxy all read methods (no logging needed)
  getAllPosts = somniaDatastreamService.getAllPosts.bind(somniaDatastreamService);
  getPostsPaginated = somniaDatastreamService.getPostsPaginated.bind(somniaDatastreamService);
  getAllInteractions = somniaDatastreamService.getAllInteractions.bind(somniaDatastreamService);
  getPostsWithStats = somniaDatastreamService.getPostsWithStats.bind(somniaDatastreamService);
  getPostById = somniaDatastreamService.getPostById.bind(somniaDatastreamService);
  getUserPosts = somniaDatastreamService.getUserPosts.bind(somniaDatastreamService);
  getPostComments = somniaDatastreamService.getPostComments.bind(somniaDatastreamService);
  connect = somniaDatastreamService.connect.bind(somniaDatastreamService);
  isConnected = somniaDatastreamService.isConnected.bind(somniaDatastreamService);
}

export const loggedDatastreamService = new LoggedDatastreamService();
export default loggedDatastreamService;

  /**
   * Track play event with logging
   */
  async trackPlayEvent(
    tokenId: number,
    listenerAddress: string,
    duration: number,
    source: string = 'web'
  ): Promise<any> {
    const logId = interactionLogger.logStart('PLAY_COUNT', 'USER', {
      trackId: tokenId.toString(),
      fromUser: listenerAddress,
      playDuration: duration,
      content: source,
    });

    try {
      // Call the actual service method
      const result = await somniaDatastreamService.trackPlayEvent(
        tokenId,
        listenerAddress,
        duration,
        source
      );

      interactionLogger.logSuccess(
        logId,
        result.txHash || 'N/A',
        result.publisherAddress || listenerAddress,
        {
          tokenId,
          duration,
          source,
          ...result,
        }
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }
