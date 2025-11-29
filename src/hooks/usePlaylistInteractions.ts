/**
 * Hook for playlist interactions (add track, remove track)
 * With optimistic updates - follows same pattern as useMusicInteractions
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { playlistService } from '@/services/playlistService';
import { toast } from 'sonner';

interface UsePlaylistTracksResult {
  trackIds: string[];
  isLoading: boolean;
  addTrack: (trackId: string) => Promise<boolean>;
  removeTrack: (trackId: string) => Promise<boolean>;
  refreshTracks: () => Promise<void>;
}

/**
 * Hook for managing playlist tracks
 * Similar to useSongLike but for playlist track management
 */
export function usePlaylistTracks(playlistId: string): UsePlaylistTracksResult {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load initial track list
  const loadTracks = useCallback(async () => {
    if (!playlistId) return;

    setIsLoading(true);
    try {
      console.log(`📥 [usePlaylistTracks] Loading tracks for playlist ${playlistId.slice(0, 10)}...`);
      const playlist = await playlistService.getPlaylistById(playlistId);
      
      if (playlist) {
        setTrackIds(playlist.trackIds);
        console.log(`✅ [usePlaylistTracks] Loaded ${playlist.trackIds.length} tracks`);
      } else {
        console.warn(`⚠️ [usePlaylistTracks] Playlist not found`);
        setTrackIds([]);
      }
    } catch (error) {
      console.error('❌ [usePlaylistTracks] Failed to load tracks:', error);
      setTrackIds([]);
    } finally {
      setIsLoading(false);
    }
  }, [playlistId]);

  // Load tracks on mount
  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  // Add track to playlist
  const addTrack = useCallback(async (trackId: string): Promise<boolean> => {
    if (!address || !walletClient || isProcessing) {
      toast.error('Please connect your wallet');
      return false;
    }

    // Check if track already exists
    if (trackIds.includes(trackId)) {
      toast.info('Track already in playlist');
      return false;
    }

    // Optimistic update
    const previousTrackIds = [...trackIds];
    setTrackIds(prev => [...prev, trackId]);
    setIsProcessing(true);

    try {
      console.log(`➕ [usePlaylistTracks] Adding track ${trackId} to playlist ${playlistId.slice(0, 10)}...`);
      
      // Add track using wallet client (like like/repost)
      const updatedPlaylist = await playlistService.addTrackToPlaylist(
        playlistId,
        trackId,
        walletClient
      );

      if (updatedPlaylist) {
        // Update with actual data from blockchain
        setTrackIds(updatedPlaylist.trackIds);
        console.log(`✅ [usePlaylistTracks] Track added successfully`);
        toast.success('Track added to playlist!');
        return true;
      } else {
        // Revert optimistic update
        setTrackIds(previousTrackIds);
        toast.error('Failed to add track');
        return false;
      }
    } catch (error) {
      console.error('❌ [usePlaylistTracks] Failed to add track:', error);
      // Revert optimistic update
      setTrackIds(previousTrackIds);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to add track: ${errorMessage}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [address, walletClient, playlistId, trackIds, isProcessing]);

  // Remove track from playlist
  const removeTrack = useCallback(async (trackId: string): Promise<boolean> => {
    if (!address || !walletClient || isProcessing) {
      toast.error('Please connect your wallet');
      return false;
    }

    // Optimistic update
    const previousTrackIds = [...trackIds];
    setTrackIds(prev => prev.filter(id => id !== trackId));
    setIsProcessing(true);

    try {
      console.log(`➖ [usePlaylistTracks] Removing track ${trackId} from playlist ${playlistId.slice(0, 10)}...`);
      
      // Remove track using wallet client
      const updatedPlaylist = await playlistService.removeTrackFromPlaylist(
        playlistId,
        trackId,
        walletClient
      );

      if (updatedPlaylist) {
        // Update with actual data from blockchain
        setTrackIds(updatedPlaylist.trackIds);
        console.log(`✅ [usePlaylistTracks] Track removed successfully`);
        toast.success('Track removed from playlist');
        return true;
      } else {
        // Revert optimistic update
        setTrackIds(previousTrackIds);
        toast.error('Failed to remove track');
        return false;
      }
    } catch (error) {
      console.error('❌ [usePlaylistTracks] Failed to remove track:', error);
      // Revert optimistic update
      setTrackIds(previousTrackIds);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to remove track: ${errorMessage}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [address, walletClient, playlistId, trackIds, isProcessing]);

  // Refresh tracks from blockchain
  const refreshTracks = useCallback(async () => {
    await loadTracks();
  }, [loadTracks]);

  return {
    trackIds,
    isLoading,
    addTrack,
    removeTrack,
    refreshTracks
  };
}
