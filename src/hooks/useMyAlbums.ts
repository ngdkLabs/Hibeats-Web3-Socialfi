// Hook to fetch user's own albums (including unpublished)
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
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
  isPublished: boolean;
  artist: {
    id: string;
    username: string;
    displayName: string;
    avatarHash?: string;
  };
  songs: Array<{
    song: {
      id: string;
      title: string;
      genre: string;
      duration: string;
    };
  }>;
}

export const useMyAlbums = (limit: number = 100) => {
  const { address } = useAccount();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMyAlbums = async () => {
    if (!address) {
      setAlbums([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 [useMyAlbums] Loading albums for user:', address);

      // Use subgraph to get all albums
      const allAlbums = await subgraphService.getAllAlbums(limit, 0);

      console.log('📀 [useMyAlbums] Found albums from subgraph:', allAlbums.length);

      if (allAlbums.length === 0) {
        setAlbums([]);
        setIsLoading(false);
        return;
      }

      // Filter albums by current user (including unpublished)
      const myAlbums = allAlbums.filter(album => {
        const artistAddress = typeof album.artist === 'string' ? album.artist : album.artist.id;
        return artistAddress.toLowerCase() === address.toLowerCase();
      });

      console.log('📀 [useMyAlbums] My albums:', myAlbums.length);

      // Map subgraph data to Album format
      const loadedAlbums: Album[] = myAlbums.map(album => ({
        id: album.id,
        albumId: album.albumId,
        title: album.title || `Album #${album.albumId}`,
        description: album.description,
        coverImageHash: album.coverImageHash,
        albumType: album.albumType,
        songCount: album.songCount,
        createdAt: album.createdAt,
        isPublished: album.isPublished,
        artist: album.artist,
        songs: album.songs || []
      }));
      
      console.log('✅ [useMyAlbums] Loaded my albums:', loadedAlbums.length);
      setAlbums(loadedAlbums);
    } catch (error) {
      console.error('❌ [useMyAlbums] Failed to load albums:', error);
      setError(error instanceof Error ? error.message : 'Failed to load albums');
      setAlbums([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMyAlbums();
  }, [address, limit]);

  return {
    albums,
    isLoading,
    error,
    refetch: loadMyAlbums
  };
};
