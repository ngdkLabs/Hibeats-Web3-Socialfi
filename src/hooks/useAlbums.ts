// Hook to fetch albums from subgraph
import { useState, useEffect } from 'react';
import { subgraphService } from '@/services/subgraphService';

interface Album {
  id: string;
  albumId: string;
  title: string;
  description?: string;
  coverImageHash: string;
  albumType: 'SINGLE' | 'EP' | 'ALBUM';
  songCount: string;
  createdAt: string;
  isPublished?: boolean; // Optional for backward compatibility
  artist: {
    id: string;
    username: string;
    displayName: string;
    avatarHash?: string;
  };
  songs: Array<{
    song: {
      id: string;
      tokenId?: string;
      title: string;
      genre: string;
      duration: string;
      audioHash?: string;
      coverHash?: string;
      artist?: {
        id: string;
        username: string;
        displayName: string;
        avatarHash?: string;
      };
    };
  }>;
}

export const useAlbums = (limit: number = 20) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlbums = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 [useAlbums] Loading albums from subgraph');

      // Use subgraph to get albums
      const allAlbums = await subgraphService.getAllAlbums(limit, 0);

      console.log('📀 [useAlbums] Found albums from subgraph:', allAlbums.length);

      if (allAlbums.length === 0) {
        setAlbums([]);
        setIsLoading(false);
        return;
      }

      // Filter only published albums for public view
      // If isPublished field doesn't exist (undefined), show the album (backward compatibility)
      const publishedAlbums = allAlbums.filter(album => {
        // If isPublished is undefined, show it (backward compatibility)
        if (album.isPublished === undefined) {
          console.log('⚠️ [useAlbums] Album has no isPublished field:', album.albumId, '- showing it');
          return true;
        }
        // Otherwise, only show if published
        return album.isPublished === true;
      });
      
      console.log('📀 [useAlbums] Published albums:', publishedAlbums.length, 'of', allAlbums.length);
      console.log('📀 [useAlbums] Sample album data:', allAlbums[0]);

      // Map subgraph data to Album format
      const loadedAlbums: Album[] = publishedAlbums.map(album => ({
        id: album.id,
        albumId: album.albumId,
        title: album.title || `Album #${album.albumId}`,
        description: album.description,
        coverImageHash: album.coverImageHash,
        albumType: album.albumType,
        songCount: album.songCount,
        createdAt: album.createdAt,
        isPublished: album.isPublished !== undefined ? album.isPublished : true, // Default to true if undefined
        artist: album.artist,
        songs: album.songs || []
      }));
      
      console.log('✅ [useAlbums] Loaded albums:', loadedAlbums.length);
      setAlbums(loadedAlbums);
    } catch (error) {
      console.error('❌ [useAlbums] Failed to load albums:', error);
      setError(error instanceof Error ? error.message : 'Failed to load albums');
      setAlbums([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlbums();
  }, [limit]);

  return {
    albums,
    isLoading,
    error,
    refetch: loadAlbums
  };
};
