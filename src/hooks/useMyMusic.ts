// Hook to fetch user's music NFTs (songs) from subgraph (avoids RPC rate limits)
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { subgraphService } from '@/services/subgraphService';

interface MusicNFT {
  tokenId: number;
  title: string;
  artist: string;
  artistAddress: string;
  genre: string;
  duration: number;
  ipfsAudioHash: string;
  ipfsArtworkHash: string;
  audioUrl: string;
  imageUrl: string;
  metadataURI: string;
  royaltyPercentage: number;
  isExplicit: boolean;
  likeCount: number;
  playCount: number;
  createdAt: number;
  metadata?: any;
}

export const useMyMusic = () => {
  const { address } = useAccount();
  const [songs, setSongs] = useState<MusicNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMySongs = async () => {
    if (!address) {
      setSongs([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 [useMyMusic] Loading songs from subgraph for:', address);

      // Use subgraph instead of RPC to avoid rate limits
      const userSongs = await subgraphService.getUserSongs(address, 100, 0);

      console.log('📀 [useMyMusic] Found songs from subgraph:', userSongs.length);

      if (userSongs.length === 0) {
        setSongs([]);
        setIsLoading(false);
        return;
      }

      // Helper to extract IPFS hash from various formats
      const extractIpfsHash = (hash: string): string => {
        if (!hash) return '';
        return hash.replace('ipfs://', '');
      };

      // Map subgraph data to MusicNFT format
      const loadedSongs: MusicNFT[] = userSongs.map(song => {
        const audioHash = extractIpfsHash(song.audioHash || '');
        const coverHash = extractIpfsHash(song.coverHash || '');

        return {
          tokenId: parseInt(song.id),
          title: song.title || `Track #${song.id}`,
          artist: song.artist?.displayName || song.artist?.username || 'Unknown Artist',
          artistAddress: song.artist?.id || address,
          genre: song.genre || 'Unknown',
          duration: Number(song.duration) || 180,
          ipfsAudioHash: audioHash,
          ipfsArtworkHash: coverHash,
          audioUrl: audioHash ? `https://gateway.pinata.cloud/ipfs/${audioHash}` : '',
          imageUrl: coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '',
          metadataURI: '', // Not needed from subgraph
          royaltyPercentage: Number(song.royaltyPercentage) || 500,
          isExplicit: false, // Not in subgraph schema yet
          likeCount: Number(song.likeCount) || 0,
          playCount: Number(song.playCount) || 0,
          createdAt: Number(song.createdAt) || Math.floor(Date.now() / 1000),
          metadata: {
            title: song.title,
            artist: song.artist?.displayName || song.artist?.username,
            genre: song.genre,
            duration: Number(song.duration) || 180,
            image: coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '',
            audio_url: audioHash ? `https://gateway.pinata.cloud/ipfs/${audioHash}` : '',
          }
        };
      });
      
      console.log('✅ [useMyMusic] Loaded songs:', loadedSongs.length);
      setSongs(loadedSongs);
    } catch (error) {
      console.error('❌ [useMyMusic] Failed to load songs:', error);
      setError(error instanceof Error ? error.message : 'Failed to load songs');
      setSongs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMySongs();
  }, [address]);

  return {
    songs,
    isLoading,
    error,
    refetch: loadMySongs
  };
};
