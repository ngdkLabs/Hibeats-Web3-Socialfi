import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

export interface Track {
  id: number;
  title: string;
  artist: string;
  avatar: string;
  cover: string;
  genre: string;
  duration: string;
  audioUrl?: string; // URL to audio file
  likes: number;
  plays?: number;
  description?: string;
  bpm?: number;
  key?: string;
  price?: string;
  tokenId?: number; // NFT token ID for play count tracking
}

export type LoopMode = 'off' | 'all' | 'one';

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playlist: Track[];
  currentIndex: number;
  audioData: Uint8Array;
  visualizerUpdate: number;
  isAudioReady: boolean;
  loopMode: LoopMode;
  playTrack: (track: Track) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  stopTrack: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  addToPlaylist: (track: Track) => void;
  removeFromPlaylist: (track: Track) => void;
  clearPlaylist: () => void;
  setPlaylist: (tracks: Track[]) => void;
  setOnTrackEnd: (callback: (() => void) | null) => void;
  toggleLoop: () => void;
  clearPlayCountTracking: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load volume from cookie on initialization
  const getInitialVolume = () => {
    try {
      const { cookieService } = require('@/services/cookieService');
      const savedVolume = cookieService.getVolume();
      if (savedVolume !== null && savedVolume >= 0 && savedVolume <= 1) {
        return savedVolume;
      }
    } catch (error) {
      // console.error('Failed to load volume from cookie:', error);
    }
    return 0.7; // Default volume
  };

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(getInitialVolume());
  const [playlist, setPlaylistState] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loopMode, setLoopMode] = useState<LoopMode>('off');

  const [isAudioReady, setIsAudioReady] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [audioData, setAudioData] = useState<Uint8Array<ArrayBuffer>>(new Uint8Array(0) as Uint8Array<ArrayBuffer>);
  const [visualizerUpdate, setVisualizerUpdate] = useState(0);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const onTrackEndRef = useRef<(() => void) | null>(null);
  
  // ===== PLAY COUNT TRACKING (ANTI-MANIPULATION) =====
  // Play count hanya dihitung ketika lagu sudah diputar 80-100%
  // Ini mencegah user manipulasi dengan hanya klik play tanpa mendengarkan
  const playCountTrackedRef = useRef<Set<number>>(new Set()); // Track which songs have been counted
  const playStartTimeRef = useRef<number>(0); // When the current track started playing
  const hasReached80PercentRef = useRef<boolean>(false); // Flag to track if 80% reached
  
  // Refs to store latest values for event listeners (to avoid stale closures)
  const playlistRef = useRef<Track[]>([]);
  const currentIndexRef = useRef<number>(-1);
  const loopModeRef = useRef<LoopMode>('off');

  // Keep refs in sync with state
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    loopModeRef.current = loopMode;
  }, [loopMode]);

  // Initialize Web Audio API for visualizer
  const initializeAudioContext = () => {
    if (!audioContextRef.current && audioRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;

        // Only create source if not already created
        if (!sourceRef.current) {
          sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          console.log('✅ Web Audio API initialized - audio routed through AudioContext');
        }

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength) as Uint8Array<ArrayBuffer>;
        setAudioData(dataArray);
      } catch (error) {
        console.error('❌ Error initializing Web Audio API:', error);
        console.error('This might cause no audio output. Error:', error);
      }
    }
  };

  // Update audio data for visualizer
  const updateAudioData = useCallback(() => {
    if (analyserRef.current && audioData.length > 0) {
      analyserRef.current.getByteFrequencyData(audioData);
      // Force update by creating new array reference
      setAudioData(new Uint8Array(audioData) as Uint8Array<ArrayBuffer>);
    }
    animationRef.current = requestAnimationFrame(updateAudioData);
  }, [audioData]);

  // Start/stop visualizer animation
  useEffect(() => {
    if (isPlaying && analyserRef.current) {
      // Start animation loop
      if (!animationRef.current) {
        updateAudioData();
      }
    } else {
      // Stop animation loop
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, updateAudioData]); // Include updateAudioData in dependencies

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;

      // Initialize Web Audio API for visualizer
      initializeAudioContext();

      // Audio event listeners
      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          setDuration(audioRef.current.duration);
        }
      });

      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          const time = audioRef.current.currentTime;
          const dur = audioRef.current.duration;
          setCurrentTime(time);
          
          // Check if 80% reached and not yet counted
          if (dur > 0 && time / dur >= 0.8 && !hasReached80PercentRef.current) {
            hasReached80PercentRef.current = true;
            
            // Get current track from ref (to avoid stale closure)
            const track = currentTrack;
            if (!track) return;
            
            // Only record if not already tracked for this track
            const trackId = track.tokenId || track.id;
            if (!playCountTrackedRef.current.has(trackId)) {
              // Additional validation: Check if user actually listened (not just seeked)
              // Minimum play time should be at least 50% of the duration
              const playDuration = Date.now() - playStartTimeRef.current;
              const minPlayTime = (dur * 1000) * 0.5; // 50% of duration in milliseconds
              
              if (playDuration < minPlayTime) {
                console.log('⚠️ [PlayCount] Skipping - play duration too short (possible seek manipulation):', {
                  playDuration: Math.floor(playDuration / 1000) + 's',
                  minRequired: Math.floor(minPlayTime / 1000) + 's'
                });
                return;
              }
              
              playCountTrackedRef.current.add(trackId);
              
              // Record play count asynchronously
              console.log('🎵 [PlayCount] 80% reached, recording play count for track:', trackId, {
                playDuration: Math.floor(playDuration / 1000) + 's',
                trackDuration: Math.floor(dur) + 's'
              });
              
              // Use dynamic import to avoid circular dependencies
              import('@/utils/playCountHelper').then(({ recordMusicPlay }) => {
                recordMusicPlay(
                  track,
                  undefined, // Will be handled by the helper (gets from localStorage)
                  Math.floor(dur),
                  'player' as any
                ).catch(error => {
                  console.error('❌ [PlayCount] Failed to record play count:', error);
                });
              }).catch(error => {
                console.error('❌ [PlayCount] Failed to import playCountHelper:', error);
              });
            }
          }
        }
      });

      audioRef.current.addEventListener('ended', () => {
        // Call custom callback if set (for YourVibe auto-recommendations)
        if (onTrackEndRef.current) {
          console.log('🎵 [AudioContext] Track ended - calling custom callback');
          onTrackEndRef.current();
        } else {
          // Check loop mode
          const currentPlaylist = playlistRef.current;
          const currentIdx = currentIndexRef.current;
          const mode = loopModeRef.current;
          
          if (mode === 'one') {
            // Repeat current track
            console.log('🔁 [AudioContext] Loop One - repeating current track');
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(err => console.error('Failed to replay track:', err));
            }
          } else if (mode === 'all') {
            // Loop entire playlist
            if (currentIdx >= currentPlaylist.length - 1) {
              console.log('🔁 [AudioContext] Loop All - restarting playlist from beginning');
              if (currentPlaylist.length > 0 && currentPlaylist[0]) {
                setCurrentIndex(0);
                currentIndexRef.current = 0;
                playTrack(currentPlaylist[0]);
              }
            } else {
              // Continue to next track
              console.log('🔁 [AudioContext] Loop All - playing next track');
              nextTrack();
            }
          } else {
            // Default behavior: play next track in playlist (no loop)
            console.log('🎵 [AudioContext] Track ended - playing next in playlist');
            nextTrack();
          }
        }
      });

      audioRef.current.addEventListener('canplay', () => {
        // Audio is ready to play, but we handle playing in playTrack function
        console.log('Audio can play');
      });

      // Add user interaction handler to resume audio context
      const handleUserInteraction = async () => {
        setHasUserInteracted(true);

        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          try {
            await audioContextRef.current.resume();
            console.log('Audio context resumed');
          } catch (error) {
            console.error('Failed to resume audio context:', error);
          }
        }
      };

      // Add event listeners for user interactions - more comprehensive for mobile
      const events = ['click', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'keydown', 'scroll', 'focus'];
      events.forEach(event => {
        document.addEventListener(event, handleUserInteraction, { passive: true });
      });

      return () => {
        events.forEach(event => {
          document.removeEventListener(event, handleUserInteraction);
        });
      };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const playTrack = async (track: Track) => {
    if (!audioRef.current) {
      console.error('🎵 [AudioContext] Audio element not initialized');
      return;
    }
    
    if (isLoadingTrack) {
      console.log('🎵 [AudioContext] Already loading a track, skipping');
      return;
    }

    console.log('🎵 [AudioContext] playTrack called with:', track);
    console.log('🎵 [AudioContext] Track audioUrl:', track.audioUrl);

    // Set user has interacted (important for mobile)
    setHasUserInteracted(true);

    // Resume audio context if suspended (required by modern browsers)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
        console.log('Audio context resumed for track:', track.title);
      } catch (error) {
        console.error('Failed to resume audio context:', error);
        return;
      }
    }

    // If it's the same track, just resume
    if (currentTrack?.id === track.id) {
      console.log('🎵 [AudioContext] Same track, resuming');
      resumeTrack();
      return;
    }

    // Set loading state to prevent multiple calls
    setIsLoadingTrack(true);

    // Set new track
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(0);
    
    // Reset play count tracking for new track
    hasReached80PercentRef.current = false;
    playStartTimeRef.current = Date.now();

    if (track.audioUrl && track.audioUrl.trim() !== '') {
      // For IPFS URLs, add crossorigin attribute
      if (track.audioUrl.includes('ipfs')) {
        audioRef.current.crossOrigin = 'anonymous';
        console.log('🌐 [AudioContext] Loading IPFS audio:', track.audioUrl);
      } else {
        console.log('🌐 [AudioContext] Loading audio from:', track.audioUrl);
      }
      audioRef.current.src = track.audioUrl;
    } else {
      // No audio URL provided - cannot play
      console.error('❌ [AudioContext] No audioUrl provided for track:', track.title);
      setIsLoadingTrack(false);
      return;
    }

    // Add error handler for audio loading
    const handleLoadError = () => {
      console.error('❌ Failed to load audio from:', audioRef.current?.src);
      
      // Try alternative IPFS gateways
      if (audioRef.current) {
        const currentSrc = audioRef.current.src;
        const hash = currentSrc.split('/ipfs/')[1];
        
        if (hash) {
          let altUrl = '';
          if (currentSrc.includes('ipfs.io')) {
            altUrl = `https://gateway.pinata.cloud/ipfs/${hash}`;
          } else if (currentSrc.includes('gateway.pinata.cloud')) {
            altUrl = `https://cloudflare-ipfs.com/ipfs/${hash}`;
          } else if (currentSrc.includes('cloudflare-ipfs.com')) {
            altUrl = `https://dweb.link/ipfs/${hash}`;
          }
          
          if (altUrl) {
            console.log('🔄 Trying alternative gateway:', altUrl);
            audioRef.current.src = altUrl;
            audioRef.current.load();
            audioRef.current.play().catch(err => {
              console.error('❌ Alternative gateway also failed:', err);
            });
          }
        }
      }
    };
    
    audioRef.current.addEventListener('error', handleLoadError, { once: true });
    audioRef.current.load();

    // Try to play immediately after setting src
    try {
      audioRef.current.volume = volume;
      console.log('🔊 Volume set to:', volume);
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        await playPromise;
        setIsPlaying(true);
        setIsAudioReady(false);
        console.log('✅ Audio playback started successfully for:', track.title);
      } else {
        setIsPlaying(true);
        setIsAudioReady(false);
        console.log('✅ Audio playback started (legacy) for:', track.title);
      }
    } catch (error) {
      console.error('❌ Audio playback failed:', error);
      setIsPlaying(false);
      setIsAudioReady(true);
      console.log('⚠️ Autoplay prevented - audio ready for manual play');
    } finally {
      setIsLoadingTrack(false);
    }

    // Update current index in playlist
    // Note: playlist state might not be updated yet if setPlaylist was just called
    // So we also check if currentIndex is already set correctly
    const index = playlist.findIndex(t => t.id === track.id);
    if (index !== -1) {
      setCurrentIndex(index);
      console.log('🎵 [AudioContext] Updated currentIndex to:', index);
    } else {
      console.log('🎵 [AudioContext] Track not found in current playlist, keeping currentIndex:', currentIndex);
    }
  };

  const pauseTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    
    // Note: We don't reset hasReached80PercentRef here
    // because pausing shouldn't reset the play count tracking
    // User can pause and resume, and it should still count if they reach 80%
  };

  const resumeTrack = async () => {
    if (audioRef.current && currentTrack) {
      try {
        // Ensure audio context is running
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Always try to play/resume - let browser handle autoplay policies
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
          setIsAudioReady(false); // Reset ready state
          console.log('Audio resumed successfully');
        } else {
          setIsPlaying(true);
          setIsAudioReady(false);
          console.log('Audio resumed (legacy)');
        }
      } catch (error) {
        console.error('Failed to resume audio:', error);
        setIsPlaying(false);
        setIsAudioReady(true); // Set ready for next attempt

        // This might happen due to autoplay policies
        console.log('Resume failed - audio ready for next interaction');
      }
    }
  };

  const stopTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const setVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    
    // Save volume to cookie using enhanced method
    try {
      const { cookieService } = require('@/services/cookieService');
      cookieService.setVolume(clampedVolume);
    } catch (error) {
      console.error('Failed to save volume to cookie:', error);
    }
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      
      // If user seeks backward past 80%, reset the flag
      // This prevents manipulation by seeking to 80%, then back, then forward again
      const dur = audioRef.current.duration;
      if (dur > 0 && time / dur < 0.8) {
        hasReached80PercentRef.current = false;
      }
    }
  };

  const nextTrack = () => {
    // Use refs to get latest values (important for event listeners)
    const currentPlaylist = playlistRef.current;
    const currentIdx = currentIndexRef.current;
    
    console.log('🎵 [AudioContext] nextTrack called - playlist length:', currentPlaylist.length, 'currentIndex:', currentIdx);
    
    if (currentPlaylist.length > 0 && currentIdx < currentPlaylist.length - 1) {
      const nextIndex = currentIdx + 1;
      const nextTrackItem = currentPlaylist[nextIndex];
      if (nextTrackItem) {
        console.log('🎵 [AudioContext] Playing next track at index:', nextIndex);
        setCurrentIndex(nextIndex);
        currentIndexRef.current = nextIndex; // Update ref immediately
        playTrack(nextTrackItem);
      }
    } else {
      console.log('🎵 [AudioContext] No more tracks in playlist, stopping');
      stopTrack();
    }
  };

  const previousTrack = () => {
    // Use refs to get latest values
    const currentPlaylist = playlistRef.current;
    const currentIdx = currentIndexRef.current;
    
    console.log('🎵 [AudioContext] previousTrack called - playlist length:', currentPlaylist.length, 'currentIndex:', currentIdx);
    
    if (currentPlaylist.length > 0 && currentIdx > 0) {
      const prevIndex = currentIdx - 1;
      const prevTrackItem = currentPlaylist[prevIndex];
      if (prevTrackItem) {
        console.log('🎵 [AudioContext] Playing previous track at index:', prevIndex);
        setCurrentIndex(prevIndex);
        currentIndexRef.current = prevIndex; // Update ref immediately
        playTrack(prevTrackItem);
      }
    }
  };

  const addToPlaylist = (track: Track) => {
    setPlaylistState(prev => {
      if (!prev.find(t => t.id === track.id)) {
        return [...prev, track];
      }
      return prev;
    });
  };

  const removeFromPlaylist = (track: Track) => {
    setPlaylistState(prev => prev.filter(t => t.id !== track.id));
  };

  const clearPlaylist = () => {
    setPlaylistState([]);
    setCurrentIndex(-1);
  };

  const setPlaylist = (tracks: Track[]) => {
    console.log('🎵 [AudioContext] Setting playlist with', tracks.length, 'tracks');
    setPlaylistState(tracks);
    playlistRef.current = tracks; // Update ref immediately for event listeners
    if (tracks.length > 0) {
      setCurrentIndex(0);
      currentIndexRef.current = 0; // Update ref immediately
    } else {
      setCurrentIndex(-1);
      currentIndexRef.current = -1;
    }
  };

  const setOnTrackEnd = (callback: (() => void) | null) => {
    onTrackEndRef.current = callback;
    console.log('🎵 [AudioContext] Track end callback set:', callback ? 'Custom' : 'Default');
  };

  const toggleLoop = () => {
    setLoopMode(prev => {
      // Cycle through: off -> all -> one -> off
      const nextMode = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      console.log('🔁 [AudioContext] Loop mode changed:', prev, '->', nextMode);
      return nextMode;
    });
  };

  const clearPlayCountTracking = () => {
    // Clear play count tracking (useful for logout or session reset)
    playCountTrackedRef.current.clear();
    hasReached80PercentRef.current = false;
    console.log('🧹 [PlayCount] Tracking cleared');
  };

  const value: AudioContextType = {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playlist,
    currentIndex,
    audioData,
    visualizerUpdate,
    isAudioReady,
    loopMode,
    playTrack,
    pauseTrack,
    resumeTrack,
    stopTrack,
    setVolume,
    seekTo,
    nextTrack,
    previousTrack,
    addToPlaylist,
    removeFromPlaylist,
    clearPlaylist,
    setPlaylist,
    setOnTrackEnd,
    toggleLoop,
    clearPlayCountTracking,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};