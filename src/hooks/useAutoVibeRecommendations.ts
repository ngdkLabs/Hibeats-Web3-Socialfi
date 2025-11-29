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

interface VibeContext {
  location: string;
  weather: string;
  timeOfDay: string;
  detectedMood: string;
}

// Analysis steps for progress tracking
export type AnalysisStep = 'location' | 'weather' | 'time' | 'mood' | 'matching' | 'complete';

// Time-based mood detection
const getTimeBasedMood = (): { timeOfDay: string; mood: string; genres: string[] } => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 9) {
    return {
      timeOfDay: 'Early Morning',
      mood: 'Energizing',
      genres: ['pop', 'indie', 'acoustic', 'lo-fi', 'lofi']
    };
  } else if (hour >= 9 && hour < 12) {
    return {
      timeOfDay: 'Morning',
      mood: 'Productive',
      genres: ['lo-fi', 'lofi', 'ambient', 'electronic', 'instrumental']
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      timeOfDay: 'Afternoon',
      mood: 'Focused',
      genres: ['jazz', 'classical', 'piano', 'ambient', 'lo-fi', 'lofi']
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      timeOfDay: 'Evening',
      mood: 'Relaxing',
      genres: ['chill', 'ambient', 'jazz', 'soul', 'acoustic']
    };
  } else {
    return {
      timeOfDay: 'Night',
      mood: 'Chill',
      genres: ['ambient', 'electronic', 'lo-fi', 'lofi', 'chill', 'downtempo']
    };
  }
};

// Weather-based genre mapping
const getWeatherGenres = (weather: string): string[] => {
  const weatherLower = weather.toLowerCase();
  
  if (weatherLower.includes('rain') || weatherLower.includes('storm')) {
    return ['ambient', 'jazz', 'classical', 'piano', 'lo-fi', 'lofi'];
  } else if (weatherLower.includes('cloud') || weatherLower.includes('overcast')) {
    return ['indie', 'alternative', 'acoustic', 'lo-fi', 'lofi'];
  } else if (weatherLower.includes('sun') || weatherLower.includes('clear')) {
    return ['pop', 'indie', 'rock', 'upbeat', 'happy'];
  } else if (weatherLower.includes('snow')) {
    return ['classical', 'piano', 'ambient', 'jazz'];
  }
  
  return ['pop', 'indie', 'alternative'];
};

// Get user location using browser geolocation API
const getUserLocation = async (): Promise<string> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve('Unknown');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Use reverse geocoding to get city name (using a free API)
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await response.json();
          resolve(data.city || data.locality || 'Unknown');
        } catch (error) {
          console.error('Failed to get location name:', error);
          resolve('Unknown');
        }
      },
      () => {
        resolve('Unknown');
      },
      { timeout: 5000 }
    );
  });
};

// Get weather data (mock for now, can integrate with weather API)
const getWeatherData = async (): Promise<string> => {
  // Mock weather based on time for demo
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 18) {
    return 'Clear';
  } else {
    return 'Clear Night';
  }
  
  // TODO: Integrate with real weather API like OpenWeatherMap
  // const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
};

