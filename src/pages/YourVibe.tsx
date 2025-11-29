import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Cloud, Timer, Headphones, Play, Shuffle, Settings, X, Sparkles, Pause } from "lucide-react";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useAudio } from "@/contexts/AudioContext";
import { useAccount } from "wagmi";
import { recordMusicPlay } from "@/utils/playCountHelper";
import { useAIVibeRecommendations } from "@/hooks/useAIVibeRecommendations";
import { useSimilarSongRecommendations } from "@/hooks/useSimilarSongRecommendations";

import { toast } from "sonner";
import sphereImage from "@/assets/sphre.png";

const YourVibe = () => {
  const { currentTrack, isPlaying, playTrack, pauseTrack, setOnTrackEnd } = useAudio();
  const { address } = useAccount();
  
  // Mode: 'auto' or 'custom'
  const [mode, setMode] = useState<'auto' | 'custom'>('auto');
  const [showCustomModal, setShowCustomModal] = useState(false);
  
  // Custom vibe selections
  const [selectedMoment, setSelectedMoment] = useState<string>("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const moments = [
    "Studying", "Working", "Walking", "Driving", "Workout",
    "Cooking", "Relaxing", "Party"
  ];

  const genres = [
    "Pop", "Classical / Piano", "Lo-fi", "Rock",
    "EDM / Dance", "Hip-Hop / Rap", "Ambient",
    "Indie / Alternative", "Jazz", "World"
  ];
  
  // AI-powered vibe recommendations
  const {
    location,
    weather,
    timeOfDay,
    aiAnalysis,
    detectedMood,
    vibeDescription,
    playlistName,
    recommendedGenres,
    energy,
    bestMatch,
    recommendations,
    isAnalyzing,
    currentStep,
    error,
    refetch,
    chatMessages,
    isChatLoading,
    sendChatMessage,
    clearChat
  } = useAIVibeRecommendations();

  const [showVisualization, setShowVisualization] = useState(false);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const [displayedTrack, setDisplayedTrack] = useState<any>(null);

  // Get similar song recommendations
  const { recommendations: similarSongs } = useSimilarSongRecommendations(
    currentTrack?.id || null,
    currentTrack?.genre || null
  );

  // Auto-play when best match is loaded
  useEffect(() => {
    if (bestMatch && !hasAutoPlayed) {
      setShowVisualization(true);
      setDisplayedTrack(bestMatch);
      
      const autoPlayTimer = setTimeout(() => {
        playTrack({
          id: bestMatch.tokenId,
          title: bestMatch.title,
          artist: bestMatch.artist,
          cover: bestMatch.cover,
          audioUrl: bestMatch.audioUrl,
          duration: bestMatch.duration.toString(),
          genre: bestMatch.genre,
          avatar: '',
          likes: 0,
          plays: 0
        });
        recordMusicPlay({
          id: bestMatch.tokenId,
          title: bestMatch.title,
          artist: bestMatch.artist,
          cover: bestMatch.cover,
          audioUrl: bestMatch.audioUrl,
          duration: bestMatch.duration.toString(),
          genre: bestMatch.genre
        }, address, bestMatch.duration, 'yourvibe-ai');
        
        setHasAutoPlayed(true);
      }, 500);

      return () => clearTimeout(autoPlayTimer);
    }
  }, [bestMatch, hasAutoPlayed, playTrack, address]);

  // Reset auto-play flag when refetching
  useEffect(() => {
    if (isAnalyzing) {
      setHasAutoPlayed(false);
    }
  }, [isAnalyzing]);

  // Auto-play next similar song when track ends
  useEffect(() => {
    const handleTrackEnd = () => {
      console.log('🎵 [YourVibe] Track ended, playing next');
      
      // First try recommendations from AI, then similar songs
      const nextSongs = recommendations.length > 0 ? recommendations : similarSongs;
      
      if (nextSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(5, nextSongs.length));
        const nextSong = nextSongs[randomIndex];
        
        console.log('🎵 [YourVibe] Auto-playing:', nextSong.title);
        toast.success(`Now playing: ${nextSong.title}`, {
          description: `${aiAnalysis?.playlistName || 'Your Vibe'} • ${nextSong.genre}`
        });
        
        setDisplayedTrack(nextSong);
        
        playTrack({
          id: nextSong.tokenId,
          title: nextSong.title,
          artist: nextSong.artist,
          cover: nextSong.cover,
          audioUrl: nextSong.audioUrl,
          duration: nextSong.duration.toString(),
          genre: nextSong.genre,
          avatar: '',
          likes: 0,
          plays: 0
        });
        
        recordMusicPlay({
          id: nextSong.tokenId,
          title: nextSong.title,
          artist: nextSong.artist,
          cover: nextSong.cover,
          audioUrl: nextSong.audioUrl,
          duration: nextSong.duration.toString(),
          genre: nextSong.genre
        }, address, nextSong.duration, 'yourvibe-ai-auto');
      } else {
        toast.info('Finding more songs for you...');
        refetch();
      }
    };

    setOnTrackEnd(handleTrackEnd);
    return () => setOnTrackEnd(null);
  }, [recommendations, similarSongs, playTrack, address, refetch, setOnTrackEnd, aiAnalysis]);

  const handleMomentSelect = (moment: string) => {
    setSelectedMoment(moment);
  };

  const handleGenreToggle = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else if (selectedGenres.length < 3) {
      setSelectedGenres([...selectedGenres, genre]);
    } else {
      toast.error("You can select up to 3 genres");
    }
  };

  const handleApplyCustom = () => {
    if (!selectedMoment) {
      toast.error("Please select a moment");
      return;
    }
    if (selectedGenres.length === 0) {
      toast.error("Please select at least one genre");
      return;
    }
    setMode('custom');
    setShowCustomModal(false);
    // Trigger AI analysis with custom input
    const customInput = `${selectedMoment} with ${selectedGenres.join(', ')} music`;
    sendChatMessage(customInput);
  };

  const handleBackToAuto = () => {
    setMode('auto');
    setSelectedMoment("");
    setSelectedGenres([]);
    refetch();
  };

  // Get step label for AI analysis
  const getStepLabel = () => {
    switch (currentStep) {
      case 'location': return 'Detecting your location...';
      case 'weather': return 'Checking the weather...';
      case 'time': return 'Analyzing time of day...';
      case 'ai-analyzing': return 'AI is analyzing your vibe...';
      case 'matching': return 'Finding your perfect match...';
      default: return 'Preparing...';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* Main Content */}
      <main className="pt-16 min-h-screen flex items-center justify-center">
        <div className="container mx-auto px-6 py-12">
          {/* Mode Toggle */}
          <div className="absolute top-20 right-6 flex gap-2">
            {mode === 'custom' && (
              <Button
                onClick={handleBackToAuto}
                variant="outline"
                className="rounded-full border-white/30 text-white hover:bg-white/10"
                size="sm"
              >
                Auto Vibe
              </Button>
            )}
            <Button
              onClick={() => setShowCustomModal(true)}
              variant="outline"
              className="rounded-full border-white/30 text-white hover:bg-white/10"
              size="sm"
            >
              <Settings className="w-4 h-4 mr-2" />
              Custom Vibe
            </Button>
          </div>

          {/* Analysis Progress */}
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center space-y-8">
              {/* Context Icons with Progress */}
              <div className="flex items-center justify-center gap-6">
                {/* Location */}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    currentStep === 'location' 
                      ? 'border-white bg-white/10 animate-pulse' 
                      : location 
                        ? 'border-green-500 bg-green-500/20' 
                        : 'border-white/30'
                  }`}>
                    <MapPin className={`w-7 h-7 ${currentStep === 'location' || location ? 'text-white' : 'text-white/50'}`} />
                  </div>
                  <span className="text-xs text-white/70 text-center max-w-[80px]">
                    {location || (currentStep === 'location' ? 'Detecting...' : 'Location')}
                  </span>
                </div>

                {/* Weather */}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    currentStep === 'weather' 
                      ? 'border-white bg-white/10 animate-pulse' 
                      : weather 
                        ? 'border-green-500 bg-green-500/20' 
                        : 'border-white/30'
                  }`}>
                    <Cloud className={`w-7 h-7 ${currentStep === 'weather' || weather ? 'text-white' : 'text-white/50'}`} />
                  </div>
                  <span className="text-xs text-white/70 text-center max-w-[80px]">
                    {weather || (currentStep === 'weather' ? 'Checking...' : 'Weather')}
                  </span>
                </div>

                {/* Time */}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    currentStep === 'time' 
                      ? 'border-white bg-white/10 animate-pulse' 
                      : timeOfDay 
                        ? 'border-green-500 bg-green-500/20' 
                        : 'border-white/30'
                  }`}>
                    <Timer className={`w-7 h-7 ${currentStep === 'time' || timeOfDay ? 'text-white' : 'text-white/50'}`} />
                  </div>
                  <span className="text-xs text-white/70 text-center max-w-[80px]">
                    {timeOfDay || (currentStep === 'time' ? 'Analyzing...' : 'Time')}
                  </span>
                </div>

                {/* AI Analysis */}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    currentStep === 'ai-analyzing' || currentStep === 'matching'
                      ? 'border-primary bg-primary/20 animate-pulse' 
                      : detectedMood 
                        ? 'border-green-500 bg-green-500/20' 
                        : 'border-white/30'
                  }`}>
                    <Sparkles className={`w-7 h-7 ${currentStep === 'ai-analyzing' || currentStep === 'matching' || detectedMood ? 'text-white' : 'text-white/50'}`} />
                  </div>
                  <span className="text-xs text-white/70 text-center max-w-[80px]">
                    {detectedMood || (currentStep === 'ai-analyzing' ? 'AI Analyzing...' : currentStep === 'matching' ? 'Matching...' : 'AI')}
                  </span>
                </div>
              </div>

              {/* Progress Text */}
              <div className="text-center">
                <h2 className="font-clash font-semibold text-2xl mb-2">
                  {getStepLabel()}
                </h2>
                <p className="text-white/60">
                  {currentStep === 'ai-analyzing' 
                    ? 'Using AI to understand your perfect vibe' 
                    : 'Personalizing your music experience'}
                </p>
              </div>

              {/* Loading Spinner */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-primary animate-spin" />
                {currentStep === 'ai-analyzing' && (
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary animate-pulse" />
                )}
              </div>
            </div>
          )}

          {/* Error State */}
          {!isAnalyzing && error && (
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="text-center">
                <h2 className="font-clash font-semibold text-2xl mb-2 text-red-500">
                  Failed to analyze your vibe
                </h2>
                <p className="text-white/60 mb-6">{error}</p>
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  className="rounded-full border-white/30 text-white hover:bg-white/10"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Best Match Display */}
          {!isAnalyzing && !error && displayedTrack && (
            <div className="flex flex-col items-center justify-center space-y-8 max-w-2xl mx-auto">
              {/* AI Vibe Info */}
              {aiAnalysis && (
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-3">
                    <Sparkles className="w-4 h-4 text-white/70" />
                    <span className="text-sm text-white/70">AI-Powered Vibe</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white/90">{playlistName}</h3>
                  <p className="text-sm text-white/60 italic">"{vibeDescription}"</p>
                </div>
              )}

              {/* Context Icons - Filled */}
              <div className="flex items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full border-2 border-white/50 bg-white/10 flex items-center justify-center backdrop-blur-sm">
                    <MapPin className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-xs text-white/70">{location || 'Unknown'}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full border-2 border-white/50 bg-white/10 flex items-center justify-center backdrop-blur-sm">
                    <Cloud className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-xs text-white/70 text-center max-w-[80px] truncate">
                    {weather || 'Clear'}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full border-2 border-white/50 bg-white/10 flex items-center justify-center backdrop-blur-sm">
                    <Timer className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-xs text-white/70">{timeOfDay || 'Day'}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full border-2 border-primary/50 bg-primary/10 flex items-center justify-center backdrop-blur-sm">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <span className="text-xs text-white/70">{detectedMood || 'Chill'}</span>
                </div>
              </div>

              {/* Recommended Genres Tags */}
              {recommendedGenres.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {recommendedGenres.map((genre, i) => (
                    <span 
                      key={i}
                      className="px-3 py-1 text-xs rounded-full bg-white/5 text-white/70 border border-white/10"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Song Title */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                  <h1 className="font-clash font-semibold text-3xl">
                    {displayedTrack.title}
                  </h1>
                </div>
              </div>

              {/* Animated Visualization Sphere */}
              <div className="relative w-[380px] h-[380px] flex items-center justify-center">
                {/* Glow Effect */}
                <div className="absolute w-[350px] h-[350px] rounded-full bg-gradient-to-br from-primary/35 via-secondary/35 to-accent/35 blur-[120px] animate-pulse pointer-events-none" />
                <div className="absolute w-[320px] h-[320px] rounded-full bg-gradient-to-br from-primary/25 via-secondary/25 to-accent/25 blur-[100px] animate-pulse pointer-events-none" style={{ animationDelay: '0.5s' }} />
                <div className="absolute w-[280px] h-[280px] rounded-full bg-gradient-to-br from-white/8 to-transparent blur-[80px] pointer-events-none" />
                
                {/* 3D Sphere */}
                <div className="relative w-[320px] h-[320px] flex items-center justify-center">
                  <img
                    src={sphereImage}
                    alt="Vibe Sphere"
                    className="w-full h-full object-contain animate-spin-slow drop-shadow-2xl"
                  />
                  {showVisualization && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: '3s' }} />
                      <div className="absolute inset-0 rounded-full border-2 border-secondary/30 animate-ping" style={{ animationDuration: '4s', animationDelay: '0.5s' }} />
                    </>
                  )}
                </div>
              </div>

              {/* Control Buttons */}
              <div className="relative z-10 flex items-center gap-4">
                <Button
                  onClick={() => refetch()}
                  variant="ghost"
                  className="w-14 h-14 rounded-full border-2 border-white/30 hover:bg-white/10 hover:border-white/50 transition-all"
                  title="Shuffle - Get new AI recommendations"
                >
                  <Shuffle className="w-6 h-6" />
                </Button>

                <Button
                  onClick={() => {
                    if (currentTrack?.id === displayedTrack.tokenId && isPlaying) {
                      pauseTrack();
                    } else {
                      playTrack({
                        id: displayedTrack.tokenId,
                        title: displayedTrack.title,
                        artist: displayedTrack.artist,
                        cover: displayedTrack.cover,
                        audioUrl: displayedTrack.audioUrl,
                        duration: displayedTrack.duration.toString(),
                        genre: displayedTrack.genre,
                        avatar: '',
                        likes: 0,
                        plays: 0
                      });
                      recordMusicPlay({
                        id: displayedTrack.tokenId,
                        title: displayedTrack.title,
                        artist: displayedTrack.artist,
                        cover: displayedTrack.cover,
                        audioUrl: displayedTrack.audioUrl,
                        duration: displayedTrack.duration.toString(),
                        genre: displayedTrack.genre
                      }, address, displayedTrack.duration, 'yourvibe-ai');
                    }
                  }}
                  className="px-12 h-14 rounded-full bg-white hover:bg-white/90 text-black text-lg font-semibold transition-all hover:scale-105"
                >
                  {currentTrack?.id === displayedTrack.tokenId && isPlaying ? (
                    <>
                      <Pause className="w-6 h-6 mr-2 fill-current" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-6 h-6 mr-2 fill-current" />
                      Play
                    </>
                  )}
                </Button>
              </div>

              {/* Artist Info */}
              <div className="text-center text-white/60 text-sm">
                by {displayedTrack.artist}
              </div>

              {/* Up Next */}
              {recommendations.length > 0 && (
                <div className="w-full max-w-md mt-8">
                  <h4 className="text-sm font-semibold text-white/70 mb-3">Up Next</h4>
                  <div className="space-y-2">
                    {recommendations.slice(0, 3).map((track, i) => (
                      <button
                        key={track.tokenId}
                        onClick={() => {
                          setDisplayedTrack(track);
                          playTrack({
                            id: track.tokenId,
                            title: track.title,
                            artist: track.artist,
                            cover: track.cover,
                            audioUrl: track.audioUrl,
                            duration: track.duration.toString(),
                            genre: track.genre,
                            avatar: '',
                            likes: 0,
                            plays: 0
                          });
                        }}
                        className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                      >
                        <img 
                          src={track.cover} 
                          alt={track.title}
                          className="w-10 h-10 rounded object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{track.title}</p>
                          <p className="text-xs text-white/50 truncate">{track.artist}</p>
                        </div>
                        <span className="text-xs text-white/40">{track.genre}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>



      {/* Custom Vibe Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg bg-zinc-900 border-white/20 rounded-3xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-clash font-semibold text-2xl text-white">Customize Your Vibe</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full w-8 h-8 p-0 text-white hover:bg-white/10"
                  onClick={() => setShowCustomModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Pick Your Moment */}
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-3 text-white">Pick Your Moment (Select one)</h3>
                <div className="flex flex-wrap gap-2">
                  {moments.map((moment) => (
                    <Button
                      key={moment}
                      variant={selectedMoment === moment ? "default" : "outline"}
                      size="sm"
                      className={`rounded-full text-xs ${
                        selectedMoment === moment 
                          ? 'bg-gradient-to-r from-primary to-secondary text-primary-foreground border-0' 
                          : 'border-white/30 text-white hover:bg-white/10'
                      }`}
                      onClick={() => handleMomentSelect(moment)}
                    >
                      {moment}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Choose Your Genres */}
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-3 text-white">
                  Choose Your Genres (Up to 3)
                  {selectedGenres.length > 0 && (
                    <span className="text-white/60 ml-2">
                      {selectedGenres.length}/3
                    </span>
                  )}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <Button
                      key={genre}
                      variant={selectedGenres.includes(genre) ? "default" : "outline"}
                      size="sm"
                      className={`rounded-full text-xs ${
                        selectedGenres.includes(genre)
                          ? 'bg-gradient-to-r from-primary to-secondary text-primary-foreground border-0'
                          : 'border-white/30 text-white hover:bg-white/10'
                      }`}
                      onClick={() => handleGenreToggle(genre)}
                    >
                      {genre}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Apply Button */}
              <Button
                className="w-full rounded-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground"
                onClick={handleApplyCustom}
                disabled={!selectedMoment || selectedGenres.length === 0}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Apply Custom Vibe
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default YourVibe;
