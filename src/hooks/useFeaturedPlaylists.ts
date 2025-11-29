/**
 * Hook for Featured Playlists
 * Loads public playlists from blockchain for sidebar display
 */

import { useState, useEffect, useCallback } from 'react';
import { playlistService } from '@/services/playlistService';

export interface FeaturedPlaylist {
  id: string;
  title: string;
  description: string;
  creator: string;
  creatorAddress: string;
  trackCount: number;
  cover: string;
  isPublic: boolean;
  timestamp: number;
}

export function useFeaturedPlaylists(limit: number = 4) {
  const [playlists, setPlaylists] = useState<FeaturedPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeaturedPlaylists = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🎵 [useFeaturedPlaylists] Loading featured playlists (limit: ${limit})...`);
      
      // ✅ ALTERNATIVE: Load from all users' playlists
      // Since getNewPlaylists might only load from server publisher,
      // we'll use a different approach - get playlists from publisherIndexer
      
      const { publisherIndexer } = await import('@/services/publisherIndexer');
      let publishers = publisherIndexer.getAllPublishers();
      
      console.log(`📚 [useFeaturedPlaylists] Loading from ${publishers.length} publishers...`);
      
      // ✅ If no publishers, try to get from service
      if (publishers.length === 0) {
        console.warn('⚠️ [useFeaturedPlaylists] No publishers indexed, trying alternative approach...');
        
        // Try to load using getNewPlaylists as fallback
        try {
          const newPlaylists = await playlistService.getNewPlaylists(limit * 2);
          const publicPlaylists = newPlaylists.filter(p => p.isPublic && !p.isDeleted);
          const limitedPlaylists = publicPlaylists.slice(0, limit);
          
          const featured: FeaturedPlaylist[] = limitedPlaylists.map(playlist => {
            const coverUrl = playlist.coverHash 
              ? `https://gateway.pinata.cloud/ipfs/${playlist.coverHash.replace('ipfs://', '')}`
              : '/placeholder.svg';
            
            return {
              id: playlist.id,
              title: playlist.title,
              description: playlist.description,
              creator: formatAddress(playlist.owner),
              creatorAddress: playlist.owner,
              trackCount: playlist.trackIds.length,
              cover: coverUrl,
              isPublic: playlist.isPublic,
              timestamp: playlist.timestamp
            };
          });
          
          setPlaylists(featured);
          console.log(`✅ [useFeaturedPlaylists] Loaded ${featured.length} playlists via fallback`);
          setIsLoading(false);
          return;
        } catch (fallbackError) {
          console.error('❌ [useFeaturedPlaylists] Fallback also failed:', fallbackError);
          setPlaylists([]);
          setIsLoading(false);
          return;
        }
      }
      
      // Load playlists from all publishers
      const allPlaylistsPromises = publishers.map(async (publisher) => {
        try {
          const playlists = await playlistService.getUserPlaylists(publisher);
          return playlists.filter(p => p.isPublic && !p.isDeleted);
        } catch (error) {
          console.warn(`⚠️ [useFeaturedPlaylists] Failed to load from ${publisher.slice(0, 10)}:`, error);
          return [];
        }
      });
      
      const allPlaylistsArrays = await Promise.all(allPlaylistsPromises);
      const allPlaylists = allPlaylistsArrays.flat();
      
      console.log(`✅ [useFeaturedPlaylists] Found ${allPlaylists.length} public playlists from all publishers`);
      
      // Sort by timestamp (newest first)
      allPlaylists.sort((a, b) => b.timestamp - a.timestamp);
      
      // Take only the limit we need
      const limitedPlaylists = allPlaylists.slice(0, limit);
      
      // ✅ Convert to FeaturedPlaylist format
      const featured: FeaturedPlaylist[] = limitedPlaylists.map(playlist => {
        // Get IPFS URL for cover
        const coverUrl = playlist.coverHash 
          ? `https://gateway.pinata.cloud/ipfs/${playlist.coverHash.replace('ipfs://', '')}`
          : '/placeholder.svg';
        
        return {
          id: playlist.id,
          title: playlist.title,
          description: playlist.description,
          creator: formatAddress(playlist.owner),
          creatorAddress: playlist.owner,
          trackCount: playlist.trackIds.length,
          cover: coverUrl,
          isPublic: playlist.isPublic,
          timestamp: playlist.timestamp
        };
      });
      
      setPlaylists(featured);
      console.log(`✅ [useFeaturedPlaylists] Loaded ${featured.length} featured playlists`);
      
      // Debug: Show playlist titles
      if (featured.length > 0) {
        console.log(`📋 [useFeaturedPlaylists] Playlists:`, featured.map(p => ({
          title: p.title,
          creator: p.creator,
          tracks: p.trackCount
        })));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load playlists';
      console.error('❌ [useFeaturedPlaylists] Error:', errorMessage);
      setError(errorMessage);
      setPlaylists([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  // Load on mount
  useEffect(() => {
    loadFeaturedPlaylists();
  }, [loadFeaturedPlaylists]);

  // Helper to format address
  const formatAddress = (address: string): string => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return {
    playlists,
    isLoading,
    error,
    refresh: loadFeaturedPlaylists
  };
}
