/**
 * Hook for music interactions (like song, like album)
 * With optimistic updates and animations
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { loggedMusicInteractionService } from '@/utils/loggedMusicInteractionService';
import { toast } from 'sonner';

interface UseSongLikeResult {
  isLiked: boolean;
  likeCount: number;
  isLoading: boolean;
  toggleLike: () => Promise<void>;
}

interface UseAlbumLikeResult {
  isLiked: boolean;
  likeCount: number;
  isLoading: boolean;
  toggleLike: () => Promise<void>;
}

/**
 * Hook for song like functionality
 */
export function useSongLike(songId: number): UseSongLikeResult {
  const { address } = useAccount();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load initial state
  useEffect(() => {
    if (!address || !songId) return;

    const loadState = async () => {
      setIsLoading(true);
      try {
        const [liked, count] = await Promise.all([
          loggedMusicInteractionService.isSongLiked(songId, address),
          loggedMusicInteractionService.getSongLikeCount(songId)
        ]);
        setIsLiked(liked);
        setLikeCount(count);
      } catch (error) {
        // Silently handle NoData error - it's expected when no interactions exist yet
        console.log('[useSongLike] No interaction data yet for song:', songId);
        setIsLiked(false);
        setLikeCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadState();
  }, [songId, address]);

  const toggleLike = useCallback(async () => {
    if (!address || isProcessing) return;

    // Optimistic update
    const previousLiked = isLiked;
    const previousCount = likeCount;
    
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    setIsProcessing(true);

    try {
      if (isLiked) {
        await loggedMusicInteractionService.unlikeSong(songId, address);
      } else {
        await loggedMusicInteractionService.likeSong(songId, address);
      }
      
      // Refresh count from server
      const newCount = await loggedMusicInteractionService.getSongLikeCount(songId);
      setLikeCount(newCount);
    } catch (error) {
      console.error('Failed to toggle song like:', error);
      // Revert optimistic update
      setIsLiked(previousLiked);
      setLikeCount(previousCount);
      toast.error('Failed to update like');
    } finally {
      setIsProcessing(false);
    }
  }, [address, songId, isLiked, likeCount, isProcessing]);

  return {
    isLiked,
    likeCount,
    isLoading,
    toggleLike
  };
}

/**
 * Hook for album like functionality
 */
export function useAlbumLike(albumId: number): UseAlbumLikeResult {
  const { address } = useAccount();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load initial state
  useEffect(() => {
    if (!address || !albumId) return;

    const loadState = async () => {
      setIsLoading(true);
      try {
        const [liked, count] = await Promise.all([
          loggedMusicInteractionService.isAlbumLiked(albumId, address),
          loggedMusicInteractionService.getAlbumLikeCount(albumId)
        ]);
        setIsLiked(liked);
        setLikeCount(count);
      } catch (error) {
        // Silently handle NoData error - it's expected when no interactions exist yet
        console.log('[useAlbumLike] No interaction data yet for album:', albumId);
        setIsLiked(false);
        setLikeCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadState();
  }, [albumId, address]);

  const toggleLike = useCallback(async () => {
    if (!address || isProcessing) return;

    // Optimistic update
    const previousLiked = isLiked;
    const previousCount = likeCount;
    
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    setIsProcessing(true);

    try {
      if (isLiked) {
        await loggedMusicInteractionService.unlikeAlbum(albumId, address);
      } else {
        await loggedMusicInteractionService.likeAlbum(albumId, address);
      }
      
      // Refresh count from server
      const newCount = await loggedMusicInteractionService.getAlbumLikeCount(albumId);
      setLikeCount(newCount);
    } catch (error) {
      console.error('Failed to toggle album like:', error);
      // Revert optimistic update
      setIsLiked(previousLiked);
      setLikeCount(previousCount);
      toast.error('Failed to update like');
    } finally {
      setIsProcessing(false);
    }
  }, [address, albumId, isLiked, likeCount, isProcessing]);

  return {
    isLiked,
    likeCount,
    isLoading,
    toggleLike
  };
}
