/**
 * Music Interaction Service
 * 
 * Handles music-specific interactions:
 * - Song likes/unlikes (using batch flush)
 * - Album likes/unlikes (using batch flush)
 * - Playlist save/unsave (using immediate flush)
 */

import { somniaDatastreamServiceV3 } from './somniaDatastreamService.v3';
import { InteractionType, TargetType } from '@/config/somniaDataStreams.v3';

class MusicInteractionService {
  // ===== SONG INTERACTIONS =====

  /**
   * Like a song (uses batch flush for performance)
   */
  async likeSong(songId: number, userAddress: string, userWalletClient?: any): Promise<any> {
    return await somniaDatastreamServiceV3.createInteraction(
      {
        interactionType: InteractionType.LIKE,
        targetType: TargetType.SONG,
        targetId: songId,
        fromUser: userAddress,
        timestamp: Date.now(),
      },
      false, // Use batch flush (not immediate)
      userWalletClient
    );
  }

  /**
   * Unlike a song (uses batch flush for performance)
   */
  async unlikeSong(songId: number, userAddress: string, userWalletClient?: any): Promise<any> {
    return await somniaDatastreamServiceV3.createInteraction(
      {
        interactionType: InteractionType.UNLIKE,
        targetType: TargetType.SONG,
        targetId: songId,
        fromUser: userAddress,
        timestamp: Date.now(),
      },
      false, // Use batch flush (not immediate)
      userWalletClient
    );
  }

  /**
   * Check if a song is liked by user
   */
  async isSongLiked(songId: number, userAddress: string): Promise<boolean> {
    try {
      const interactions = await somniaDatastreamServiceV3.getAllInteractions();
      
      // Find the most recent interaction for this song by this user
      const userInteractions = interactions
        .filter(i => 
          i.targetType === TargetType.SONG &&
          i.targetId === songId &&
          i.fromUser.toLowerCase() === userAddress.toLowerCase() &&
          (i.interactionType === InteractionType.LIKE || i.interactionType === InteractionType.UNLIKE)
        )
        .sort((a, b) => b.timestamp - a.timestamp);

      if (userInteractions.length === 0) {
        return false;
      }

      // Return true if the most recent interaction is a LIKE
      return userInteractions[0]?.interactionType === InteractionType.LIKE;
    } catch (error) {
      console.error('Error checking if song is liked:', error);
      return false;
    }
  }

  /**
   * Get song like count
   */
  async getSongLikeCount(songId: number): Promise<number> {
    try {
      const interactions = await somniaDatastreamServiceV3.getAllInteractions();
      
      // Group by user to get net likes (like - unlike per user)
      const userLikes = new Map<string, boolean>();
      
      interactions
        .filter(i => 
          i.targetType === TargetType.SONG &&
          i.targetId === songId &&
          (i.interactionType === InteractionType.LIKE || i.interactionType === InteractionType.UNLIKE)
        )
        .sort((a, b) => a.timestamp - b.timestamp) // Process in chronological order
        .forEach(interaction => {
          const userKey = interaction.fromUser.toLowerCase();
          if (interaction.interactionType === InteractionType.LIKE) {
            userLikes.set(userKey, true);
          } else if (interaction.interactionType === InteractionType.UNLIKE) {
            userLikes.set(userKey, false);
          }
        });

      // Count users who currently have a like
      return Array.from(userLikes.values()).filter(liked => liked).length;
    } catch (error) {
      console.error('Error getting song like count:', error);
      return 0;
    }
  }

  // ===== ALBUM INTERACTIONS =====

  /**
   * Like an album (uses batch flush for performance)
   */
  async likeAlbum(albumId: number, userAddress: string, userWalletClient?: any): Promise<any> {
    return await somniaDatastreamServiceV3.createInteraction(
      {
        interactionType: InteractionType.LIKE,
        targetType: TargetType.ALBUM,
        targetId: albumId,
        fromUser: userAddress,
        timestamp: Date.now(),
      },
      false, // Use batch flush (not immediate)
      userWalletClient
    );
  }

  /**
   * Unlike an album (uses batch flush for performance)
   */
  async unlikeAlbum(albumId: number, userAddress: string, userWalletClient?: any): Promise<any> {
    return await somniaDatastreamServiceV3.createInteraction(
      {
        interactionType: InteractionType.UNLIKE,
        targetType: TargetType.ALBUM,
        targetId: albumId,
        fromUser: userAddress,
        timestamp: Date.now(),
      },
      false, // Use batch flush (not immediate)
      userWalletClient
    );
  }

  /**
   * Check if an album is liked by user
   */
  async isAlbumLiked(albumId: number, userAddress: string): Promise<boolean> {
    try {
      const interactions = await somniaDatastreamServiceV3.getAllInteractions();
      
      // Find the most recent interaction for this album by this user
      const userInteractions = interactions
        .filter(i => 
          i.targetType === TargetType.ALBUM &&
          i.targetId === albumId &&
          i.fromUser.toLowerCase() === userAddress.toLowerCase() &&
          (i.interactionType === InteractionType.LIKE || i.interactionType === InteractionType.UNLIKE)
        )
        .sort((a, b) => b.timestamp - a.timestamp);

      if (userInteractions.length === 0) {
        return false;
      }

      // Return true if the most recent interaction is a LIKE
      return userInteractions[0]?.interactionType === InteractionType.LIKE;
    } catch (error) {
      console.error('Error checking if album is liked:', error);
      return false;
    }
  }

