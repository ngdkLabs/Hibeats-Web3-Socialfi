import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  Pause,
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  Music,
  Clock,
  Flame,
  Crown,
  Medal,
  Award,
  MoreHorizontal
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useAudio } from "@/contexts/AudioContext";
import { useTrendingMusic } from "@/hooks/useTrendingMusic";
import { usePlayCounts } from "@/hooks/usePlayCounts";
import { profileService } from "@/services/profileService";
import { recordMusicPlay } from "@/utils/playCountHelper";
import { useAccount } from "wagmi";

interface ArtistProfile {
  username?: string;
  displayName?: string;
  avatarHash?: string;
  isVerified?: boolean;
}

const Trending100 = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { currentTrack, isPlaying, playTrack, pauseTrack } = useAudio();
  
  // Load trending music (100 songs)
  const { trendingTracks, isLoading, error } = useTrendingMusic(100);
  
  // Get play counts for all tracks
  const tokenIds = trendingTracks.map(t => t.tokenId);
  const { getPlayCount } = usePlayCounts(tokenIds);
  
  // Artist profiles cache
  const [artistProfiles, setArtistProfiles] = useState<Record<string, ArtistProfile>>({});

  // Sort tracks by play count
  const sortedTracks = [...trendingTracks].sort((a, b) => {
    const playsA = getPlayCount(a.tokenId);
    const playsB = getPlayCount(b.tokenId);
    return playsB - playsA;
  });

  // Load artist profiles
  useEffect(() => {
    const loadProfiles = async () => {
      if (trendingTracks.length === 0) return;
      
      const profiles: Record<string, ArtistProfile> = {};
      
      // Get unique artist addresses
      const uniqueArtists = [...new Set(trendingTracks.map(t => t.artist?.toLowerCase()).filter(Boolean))];
      
      await Promise.all(
        uniqueArtists.slice(0, 50).map(async (artistAddr) => {
          try {
            const profile = await profileService.getProfile(artistAddr!);
            if (profile) {
              profiles[artistAddr!] = {
                username: profile.username,
                displayName: profile.displayName,
                avatarHash: profile.avatarHash,
                isVerified: profile.isVerified,
              };
            }
          } catch (e) {
            // Ignore errors
          }
        })
      );
      
      setArtistProfiles(profiles);
    };
    
    loadProfiles();
  }, [trendingTracks]);

  // Helper functions
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getIPFSUrl = (hash: string | undefined) => {
    if (!hash) return '';
    if (hash.startsWith('http')) return hash;
    return `https://ipfs.io/ipfs/${hash.replace('ipfs://', '')}`;
  };

  const getArtistName = (track: any): string => {
    const artistAddr = track.artist?.toLowerCase();
    if (!artistAddr) return 'Unknown Artist';
    const profile = artistProfiles[artistAddr];
    return profile?.displayName || profile?.username || `${track.artist.slice(0, 6)}...${track.artist.slice(-4)}`;
  };

  const handlePlay = async (track: any) => {
    if (currentTrack?.id === track.tokenId && isPlaying) {
      pauseTrack();
    } else {
      const coverUrl = getIPFSUrl(track.coverHash || track.ipfsArtworkHash || '');
      const audioUrl = getIPFSUrl(track.audioHash || track.ipfsAudioHash || '');
      
      playTrack({
        id: track.tokenId,
        title: track.title || 'Unknown',
        artist: getArtistName(track),
        avatar: coverUrl,
        cover: coverUrl,
        audioUrl,
        genre: track.genre || 'Unknown',
        duration: track.duration || 0,
        likes: 0
      });
      
      // Record play
      await recordMusicPlay(track, address || '', track.duration || 180, 'explore');
    }
  };

  // Get rank change indicator (mock for now - could be based on previous day's ranking)
  const getRankChange = (index: number) => {
    // Random for demo - in production, compare with previous ranking
    const changes = ['up', 'down', 'same', 'new'];
    if (index < 3) return 'same'; // Top 3 usually stable
    if (index > 90) return 'new'; // New entries
    return changes[Math.floor(Math.random() * 3)];
  };

  const RankBadge = ({ rank }: { rank: number }) => {
    if (rank === 1) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
          <Crown className="w-5 h-5 text-white" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-lg shadow-gray-400/30">
          <Medal className="w-5 h-5 text-white" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-600/30">
          <Award className="w-5 h-5 text-white" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
        <span className="text-lg font-semibold text-muted-foreground">{rank}</span>
      </div>
    );
  };

  const RankChangeIndicator = ({ change }: { change: string | undefined }) => {
    if (change === 'up') {
      return <TrendingUp className="w-3 h-3 text-green-500" />;
    }
    if (change === 'down') {
      return <TrendingDown className="w-3 h-3 text-red-500" />;
    }
    if (change === 'new') {
      return <Badge className="text-[10px] px-1 py-0 h-4 bg-primary/20 text-primary border-0">NEW</Badge>;
    }
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Header */}
      <div className="pt-16">
        <div className="relative overflow-hidden">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />
          
          <div className="relative container mx-auto px-4 py-8">
            {/* Back Button */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)} 
              className="mb-6 gap-2 hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            
            {/* Title Section */}
            <div className="flex items-center gap-4 mb-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-xl shadow-primary/30">
                <Flame className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="font-clash font-bold text-4xl md:text-5xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  Top 100
                </h1>
                <p className="text-muted-foreground text-lg">HiBeats Charts</p>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex items-center gap-6 mt-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4" />
                <span>{sortedTracks.length} songs</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Updated hourly</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span>Live rankings</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-32">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-card/50">
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="w-14 h-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="w-16 h-4" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-8 text-center">
              <Music className="w-12 h-12 mx-auto mb-4 text-destructive/50" />
              <p className="text-destructive">Failed to load trending songs</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && sortedTracks.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="p-12 text-center">
              <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-xl font-semibold mb-2">No trending songs yet</h3>
              <p className="text-muted-foreground">Be the first to create and share music!</p>
            </CardContent>
          </Card>
        )}

        {/* Songs List - iOS Style */}
        {!isLoading && !error && sortedTracks.length > 0 && (
          <div className="space-y-1">
            {sortedTracks.map((track, index) => {
              const rank = index + 1;
              const plays = getPlayCount(track.tokenId);
              const isCurrentlyPlaying = currentTrack?.id === track.tokenId && isPlaying;
              const coverUrl = getIPFSUrl((track as any).coverHash || (track as any).ipfsArtworkHash || '');
              const artistName = getArtistName(track);
              const rankChange = getRankChange(index);
              
              return (
                <div
                  key={track.tokenId || index}
                  className={`
                    group flex items-center gap-3 p-3 rounded-2xl transition-all duration-200
                    ${isCurrentlyPlaying ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'}
                    ${rank <= 3 ? 'bg-gradient-to-r from-muted/30 to-transparent' : ''}
                  `}
                >
                  {/* Rank */}
                  <div className="flex items-center gap-1 w-14">
                    <RankBadge rank={rank} />
                    <div className="w-4 flex justify-center">
                      <RankChangeIndicator change={rankChange} />
                    </div>
                  </div>

                  {/* Cover & Play Button */}
                  <div className="relative">
                    <div className={`
                      w-14 h-14 rounded-xl overflow-hidden bg-muted shadow-sm
                      ${rank <= 3 ? 'ring-2 ring-primary/30' : ''}
                    `}>
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={track.title || 'Track cover'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    
                    {/* Play Overlay */}
                    <button
                      onClick={() => handlePlay(track)}
                      className={`
                        absolute inset-0 flex items-center justify-center rounded-xl
                        bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity
                        ${isCurrentlyPlaying ? 'opacity-100' : ''}
                      `}
                    >
                      {isCurrentlyPlaying ? (
                        <Pause className="w-6 h-6 text-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Song Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`
                      font-medium truncate
                      ${rank <= 3 ? 'text-base' : 'text-sm'}
                      ${isCurrentlyPlaying ? 'text-primary' : ''}
                    `}>
                      {track.title || 'Unknown Track'}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {artistName}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1 min-w-[60px] justify-end">
                      <Play className="w-3 h-3" />
                      <span>{formatNumber(plays)}</span>
                    </div>
                    <div className="min-w-[40px] text-right">
                      {formatDuration(track.duration || 0)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full">
                      <Heart className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Stats */}
        {!isLoading && sortedTracks.length > 0 && (
          <div className="mt-8 pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
            <p>Rankings based on play counts from the HiBeats community</p>
            <p className="mt-1">Last updated: {new Date().toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Trending100;
