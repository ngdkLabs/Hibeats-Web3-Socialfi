import { useState, useEffect, useCallback } from 'react';
import { subgraphService } from '@/services/subgraphService';
import { analyzeVibeWithAI, chatWithVibeAI, type VibeContext, type AIVibeAnalysis, type AIChatMessage } from '@/services/bedrockAIService';

interface Track {
  tokenId: number;
  title: string;
  artist: string;
  cover: string;
  audioUrl: string;
  duration: number;
  genre: string;
}

export type AnalysisStep = 'location' | 'weather' | 'time' | 'ai-analyzing' | 'matching' | 'complete';

// Get user location
const getUserLocation = async (): Promise<string> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve('Unknown');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await response.json();
          resolve(data.city || data.locality || 'Unknown');
        } catch {
          resolve('Unknown');
        }
      },
      () => resolve('Unknown'),
      { timeout: 5000 }
    );
  });
};

// Get weather data
const getWeatherData = async (): Promise<string> => {
  // For now, mock based on time. Can integrate OpenWeatherMap later
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 18) return 'Clear';
  return 'Clear Night';
};

// Get time of day
const getTimeOfDay = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return 'Early Morning';
  if (hour >= 9 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
};

export const useAIVibeRecommendations = (userInput?: string) => {
  const [context, setContext] = useState<VibeContext>({
    location: '',
    weather: '',
    timeOfDay: '',
    userInput: ''
  });
  const [aiAnalysis, setAiAnalysis] = useState<AIVibeAnalysis | null>(null);
  const [bestMatch, setBestMatch] = useState<Track | null>(null);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('location');
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const analyzeAndRecommend = useCallback(async (customInput?: string) => {
    setIsAnalyzing(true);
    setError(null);
    setBestMatch(null);
    setRecommendations([]);

    try {
      console.log('🤖 [AIVibe] Starting AI-powered vibe analysis...');

      // Step 1: Get location
      setCurrentStep('location');
      await new Promise(resolve => setTimeout(resolve, 800));
      const location = await getUserLocation();
      console.log('📍 [AIVibe] Location:', location);

      // Step 2: Get weather
      setCurrentStep('weather');
      await new Promise(resolve => setTimeout(resolve, 600));
      const weather = await getWeatherData();
      console.log('🌤️ [AIVibe] Weather:', weather);

      // Step 3: Get time
      setCurrentStep('time');
      await new Promise(resolve => setTimeout(resolve, 600));
      const timeOfDay = getTimeOfDay();
      console.log('⏰ [AIVibe] Time:', timeOfDay);

      const newContext: VibeContext = {
        location,
        weather,
        timeOfDay,
        userInput: customInput || userInput || ''
      };
      setContext(newContext);

      // Step 4: AI Analysis
      setCurrentStep('ai-analyzing');
      console.log('🤖 [AIVibe] Running AI analysis...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const analysis = await analyzeVibeWithAI(newContext);
      console.log('🤖 [AIVibe] AI Analysis result:', analysis);
      setAiAnalysis(analysis);

      // Step 5: Match songs
      setCurrentStep('matching');
      console.log('🎵 [AIVibe] Finding songs matching AI recommendations...');
      
      const allSongs = await subgraphService.getAllSongs(200, 0, 'createdAt', 'desc');
      
      if (allSongs.length === 0) {
        throw new Error('No songs available');
      }

      console.log('🎵 [AIVibe] Found songs:', allSongs.length);
      console.log('🎵 [AIVibe] Target genres:', analysis.genres);

      // Score songs based on AI-recommended genres
      const scoredSongs = allSongs.map(song => {
        const songGenre = (song.genre || '').toLowerCase();
        let score = 0;

        // Match against AI-recommended genres
        analysis.genres.forEach((genre, index) => {
          const genreToMatch = genre.toLowerCase();
          if (songGenre.includes(genreToMatch) || genreToMatch.includes(songGenre)) {
            // Higher score for first genres (more relevant)
            score += 10 - index;
          }
        });

        // Energy-based scoring
        if (analysis.energy === 'high' && 
            (songGenre.includes('edm') || songGenre.includes('rock') || songGenre.includes('dance'))) {
          score += 3;
        } else if (analysis.energy === 'low' && 
            (songGenre.includes('ambient') || songGenre.includes('chill') || songGenre.includes('lo-fi'))) {
          score += 3;
        }

        return { song, score };
      });

      // Get matched songs or fallback to all
      const matchedSongs = scoredSongs.filter(item => item.score > 0);
      const songsToUse = matchedSongs.length > 0 ? matchedSongs : scoredSongs;

      // Sort and shuffle within same score
      const sortedSongs = songsToUse.sort((a, b) => {
        if (b.score === a.score) return Math.random() - 0.5;
        return b.score - a.score;
      });

      // Map to Track format
      const extractIpfsHash = (hash: string): string => {
        if (!hash) return '';
        return hash.replace('ipfs://', '');
      };

      const tracks: Track[] = sortedSongs.map(item => {
        const song = item.song;
        const tokenId = parseInt(song.tokenId || song.id);
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

      // Set best match and recommendations
      const topTrack = tracks[0] || null;
      const otherTracks = tracks.slice(1, 10);

      console.log('✅ [AIVibe] Best match:', topTrack?.title);
      console.log('✅ [AIVibe] Recommendations:', otherTracks.length);

      setCurrentStep('complete');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setBestMatch(topTrack);
      setRecommendations(otherTracks);

    } catch (err) {
      console.error('❌ [AIVibe] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze vibe');
    } finally {
      setIsAnalyzing(false);
    }
  }, [userInput]);

  // Chat function
  const sendChatMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    const userMessage: AIChatMessage = { role: 'user', content: message };
    setChatMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      const response = await chatWithVibeAI([...chatMessages, userMessage], context);
      const assistantMessage: AIChatMessage = { role: 'assistant', content: response };
      setChatMessages(prev => [...prev, assistantMessage]);

      // If the response suggests a mood/genre, trigger new recommendations
      const lowerResponse = response.toLowerCase();
      if (lowerResponse.includes('let me find') || 
          lowerResponse.includes("i'll queue") || 
          lowerResponse.includes("i'll set you up")) {
        // Extract mood from conversation and re-analyze
        await analyzeAndRecommend(message);
      }
    } catch (err) {
      console.error('❌ [AIVibe] Chat error:', err);
      const errorMessage: AIChatMessage = { 
        role: 'assistant', 
        content: "Sorry, I'm having trouble right now. Try telling me what mood you're in!" 
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatMessages, context, analyzeAndRecommend]);

  // Clear chat
  const clearChat = useCallback(() => {
    setChatMessages([]);
  }, []);

  // Initial analysis
  useEffect(() => {
    analyzeAndRecommend();
  }, []);

  return {
    // Context
    location: context.location,
    weather: context.weather,
    timeOfDay: context.timeOfDay,
    
    // AI Analysis
    aiAnalysis,
    detectedMood: aiAnalysis?.mood || '',
    vibeDescription: aiAnalysis?.vibeDescription || '',
    playlistName: aiAnalysis?.playlistName || '',
    recommendedGenres: aiAnalysis?.genres || [],
    energy: aiAnalysis?.energy || 'medium',
    
    // Tracks
    bestMatch,
    recommendations,
    
    // State
    isAnalyzing,
    currentStep,
    error,
    
    // Actions
    refetch: analyzeAndRecommend,
    
    // Chat
    chatMessages,
    isChatLoading,
    sendChatMessage,
    clearChat
  };
};
