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

// Mapping moment to genre preferences
const momentToGenreMapping: Record<string, string[]> = {
  'Studying': ['lo-fi', 'lofi', 'ambient', 'classical', 'piano', 'instrumental'],
  'Working': ['lo-fi', 'lofi', 'ambient', 'electronic', 'instrumental'],
  'Walking': ['pop', 'indie', 'alternative', 'acoustic'],
  'Driving': ['rock', 'pop', 'hip-hop', 'rap', 'edm', 'dance'],
  'Workout': ['edm', 'dance', 'hip-hop', 'rap', 'rock', 'electronic'],
  'Cooking': ['jazz', 'soul', 'r&b', 'world', 'acoustic'],
  'Relaxing': ['ambient', 'classical', 'piano', 'jazz', 'acoustic', 'lo-fi', 'lofi'],
  'Party': ['edm', 'dance', 'hip-hop', 'rap', 'pop', 'electronic']
};

export const useVibeRecommendations = (moment: string, genres: string[]) => {
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = async () => {
    if (!moment || genres.length === 0) {
      setRecommendations([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🎵 [useVibeRecommendations] Loading recommendations for:', { moment, genres });

      // Get all songs from subgraph (NFT music)
      const allSongs = await subgraphService.getAllSongs(200, 0, 'createdAt', 'desc');

      if (allSongs.length === 0) {
        console.log('📭 [useVibeRecommendations] No songs found in subgraph');
        setRecommendations([]);
        setIsLoading(false);
        return;
      }

      console.log('🎵 [useVibeRecommendations] Found songs:', allSongs.length);

      // Get moment-based genre preferences
      const momentGenres = momentToGenreMapping[moment] || [];
      console.log('🎵 [useVibeRecommendations] Moment genres:', momentGenres);

      // Combine user-selected genres with moment-based genres
      const allGenrePreferences = [...genres, ...momentGenres].map(g => g.toLowerCase());
      console.log('🎵 [useVibeRecommendations] All genre preferences:', allGenrePreferences);

      // Filter and score songs based on genre match
      const scoredSongs = allSongs.map(song => {
        const songGenre = (song.genre || '').toLowerCase();
        
        // Calculate match score
        let score = 0;
        
        // Higher score for user-selected genres (priority)
        genres.forEach(selectedGenre => {
          const genreToMatch = selectedGenre.toLowerCase();
          if (songGenre.includes(genreToMatch) || genreToMatch.includes(songGenre)) {
            score += 10; // High priority for user selection
          }
        });
        
        // Lower score for moment-based genres
        momentGenres.forEach(momentGenre => {
          const genreToMatch = momentGenre.toLowerCase();
          if (songGenre.includes(genreToMatch) || genreToMatch.includes(songGenre)) {
            score += 3; // Lower priority for moment match
          }
        });

        return { song, score };
      });

      // Filter songs with score > 0 (at least some match)
      const matchedSongs = scoredSongs.filter(item => item.score > 0);
      console.log('🎵 [useVibeRecommendations] Matched songs:', matchedSongs.length);

      // If no matches, return all songs (fallback)
      const songsToUse = matchedSongs.length > 0 ? matchedSongs : scoredSongs;

      // Sort by score (descending) and shuffle within same score
      const sortedSongs = songsToUse.sort((a, b) => {
        if (b.score === a.score) {
          return Math.random() - 0.5; // Shuffle within same score
        }
        return b.score - a.score;
      });

      // Map to Track format
      const tracks: Track[] = sortedSongs.map(item => {
        const song = item.song;
        const tokenId = parseInt(song.tokenId || song.id);
        
        // Helper to extract IPFS hash
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

      console.log('✅ [useVibeRecommendations] Loaded recommendations:', limited.length);
      console.log('🎵 [useVibeRecommendations] Sample tracks:', limited.slice(0, 3).map(t => ({
        title: t.title,
        genre: t.genre
      })));

      setRecommendations(limited);
    } catch (error) {
      console.error('❌ [useVibeRecommendations] Failed to load recommendations:', error);
      setError(error instanceof Error ? error.message : 'Failed to load recommendations');
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [moment, genres.join(',')]);

  return {
    recommendations,
    isLoading,
    error,
    refetch: loadRecommendations
  };
};
