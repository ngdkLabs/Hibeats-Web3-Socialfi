import { useState, useRef, useEffect } from 'react';
import { Play, Pause, X, Sparkles } from 'lucide-react';
import { useAudio } from '@/contexts/AudioContext';
import { useAccount } from 'wagmi';
import { recordMusicPlay } from '@/utils/playCountHelper';
import { useAutoVibeRecommendations } from '@/hooks/useAutoVibeRecommendations';
import sphereImage from '@/assets/sphre.png';

interface Position {
  x: number;
  y: number;
}

const FloatingVibeWidget = () => {
  const { currentTrack, isPlaying, playTrack, pauseTrack } = useAudio();
  const { address } = useAccount();
  const [position, setPosition] = useState<Position>({ x: 20, y: window.innerHeight - 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const autoCollapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get vibe recommendation
  const { bestMatch, isAnalyzing } = useAutoVibeRecommendations();

  // Auto-collapse after 30 seconds
  useEffect(() => {
    if (isExpanded) {
      // Clear any existing timer
      if (autoCollapseTimerRef.current) {
        clearTimeout(autoCollapseTimerRef.current);
      }

      // Set new timer for 30 seconds
      autoCollapseTimerRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, 30000); // 30 seconds

      // Cleanup on unmount or when isExpanded changes
      return () => {
        if (autoCollapseTimerRef.current) {
          clearTimeout(autoCollapseTimerRef.current);
        }
      };
    }
  }, [isExpanded]);

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Handle drag move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep within viewport bounds
      const maxX = window.innerWidth - 120;
      const maxY = window.innerHeight - 120;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handlePlayPause = () => {
    if (!bestMatch) return;

    if (currentTrack?.id === bestMatch.tokenId && isPlaying) {
      pauseTrack();
    } else {
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
      }, address, bestMatch.duration, 'explore');
    }
  };

  if (isMinimized) return null;

  return (
    <div
      ref={widgetRef}
      className="fixed z-50 cursor-move"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: isDragging ? 'none' : 'all 0.3s ease'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Compact Widget */}
      {!isExpanded && (
        <div className="relative group">
          {/* Glow Effect - Adjusted for PNG */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/40 via-blue-400/40 to-purple-400/40 blur-2xl animate-pulse" />
          <div className="absolute inset-0 rounded-full bg-white/15 blur-xl" />
          
          {/* Sphere */}
          <div 
            className="relative w-16 h-16 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
            onClick={() => setIsExpanded(true)}
          >
            <img
              src={sphereImage}
              alt="Vibe"
              className="w-full h-full object-contain animate-spin-slow drop-shadow-xl"
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Expanded Widget */}
      {isExpanded && bestMatch && (
        <div className="relative bg-white/10 backdrop-blur-2xl rounded-2xl p-4 w-64 shadow-2xl border border-white/20">
          {/* Close Button */}
          <button
            onClick={() => setIsExpanded(false)}
            className="no-drag absolute top-2 right-2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          {/* Content */}
          <div className="space-y-3">
            {/* Mini Sphere */}
            <div className="flex items-center justify-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/40 via-blue-400/40 to-purple-400/40 blur-2xl" />
                <img
                  src={sphereImage}
                  alt="Vibe"
                  className="relative w-full h-full object-contain animate-spin-slow drop-shadow-xl"
                />
              </div>
            </div>

            {/* Track Info */}
            <div className="text-center">
              <p className="text-xs text-white/60 mb-1 flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3" />
                Your Vibe
              </p>
              <h3 className="text-white font-semibold text-sm truncate">{bestMatch.title}</h3>
              <p className="text-white/60 text-xs truncate">{bestMatch.artist}</p>
            </div>

            {/* Play Button */}
            <button
              onClick={handlePlayPause}
              className="no-drag w-full py-2 rounded-full bg-white text-black hover:bg-white/90 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              {currentTrack?.id === bestMatch.tokenId && isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Play
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isExpanded && isAnalyzing && (
        <div className="relative bg-white/10 backdrop-blur-2xl rounded-2xl p-4 w-64 shadow-2xl border border-white/20">
          <button
            onClick={() => setIsExpanded(false)}
            className="no-drag absolute top-2 right-2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
            <p className="text-white/60 text-sm">Finding your vibe...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingVibeWidget;
