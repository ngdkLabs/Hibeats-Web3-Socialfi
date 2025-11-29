/**
 * useBookmarks Hook
 * 
 * Custom hook untuk mengelola bookmark posts
 * - Bookmark/unbookmark posts
 * - Get bookmarked posts
 * - Check bookmark status
 */

import { useState, useEffect, useCallback } from 'react';
import { useSequence } from '@/contexts/SequenceContext';
import { useWalletClient } from 'wagmi';
import { somniaDatastreamServiceV3 } from '@/services/somniaDatastreamService.v3';
import { PostDataV3 } from '@/config/somniaDataStreams.v3';
import { toast } from 'sonner';
import { interactionLogger } from '@/utils/interactionLogger';

export function useBookmarks() {
  const { smartAccountAddress } = useSequence();
  const { data: walletClient } = useWalletClient(); // Get user wallet for multi-publisher
  const [bookmarkedPosts, setBookmarkedPosts] = useState<PostDataV3[]>([]);
  const [bookmarkStates, setBookmarkStates] = useState<Map<number, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Load bookmarked posts
  const loadBookmarkedPosts = useCallback(async () => {
    if (!smartAccountAddress) return;

    setIsLoading(true);
    try {
      const posts = await somniaDatastreamServiceV3.getBookmarkedPosts(smartAccountAddress);
      setBookmarkedPosts(posts);
      
      // Update bookmark states
      const states = new Map<number, boolean>();
      posts.forEach(post => states.set(post.id, true));
      setBookmarkStates(states);
      
      console.log('✅ [Bookmarks] Loaded', posts.length, 'bookmarked posts');
    } catch (error) {
      console.error('❌ [Bookmarks] Failed to load:', error);
      toast.error('Failed to load bookmarks');
    } finally {
      setIsLoading(false);
    }
  }, [smartAccountAddress]);

  // Check if a post is bookmarked
  const isBookmarked = useCallback((postId: number): boolean => {
    return bookmarkStates.get(postId) || false;
  }, [bookmarkStates]);

  // Bookmark a post
  const bookmarkPost = useCallback(async (postId: number) => {
    if (!smartAccountAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    console.log('🔖 [Hook] Bookmarking post:', postId);
    console.log('   Using wallet:', walletClient ? 'USER (multi-publisher)' : 'SERVER');

    // Start logging
    const logId = interactionLogger.logStart('BOOKMARK', walletClient ? 'USER' : 'SERVER', {
      targetId: postId,
      fromUser: smartAccountAddress,
    });

    // ⚡ OPTIMISTIC UPDATE: Instant UI feedback
    setBookmarkStates(prev => {
      const newMap = new Map(prev);
      newMap.set(postId, true);
      console.log('⚡ [Hook] Optimistic: bookmark state = true for post:', postId);
      return newMap;
    });

    try {
      // Pass walletClient for multi-publisher pattern
      const result = await somniaDatastreamServiceV3.bookmarkPost(
        postId, 
        smartAccountAddress,
        walletClient // Multi-publisher: user publishes their own bookmark
      );
      console.log('✅ [Hook] Bookmark batched:', result);
      
      // Log success
      interactionLogger.logSuccess(
        logId,
        result.txHash || 'BOOKMARK_BATCHED',
        result.publisherAddress || smartAccountAddress,
        result
      );
      
      // ✅ NO RELOAD - Let batch flush handle persistence
      // Data will be available after batch flush (100ms + 300ms propagation)
      
      // ✅ Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('bookmarkChanged'));
      
      // No toast - visual feedback only (like Twitter)
    } catch (error: any) {
      console.error('❌ [Bookmarks] Failed to bookmark:', error);
      
      // Log failure
      interactionLogger.logFailure(logId, error);
      
      // ⚡ ROLLBACK: Revert optimistic update on error
      setBookmarkStates(prev => {
        const newMap = new Map(prev);
        newMap.set(postId, false);
        console.log('🔄 [Hook] Rollback: bookmark state = false for post:', postId);
        return newMap;
      });
      toast.error(error?.message || 'Failed to bookmark post');
    }
  }, [smartAccountAddress, walletClient]);

  // Unbookmark a post
  const unbookmarkPost = useCallback(async (postId: number) => {
    if (!smartAccountAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    console.log('🔖 [Hook] Unbookmarking post:', postId);
    console.log('   Using wallet:', walletClient ? 'USER (multi-publisher)' : 'SERVER');

    // Start logging
    const logId = interactionLogger.logStart('UNBOOKMARK', walletClient ? 'USER' : 'SERVER', {
      targetId: postId,
      fromUser: smartAccountAddress,
    });

    // ⚡ OPTIMISTIC UPDATE: Instant UI feedback
    setBookmarkStates(prev => {
      const newMap = new Map(prev);
      newMap.set(postId, false);
      console.log('⚡ [Hook] Optimistic: bookmark state = false for post:', postId);
      return newMap;
    });

    try {
      // Pass walletClient for multi-publisher pattern
      const result = await somniaDatastreamServiceV3.unbookmarkPost(
        postId, 
        smartAccountAddress,
        walletClient // Multi-publisher: user publishes their own unbookmark
      );
      console.log('✅ [Hook] Unbookmark batched:', result);
      
      // Log success
      interactionLogger.logSuccess(
        logId,
        result.txHash || 'BOOKMARK_BATCHED',
        result.publisherAddress || smartAccountAddress,
        result
      );
      
      // ✅ NO RELOAD - Let batch flush handle persistence
      // Data will be available after batch flush (100ms + 300ms propagation)
      
      // ✅ Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('bookmarkChanged'));
      
      // No toast - visual feedback only (like Twitter)
    } catch (error: any) {
      console.error('❌ [Bookmarks] Failed to unbookmark:', error);
      
      // Log failure
      interactionLogger.logFailure(logId, error);
      
      // ⚡ ROLLBACK: Revert optimistic update on error
      setBookmarkStates(prev => {
        const newMap = new Map(prev);
        newMap.set(postId, true);
        console.log('🔄 [Hook] Rollback: bookmark state = true for post:', postId);
        return newMap;
      });
      toast.error(error?.message || 'Failed to remove bookmark');
    }
  }, [smartAccountAddress, walletClient]);

  // Toggle bookmark
  const toggleBookmark = useCallback(async (postId: number) => {
    const currentState = isBookmarked(postId);
    if (currentState) {
      await unbookmarkPost(postId);
    } else {
      await bookmarkPost(postId);
    }
  }, [isBookmarked, bookmarkPost, unbookmarkPost]);

  // Load bookmarks on mount
  useEffect(() => {
    if (smartAccountAddress) {
      loadBookmarkedPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAccountAddress]);

  return {
    bookmarkedPosts,
    isBookmarked,
    bookmarkPost,
    unbookmarkPost,
    toggleBookmark,
    loadBookmarkedPosts,
    isLoading,
  };
}
