/**
 * Logged Music Interaction Service
 * 
 * Wrapper untuk musicInteractionService dengan comprehensive logging
 * untuk tracking semua music interactions (song & album likes)
 */

import { musicInteractionService } from '@/services/musicInteractionService';
import { interactionLogger } from './interactionLogger';

class LoggedMusicInteractionService {
  // ===== SONG INTERACTIONS =====

  /**
   * Like a song with logging
   */
  async likeSong(songId: number, userAddress: string, userWalletClient?: any): Promise<any> {
    const logId = interactionLogger.logStart('LIKE_SONG', 'BATCH', {
      targetId: songId,
      fromUser: userAddress,
      contentType: 'SONG',
      interactionType: 1, // LIKE
    });

    try {
      const result = await musicInteractionService.likeSong(songId, userAddress, userWalletClient);
      
      interactionLogger.logSuccess(
        logId,
        result.txHash || 'BATCH_QUEUED',
        result.publisherAddress || userAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Unlike a song with logging
   */
  async unlikeSong(songId: number, userAddress: string, userWalletClient?: any): Promise<any> {
    const logId = interactionLogger.logStart('UNLIKE_SONG', 'BATCH', {
      targetId: songId,
      fromUser: userAddress,
      contentType: 'SONG',
      interactionType: 2, // UNLIKE
    });

    try {
      const result = await musicInteractionService.unlikeSong(songId, userAddress, userWalletClient);
      
      interactionLogger.logSuccess(
        logId,
        result.txHash || 'BATCH_QUEUED',
        result.publisherAddress || userAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Check if song is liked (no logging needed for reads)
   */
  async isSongLiked(songId: number, userAddress: string): Promise<boolean> {
    return musicInteractionService.isSongLiked(songId, userAddress);
  }

  /**
   * Get song like count (no logging needed for reads)
   */
  async getSongLikeCount(songId: number): Promise<number> {
    return musicInteractionService.getSongLikeCount(songId);
  }

  // ===== ALBUM INTERACTIONS =====

  /**
   * Like an album with logging
   */
  async likeAlbum(albumId: number, userAddress: string, userWalletClient?: any): Promise<any> {
    const logId = interactionLogger.logStart('LIKE_ALBUM', 'BATCH', {
      targetId: albumId,
      fromUser: userAddress,
      contentType: 'ALBUM',
      interactionType: 1, // LIKE
    });

    try {
      const result = await musicInteractionService.likeAlbum(albumId, userAddress, userWalletClient);
      
      interactionLogger.logSuccess(
        logId,
        result.txHash || 'BATCH_QUEUED',
        result.publisherAddress || userAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Unlike an album with logging
   */
  async unlikeAlbum(albumId: number, userAddress: string, userWalletClient?: any): Promise<any> {
    const logId = interactionLogger.logStart('UNLIKE_ALBUM', 'BATCH', {
      targetId: albumId,
      fromUser: userAddress,
      contentType: 'ALBUM',
      interactionType: 2, // UNLIKE
    });

    try {
      const result = await musicInteractionService.unlikeAlbum(albumId, userAddress, userWalletClient);
      
      interactionLogger.logSuccess(
        logId,
        result.txHash || 'BATCH_QUEUED',
        result.publisherAddress || userAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Check if album is liked (no logging needed for reads)
   */
  async isAlbumLiked(albumId: number, userAddress: string): Promise<boolean> {
    return musicInteractionService.isAlbumLiked(albumId, userAddress);
  }

  /**
   * Get album like count (no logging needed for reads)
   */
  async getAlbumLikeCount(albumId: number): Promise<number> {
    return musicInteractionService.getAlbumLikeCount(albumId);
  }

  // ===== PLAYLIST INTERACTIONS =====
  // (Playlist interactions use immediate flush, so we log them too)

  /**
   * Save playlist with logging
   */
  async savePlaylist(playlistId: string, userAddress: string, userWalletClient?: any): Promise<any> {
    const logId = interactionLogger.logStart('BOOKMARK', 'USER', {
      targetId: playlistId,
      fromUser: userAddress,
      contentType: 'PLAYLIST',
    });

    try {
      const result = await musicInteractionService.savePlaylist(playlistId, userAddress, userWalletClient);
      
      interactionLogger.logSuccess(
        logId,
        result.txHash || 'IMMEDIATE',
        result.publisherAddress || userAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Unsave playlist with logging
   */
  async unsavePlaylist(playlistId: string, userAddress: string, userWalletClient?: any): Promise<any> {
    const logId = interactionLogger.logStart('UNBOOKMARK', 'USER', {
      targetId: playlistId,
      fromUser: userAddress,
      contentType: 'PLAYLIST',
    });

    try {
      const result = await musicInteractionService.unsavePlaylist(playlistId, userAddress, userWalletClient);
      
      interactionLogger.logSuccess(
        logId,
        result.txHash || 'IMMEDIATE',
        result.publisherAddress || userAddress,
        result
      );

      return result;
    } catch (error) {
      interactionLogger.logFailure(logId, error as Error);
      throw error;
    }
  }

  /**
   * Check if playlist is saved (no logging needed for reads)
   */
  async isPlaylistSaved(playlistId: string, userAddress: string): Promise<boolean> {
    return musicInteractionService.isPlaylistSaved(playlistId, userAddress);
  }

  /**
   * Get saved playlists (no logging needed for reads)
   */
  async getSavedPlaylists(userAddress: string): Promise<string[]> {
    return musicInteractionService.getSavedPlaylists(userAddress);
  }
}

// Export singleton instance
export const loggedMusicInteractionService = new LoggedMusicInteractionService();
export default loggedMusicInteractionService;
