// src/hooks/useTrendingMusic.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { subgraphService } from '@/services/subgraphService';
import { somniaDatastreamServiceV3 } from '@/services/somniaDatastreamService.v3';

export interface TrendingTrack {
  tokenId: number;
  title: string;
  artist: string;
  artistAddress: string;
  genre: string;
  duration: number;
  ipfsAudioHash: string;
  ipfsArtworkHash: string;
  playCount: number;
  likeCount: number;
  cover: string;
  audioUrl: string;
}

export const useTrendingMusic = (limit: number = 10) => {
  const [trendingTracks, setTrendingTracks] = useState<TrendingTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isMountedRef = useRef(true);

  // Expose refresh function
  const refresh = useCallback(() => {
    console.log('🔄 [Trending] Manual refresh triggered');
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadTrendingMusic = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🔥 [Trending] Loading trending music from blockchain...');
        console.log('🔥 [Trending] Limit:', limit);

        // 🎯 NEW STRATEGY: Get all NFTs first, then get play counts
        
        // 1. Get all minted NFTs from subgraph
        console.log('📀 [Trending] Fetching all minted NFTs from subgraph...');
        console.log('📀 [Trending] Subgraph endpoint:', subgraphService);
        let allNFTs: any[] = [];
        try {
          allNFTs = await subgraphService.getAllSongs(1000, 0); // Get up to 1000 NFTs
          console.log(`📊 [Trending] Found ${allNFTs?.length || 0} minted NFTs`);
          console.log('📊 [Trending] NFTs data type:', typeof allNFTs, Array.isArray(allNFTs));
          
          if (allNFTs && allNFTs.length > 0) {
            console.log('🔍 [Trending] Sample NFT:', {
              id: allNFTs[0]?.id,
              title: allNFTs[0]?.title,
              artist: allNFTs[0]?.artist,
              hasAudio: !!allNFTs[0]?.audioHash,
              hasArtwork: !!allNFTs[0]?.coverHash
            });
          }
        } catch (nftError) {
          console.error('❌ [Trending] Failed to fetch NFTs from subgraph:', nftError);
          console.error('❌ [Trending] Error details:', {
            name: nftError instanceof Error ? nftError.name : 'Unknown',
            message: nftError instanceof Error ? nftError.message : String(nftError),
            stack: nftError instanceof Error ? nftError.stack : undefined
          });
          // Don't throw - set empty array and continue
          console.warn('⚠️ [Trending] Continuing with empty NFT list');
          allNFTs = [];
        }
        
        if (!allNFTs || allNFTs.length === 0) {
          console.log('📭 [Trending] No NFTs minted yet');
          console.log('💡 [Trending] Subgraph returned empty array - check if NFTs are indexed');
          
          if (isMountedRef.current) {
            setTrendingTracks([]);
            setIsLoading(false);
          }
          return;
        }
        
        console.log('✅ [Trending] Successfully fetched NFTs, processing...');

        // 2. Get play events from DataStream
        console.log('🎵 [Trending] Fetching play events from DataStream...');
        let playEvents: any[] = [];
        try {
          await somniaDatastreamServiceV3.connect();
          playEvents = await somniaDatastreamServiceV3.getAllPlayEvents();
          console.log(`📈 [Trending] Got ${playEvents.length} play events`);
        } catch (playError) {
          console.warn('⚠️ [Trending] Failed to fetch play events, using 0 for all:', playError);
          playEvents = []; // Fallback to empty array
        }

        // 3. Aggregate play counts by tokenId
        const playCountMap = new Map<number, number>();
        playEvents.forEach((event: any) => {
          const currentCount = playCountMap.get(event.tokenId) || 0;
          playCountMap.set(event.tokenId, currentCount + 1);
        });

        console.log(`📈 [Trending] Aggregated play counts for ${playCountMap.size} unique tracks`);

        // 4. Combine NFT data with play counts
        const tracksWithPlayCount = allNFTs.map((nft: any) => {
          const tokenId = parseInt(nft.id || nft.tokenId || '0');
          const playCount = playCountMap.get(tokenId) || 0;

          // Log first NFT structure for debugging
          if (allNFTs.indexOf(nft) === 0) {
            console.log('🔍 [Trending] First NFT structure:', {
              id: nft.id,
              tokenId: nft.tokenId,
              title: nft.title,
              artist: nft.artist,
              audioHash: nft.audioHash,
              coverHash: nft.coverHash,
              genre: nft.genre,
              duration: nft.duration
            });
          }

          return {
            tokenId,
            title: nft.title || `Track #${tokenId}`,
            artist: nft.artist?.displayName || nft.artist?.username || 'Unknown Artist',
            artistAddress: nft.artist?.id || '',
            genre: nft.genre || 'Unknown',
            duration: nft.duration || 180,
            ipfsAudioHash: nft.audioHash || '', // ← Field name: audioHash
            ipfsArtworkHash: nft.coverHash || '', // ← Field name: coverHash
            playCount,
            likeCount: 0, // ← Not in subgraph, will get from DataStream later
            cover: nft.coverHash 
              ? `https://ipfs.io/ipfs/${nft.coverHash}`
              : `https://api.dicebear.com/7.x/shapes/svg?seed=${tokenId}`,
            audioUrl: nft.audioHash
              ? `https://ipfs.io/ipfs/${nft.audioHash}`
              : '',
          } as TrendingTrack;
        });

        console.log('📊 [Trending] Tracks with play count:', tracksWithPlayCount.length);

        // 5. Sort by play count (descending) and take top N
        const sortedTracks = tracksWithPlayCount
          .sort((a: any, b: any) => b.playCount - a.playCount)
          .slice(0, limit);
        
        console.log('📊 [Trending] Sorted and limited to:', sortedTracks.length);

        console.log(`🏆 [Trending] Top ${limit} tracks by play count:`);
        sortedTracks.forEach((track: any, idx: number) => {
          console.log(`  ${idx + 1}. ${track.title} - ${track.playCount} plays`);
        });

        console.log('✅ [Trending] Setting trending tracks:', sortedTracks.length);
        
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setTrendingTracks(sortedTracks);
          console.log('✅ [Trending] Trending tracks set successfully');
        }

      } catch (err) {
        console.error('❌ [Trending] Error loading trending music:', err);
        console.error('❌ [Trending] Error details:', {
          message: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined,
          error: err
        });
        
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load trending music');
          setTrendingTracks([]);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    loadTrendingMusic();
  }, [limit, refreshKey]);

  return {
    trendingTracks,
    isLoading,
    error,
    refresh,
  };
};
