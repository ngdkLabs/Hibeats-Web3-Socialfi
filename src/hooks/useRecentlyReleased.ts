// src/hooks/useRecentlyReleased.ts
import { useState, useEffect } from 'react';
import { subgraphService } from '@/services/subgraphService';

export interface RecentTrack {
  tokenId: number;
  title: string;
  artist: string;
  artistAddress: string;
  genre: string;
  duration: number;
  ipfsAudioHash: string;
  ipfsArtworkHash: string;
  cover: string;
  audioUrl: string;
  createdAt: number;
  releaseDate: string;
}

export const useRecentlyReleased = (limit: number = 10) => {
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecentMusic = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🆕 [Recently Released] Loading recently released music from blockchain...');

        // Get all minted NFTs from subgraph
        console.log('📀 [Recently Released] Fetching all minted NFTs from subgraph...');
        let allNFTs;
        try {
          allNFTs = await subgraphService.getAllSongs(1000, 0);
          console.log(`📊 [Recently Released] Found ${allNFTs.length} minted NFTs`);
        } catch (nftError) {
          console.error('❌ [Recently Released] Failed to fetch NFTs from subgraph:', nftError);
          throw new Error(`Failed to fetch NFTs from subgraph: ${nftError instanceof Error ? nftError.message : 'Unknown error'}`);
        }
        
        if (!allNFTs || allNFTs.length === 0) {
          console.log('📭 [Recently Released] No NFTs minted yet');
          setRecentTracks([]);
          setIsLoading(false);
          return;
        }

        // Helper function to format relative time
        const getRelativeTime = (timestamp: number): string => {
          const now = Date.now();
          const diff = now - timestamp * 1000; // Convert to milliseconds
          
          const seconds = Math.floor(diff / 1000);
          const minutes = Math.floor(seconds / 60);
          const hours = Math.floor(minutes / 60);
          const days = Math.floor(hours / 24);
          const weeks = Math.floor(days / 7);
          const months = Math.floor(days / 30);
          
          if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
          if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
          if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
          if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
          if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
          return 'Just now';
        };

        // Map NFT data to RecentTrack format
        const tracksWithTimestamp = allNFTs.map(nft => {
          const tokenId = parseInt(nft.id);
          const createdAt = nft.createdAt || Math.floor(Date.now() / 1000);

          // Helper to extract IPFS hash from various formats
          const extractIpfsHash = (hash: string): string => {
            if (!hash) return '';
            // Remove ipfs:// prefix if present
            return hash.replace('ipfs://', '');
          };

          const audioHash = extractIpfsHash(nft.audioHash || '');
          const coverHash = extractIpfsHash(nft.coverHash || '');

          return {
            tokenId,
            title: nft.title || `Track #${tokenId}`,
            artist: nft.artist?.displayName || nft.artist?.username || 'Unknown Artist',
            artistAddress: nft.artist?.id || '',
            genre: nft.genre || 'Unknown',
            duration: nft.duration || 180,
            ipfsAudioHash: audioHash,
            ipfsArtworkHash: coverHash,
            // Use Pinata gateway (same as upload/AI generate) with fallback
            cover: coverHash 
              ? `https://gateway.pinata.cloud/ipfs/${coverHash}`
              : `https://api.dicebear.com/7.x/shapes/svg?seed=${tokenId}`,
            audioUrl: audioHash
              ? `https://gateway.pinata.cloud/ipfs/${audioHash}`
              : '',
            createdAt,
            releaseDate: getRelativeTime(createdAt),
          } as RecentTrack;
        });

        // Sort by creation time (descending - newest first) and take top N
        const sortedTracks = tracksWithTimestamp
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, limit);

        console.log(`🆕 [Recently Released] Top ${limit} recently released tracks:`);
        sortedTracks.forEach((track, idx) => {
          console.log(`  ${idx + 1}. ${track.title} - ${track.releaseDate}`);
        });

        setRecentTracks(sortedTracks);

      } catch (err) {
        console.error('❌ [Recently Released] Error loading recent music:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recent music');
        setRecentTracks([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentMusic();
  }, [limit]);

  return {
    recentTracks,
    isLoading,
    error,
  };
};