  /**
   * Get album like count
   */
  async getAlbumLikeCount(albumId: number): Promise<number> {
    try {
      const interactions = await somniaDatastreamServiceV3.getAllInteractions();
      
      // Group by user to get net likes (like - unlike per user)
      const userLikes = new Map<string, boolean>();
      
      interactions
        .filter(i => 
          i.targetType === TargetType.ALBUM &&
          i.targetId === albumId &&
          (i.interactionType === InteractionType.LIKE || i.interactionType === InteractionType.UNLIKE)
        )
        .sort((a, b) => a.timestamp - b.timestamp) // Process in chronological order
        .forEach(interaction => {
          const userKey = interaction.fromUser.toLowerCase();
          if (interaction.interactionType === InteractionType.LIKE) {
            userLikes.set(userKey, true);
          } else if (interaction.interactionType === InteractionType.UNLIKE) {
            userLikes.set(userKey, false);
          }
        });

      // Count users who currently have a like
      return Array.from(userLikes.values()).filter(liked => liked).length;
    } catch (error) {
      console.error('Error getting album like count:', error);
      return 0;
    }
  }

  // ===== PLAYLIST INTERACTIONS =====

  /**
   * Save a playlist to user's library (uses immediate flush)
   */
  async savePlaylist(playlistId: string, userAddress: string, userWalletClient?: any): Promise<any> {
    // Convert playlist ID string to number for storage
    const playlistIdNum = parseInt(playlistId.replace(/[^0-9]/g, '')) || Date.now();
    
    return await somniaDatastreamServiceV3.createInteraction(
      {
        interactionType: InteractionType.SAVE,
        targetType: TargetType.PLAYLIST,
        targetId: playlistIdNum,
        fromUser: userAddress,
        content: playlistId, // Store original playlist ID in content
        timestamp: Date.now(),
      },
      true, // Use immediate flush for playlists
      userWalletClient
    );
  }

  /**
   * Remove a playlist from user's library (uses immediate flush)
   */
  async unsavePlaylist(playlistId: string, userAddress: string, userWalletClient?: any): Promise<any> {
    // Convert playlist ID string to number for storage
    const playlistIdNum = parseInt(playlistId.replace(/[^0-9]/g, '')) || Date.now();
    
    return await somniaDatastreamServiceV3.createInteraction(
      {
        interactionType: InteractionType.UNSAVE,
        targetType: TargetType.PLAYLIST,
        targetId: playlistIdNum,
        fromUser: userAddress,
        content: playlistId, // Store original playlist ID in content
        timestamp: Date.now(),
      },
      true, // Use immediate flush for playlists
      userWalletClient
    );
  }

  /**
   * Check if a playlist is saved by user
   */
  async isPlaylistSaved(playlistId: string, userAddress: string): Promise<boolean> {
    try {
      const interactions = await somniaDatastreamServiceV3.getAllInteractions();
      
      // Find the most recent interaction for this playlist by this user
      const userInteractions = interactions
        .filter(i => 
          i.targetType === TargetType.PLAYLIST &&
          i.content === playlistId && // Match by content (original playlist ID)
          i.fromUser.toLowerCase() === userAddress.toLowerCase() &&
          (i.interactionType === InteractionType.SAVE || i.interactionType === InteractionType.UNSAVE)
        )
        .sort((a, b) => b.timestamp - a.timestamp);

      if (userInteractions.length === 0) {
        return false;
      }

      // Return true if the most recent interaction is a SAVE
      return userInteractions[0]?.interactionType === InteractionType.SAVE;
    } catch (error) {
      console.error('Error checking if playlist is saved:', error);
      return false;
    }
  }

  /**
   * Get all saved playlists for a user
   */
  async getSavedPlaylists(userAddress: string): Promise<string[]> {
    try {
      const interactions = await somniaDatastreamServiceV3.getAllInteractions();
      
      // Group by playlist ID to get current save state
      const playlistStates = new Map<string, boolean>();
      
      interactions
        .filter(i => 
          i.targetType === TargetType.PLAYLIST &&
          i.fromUser.toLowerCase() === userAddress.toLowerCase() &&
          (i.interactionType === InteractionType.SAVE || i.interactionType === InteractionType.UNSAVE)
        )
        .sort((a, b) => a.timestamp - b.timestamp) // Process in chronological order
        .forEach(interaction => {
          const playlistId = interaction.content || '';
          if (interaction.interactionType === InteractionType.SAVE) {
            playlistStates.set(playlistId, true);
          } else if (interaction.interactionType === InteractionType.UNSAVE) {
            playlistStates.set(playlistId, false);
          }
        });

      // Return playlist IDs that are currently saved
      return Array.from(playlistStates.entries())
        .filter(([_, isSaved]) => isSaved)
        .map(([playlistId, _]) => playlistId);
    } catch (error) {
      console.error('Error getting saved playlists:', error);
      return [];
    }
  }
}

// Export singleton instance
export const musicInteractionService = new MusicInteractionService();
export default musicInteractionService;