export const useAutoVibeRecommendations = () => {
  const [context, setContext] = useState<VibeContext>({
    location: '',
    weather: '',
    timeOfDay: '',
    detectedMood: ''
  });
  const [bestMatch, setBestMatch] = useState<Track | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('location');
  const [error, setError] = useState<string | null>(null);

  const analyzeAndRecommend = async () => {
    setIsAnalyzing(true);
    setError(null);
    setBestMatch(null);

    try {
      console.log('🎵 [AutoVibe] Starting automatic vibe analysis...');

      // Step 1: Get user location
      setCurrentStep('location');
      console.log('📍 [AutoVibe] Detecting location...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for UX
      const location = await getUserLocation();
      console.log('📍 [AutoVibe] Location:', location);
      setContext(prev => ({ ...prev, location }));

      // Step 2: Get weather
      setCurrentStep('weather');
      console.log('🌤️ [AutoVibe] Checking weather...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for UX
      const weather = await getWeatherData();
      console.log('🌤️ [AutoVibe] Weather:', weather);
      setContext(prev => ({ ...prev, weather }));

      // Step 3: Analyze time and mood
      setCurrentStep('time');
      console.log('⏰ [AutoVibe] Analyzing time and mood...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for UX
      const timeContext = getTimeBasedMood();
      console.log('⏰ [AutoVibe] Time context:', timeContext);
      setContext(prev => ({
        ...prev,
        timeOfDay: timeContext.timeOfDay,
        detectedMood: timeContext.mood
      }));

      // Step 4: Detect mood
      setCurrentStep('mood');
      console.log('🎧 [AutoVibe] Finalizing mood...');
      await new Promise(resolve => setTimeout(resolve, 800)); // Delay for UX

      // Step 5: Match songs
      setCurrentStep('matching');
      console.log('🎵 [AutoVibe] Finding perfect match...');
      
      // Get genre preferences based on context
      const timeGenres = timeContext.genres;
      const weatherGenres = getWeatherGenres(weather);
      const allGenres = [...new Set([...timeGenres, ...weatherGenres])];
      
      console.log('🎵 [AutoVibe] Genre preferences:', allGenres);

      // Get songs from blockchain
      console.log('🎵 [AutoVibe] Fetching songs from blockchain...');
      const allSongs = await subgraphService.getAllSongs(200, 0, 'createdAt', 'desc');

      if (allSongs.length === 0) {
        throw new Error('No songs available');
      }

      console.log('🎵 [AutoVibe] Found songs:', allSongs.length);

      // Step 6: Score and filter songs
      const scoredSongs = allSongs.map(song => {
        const songGenre = (song.genre || '').toLowerCase();
        let score = 0;

        // Score based on genre match
        allGenres.forEach(genre => {
          const genreToMatch = genre.toLowerCase();
          if (songGenre.includes(genreToMatch) || genreToMatch.includes(songGenre)) {
            score += 5;
          }
        });

        // Bonus for time-specific genres
        timeGenres.forEach(genre => {
          const genreToMatch = genre.toLowerCase();
          if (songGenre.includes(genreToMatch) || genreToMatch.includes(songGenre)) {
            score += 3;
          }
        });

        return { song, score };
      });

      // Get songs with score > 0, or all songs if no matches
      const matchedSongs = scoredSongs.filter(item => item.score > 0);
      const songsToUse = matchedSongs.length > 0 ? matchedSongs : scoredSongs;

      // Sort by score and shuffle within same score
      const sortedSongs = songsToUse.sort((a, b) => {
        if (b.score === a.score) {
          return Math.random() - 0.5;
        }
        return b.score - a.score;
      });

      // Check if we have any songs
      if (sortedSongs.length === 0) {
        throw new Error('No matching songs found');
      }

      // Get best match - safely access first element
      const topSongItem = sortedSongs[0];
      if (!topSongItem) {
        throw new Error('No matching songs found');
      }

      const topSong = topSongItem.song;
      const tokenId = parseInt(topSong.tokenId || topSong.id);

      const extractIpfsHash = (hash: string): string => {
        if (!hash) return '';
        return hash.replace('ipfs://', '');
      };

      const audioHash = extractIpfsHash(topSong.audioHash || '');
      const coverHash = extractIpfsHash(topSong.coverHash || '');

      const track: Track = {
        tokenId,
        title: topSong.title || `Track #${tokenId}`,
        artist: topSong.artist?.displayName || topSong.artist?.username || 'Unknown Artist',
        cover: coverHash 
          ? `https://gateway.pinata.cloud/ipfs/${coverHash}`
          : `https://api.dicebear.com/7.x/shapes/svg?seed=${tokenId}`,
        audioUrl: audioHash
          ? `https://gateway.pinata.cloud/ipfs/${audioHash}`
          : '',
        duration: parseInt(topSong.duration || '180'),
        genre: topSong.genre || 'Unknown'
      };

      console.log('✅ [AutoVibe] Best match found:', track.title);
      
      // Step 6: Complete
      setCurrentStep('complete');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay before showing result
      setBestMatch(track);

    } catch (err) {
      console.error('❌ [AutoVibe] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze vibe');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    analyzeAndRecommend();
  }, []);

  return {
    location: context.location,
    weather: context.weather,
    timeOfDay: context.timeOfDay,
    detectedMood: context.detectedMood,
    bestMatch,
    isAnalyzing,
    currentStep,
    error,
    refetch: analyzeAndRecommend
  };
};
