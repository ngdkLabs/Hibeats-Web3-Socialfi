import { useState, useEffect } from 'react';
import { subgraphService } from '@/services/subgraphService';

interface Track {
  tokenId: number;
  title: string;
  artist: string;
  cover: string;
  audioUrl: string;
  duration: number;
  genre: string;
}

/**
 * Hook untuk mendapatkan rekomendasi lagu yang mirip berdasarkan genre dan vibe
 */
export const useSimilarSongRecommendations = (currentSongId: number | null, currentGenre: string | null) => {
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecommendations = async () => {
      if (!currentSongId || !currentGenre) {
        setRecommendations([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log('🎵 [useSimilarSongRecommendations] Loading recommendations for:', {
          songId: currentSongId,
          genre: currentGenre
        });

        // Get all songs from subgraph
        const allSongs = await subgraphService.getAllSongs(200, 0, 'createdAt', 'desc');

        if (allSongs.length === 0) {
          console.log('📭 [useSimilarSongRecommendations] No songs found');
          setRecommendations([]);
          setIsLoading(false);
          return;
        }

        console.log('🎵 [useSimilarSongRecommendations] Found songs:', allSongs.length);

        // Filter out current song and score based on genre similarity
        const scoredSongs = allSongs
          .filter(song => {
            const tokenId = parseInt(song.tokenId || song.id);
            return tokenId !== currentSongId; // Exclude current song
          })
          .map(song => {
            const songGenre = (song.genre || '').toLowerCase();
            const targetGenre = currentGenre.toLowerCase();
            let score = 0;

            // Exact genre match
            if (songGenre === targetGenre) {
              score += 10;
            }
            // Partial genre match
            else if (songGenre.includes(targetGenre) || targetGenre.includes(songGenre)) {
              score += 7;
            }
            // Genre family match (e.g., lo-fi and lofi)
            else if (
              (songGenre.includes('lo-fi') || songGenre.includes('lofi')) &&
              (targetGenre.includes('lo-fi') || targetGenre.includes('lofi'))
            ) {
              score += 8;
            }
            // Similar vibes
            else if (
              (songGenre.includes('chill') || songGenre.includes('ambient') || songGenre.includes('relax')) &&
              (targetGenre.includes('chill') || targetGenre.includes('ambient') || targetGenre.includes('relax'))
            ) {
              score += 6;
            }
            // Upbeat genres
            else if (
              (songGenre.includes('pop') || songGenre.includes('rock') || songGenre.includes('edm')) &&
              (targetGenre.includes('pop') || targetGenre.includes('rock') || targetGenre.includes('edm'))
            ) {
              score += 6;
            }

            // Add randomness for variety
            score += Math.random() * 2;

            return { song, score };
          });

        // Sort by score (descending)
        const sortedSongs = scoredSongs.sort((a, b) => b.score - a.score);

        // Map to Track format
        const tracks: Track[] = sortedSongs.map(item => {
          const song = item.song;
          const tokenId = parseInt(song.tokenId || song.id);
          
          const extractIpfsHash = (hash: string): string => {
            if (!hash) return '';
            return hash.replace('ipfs://', '');
          };

          const audioHash = extractIpfsHash(song.audioHash || '');
          const coverHash = extractIpfsHash(song.coverHash || '');

          return {
            tokenId,
            title: song.title || `Track #${tokenId}`,
            artist: song.artist?.displayName || song.artist?.username || 'Unknown Artist',
            cover: coverHash 
              ? `https://gateway.pinata.cloud/ipfs/${coverHash}`
              : `https://api.dicebear.com/7.x/shapes/svg?seed=${tokenId}`,
            audioUrl: audioHash
              ? `https://gateway.pinata.cloud/ipfs/${audioHash}`
              : '',
            duration: parseInt(song.duration || '180'),
            genre: song.genre || 'Unknown'
          };
        });

        // Limit to 20 recommendations
        const limited = tracks.slice(0, 20);

        console.log('✅ [useSimilarSongRecommendations] Loaded recommendations:', limited.length);
        console.log('🎵 [useSimilarSongRecommendations] Top 3 recommendations:', 
          limited.slice(0, 3).map(t => ({ title: t.title, genre: t.genre }))
        );

        setRecommendations(limited);
      } catch (error) {
        console.error('❌ [useSimilarSongRecommendations] Failed to load recommendations:', error);
        setError(error instanceof Error ? error.message : 'Failed to load recommendations');
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendations();
  }, [currentSongId, currentGenre]);

  return {
    recommendations,
    isLoading,
    error
  };
};
