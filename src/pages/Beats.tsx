import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  Heart,
  Share2,
  Music,
  Clock,
  Star,
  Calendar,
  Loader2
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import { useAudio } from "@/contexts/AudioContext";
import { useAccount } from "wagmi";
import { recordMusicPlay } from "@/utils/playCountHelper";
import { useAlbums } from "@/hooks/useAlbums";
import hibeatsLogo from "@/assets/hibeats.png";

// Helper function to extract main genre from genre string
const extractMainGenre = (genreString: string): string => {
  if (!genreString || genreString === 'Unknown') return 'Unknown';
  
  // Common music genres to look for
  const knownGenres = [
    'Pop', 'Rock', 'Jazz', 'Metal', 'Hip Hop', 'Hip-Hop', 'R&B', 'RnB',
    'Electronic', 'Dance', 'Classical', 'Country', 'Blues', 'Reggae',
    'Folk', 'Soul', 'Funk', 'Disco', 'House', 'Techno', 'Ambient',
    'Indie', 'Alternative', 'Punk', 'Grunge', 'Gospel', 'Latin',
    'K-Pop', 'J-Pop', 'Trap', 'Dubstep', 'EDM', 'Acoustic', 'Ballad'
  ];
  
  // Split by comma and take genres only
  const parts = genreString.split(',').map(p => p.trim());
  
  // Find first known genre
  for (const part of parts) {
    const found = knownGenres.find(g => 
      part.toLowerCase().includes(g.toLowerCase())
    );
    if (found) return found;
  }
  
  // If no known genre found, take first word that looks like a genre (capitalized)
  for (const part of parts) {
    const words = part.split(' ').filter(w => w.length > 0);
    for (const word of words) {
      if (word.length > 2 && word[0] && word[0] === word[0].toUpperCase()) {
        return word;
      }
    }
  }
  
  // Fallback: take first part before comma or first word
  const firstPart = parts[0];
  if (firstPart) {
    const firstWord = firstPart.split(' ')[0];
    return firstWord || 'Unknown';
  }
  return 'Unknown';
};

const Beats = () => {
  const { currentTrack, isPlaying, playTrack, pauseTrack } = useAudio();
  const { address } = useAccount();
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const { albums, isLoading, error } = useAlbums(50);

  // Convert albums to beats format and sort by creation date (newest first)
  const releasedBeats = useMemo(() => {
    if (!albums || albums.length === 0) return [];
    
    return albums
      .sort((a, b) => parseInt(b.createdAt) - parseInt(a.createdAt))
      .flatMap((album, albumIndex) => 
        album.songs.map((songWrapper, songIndex) => {
          const song = songWrapper.song;
          const rawGenre = song.genre || 'Unknown';
          const mainGenre = extractMainGenre(rawGenre);
          const genreTag = mainGenre.toLowerCase().replace(/\s+/g, '-');
          
          return {
            id: parseInt(song.id) || (albumIndex * 1000 + songIndex),
            songId: song.id,
            title: song.title,
            artist: album.artist.displayName || album.artist.username,
            avatar: album.artist.avatarHash 
              ? `https://gateway.pinata.cloud/ipfs/${album.artist.avatarHash}`
              : undefined,
            avatarFallback: album.artist.displayName?.substring(0, 2).toUpperCase() || 
                           album.artist.username?.substring(0, 2).toUpperCase() || 'UN',
            cover: album.coverImageHash 
              ? `https://gateway.pinata.cloud/ipfs/${album.coverImageHash}`
              : hibeatsLogo,
            genre: mainGenre,
            fullGenre: rawGenre,
            releaseDate: new Date(parseInt(album.createdAt) * 1000).toISOString(),
            duration: song.duration || '0:00',
            audioHash: song.audioHash || '',
            likes: 0,
            plays: 0,
            tags: [genreTag],
            description: album.description || `${album.albumType} by ${album.artist.displayName || album.artist.username}`,
            albumId: album.albumId,
            albumType: album.albumType
          };
        })
      );
  }, [albums]);

  // Get unique genres from real data
  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    releasedBeats.forEach(beat => {
      beat.tags.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return counts;
  }, [releasedBeats]);

  const tags = useMemo(() => {
    const uniqueTags = [
      { id: "all", name: "All Beats", count: releasedBeats.length, icon: Music }
    ];
    
    Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .forEach(([tag, count]) => {
        const displayName = tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        uniqueTags.push({
          id: tag,
          name: count > 1 ? `${displayName}+` : displayName,
          count,
          icon: Music
        });
      });
    
    return uniqueTags;
  }, [releasedBeats, genreCounts]);

  const filteredBeats = useMemo(() => {
    return releasedBeats.filter(beat => {
      const matchesTag = selectedTag === "all" || beat.tags.includes(selectedTag);
      return matchesTag;
    });
  }, [releasedBeats, selectedTag]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Main Content */}
      <main className="pt-16">
        <div className="container mx-auto px-6 py-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-clash font-semibold text-3xl mb-1">Recently Released</h1>
            <p className="text-muted-foreground text-base">Fresh tracks from the HiBeats community</p>
            <p className="text-muted-foreground text-sm mt-1 italic">Marketplace coming soon</p>
          </div>

          {/* Categories */}
          <div className="mb-8">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {tags.map((tag) => {
                const IconComponent = tag.icon;
                return (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTag(tag.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                      selectedTag === tag.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="text-sm font-medium">{tag.name}</span>
                    <Badge 
                      variant={selectedTag === tag.id ? "secondary" : "outline"} 
                      className={`text-xs ml-1 ${selectedTag === tag.id ? 'bg-muted' : ''}`}
                    >
                      {tag.count}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading tracks...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Failed to load tracks</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          )}

          {/* Beats List */}
          {!isLoading && !error && (
            <div className="space-y-6">
              {filteredBeats.map((beat) => (
                <Card key={beat.id} className="group hover:shadow-lg transition-all duration-300 border-border/20 bg-card/50 backdrop-blur-sm overflow-hidden rounded-2xl">
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Album Cover */}
                      <div className="relative w-40 h-40 flex-shrink-0 rounded-l-2xl overflow-hidden">
                        <img
                          src={beat.cover}
                          alt={beat.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <Button
                            size="lg"
                            className="rounded-full w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm border-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (currentTrack?.id === beat.id && isPlaying) {
                                pauseTrack();
                              } else {
                                const trackData: any = {
                                  id: beat.id,
                                  title: beat.title,
                                  artist: beat.artist,
                                  avatar: beat.avatar || '',
                                  cover: beat.cover,
                                  genre: beat.genre,
                                  audioHash: beat.audioHash,
                                  duration: beat.duration,
                                  likes: beat.likes
                                };
                                playTrack(trackData);
                                // Record play event
                                const duration = typeof beat.duration === 'string' 
                                  ? parseInt(beat.duration.split(':')[0]) * 60 + parseInt(beat.duration.split(':')[1] || '0')
                                  : 180;
                                void recordMusicPlay(trackData, address, duration, 'beats');
                              }
                            }}
                          >
                            {currentTrack?.id === beat.id && isPlaying ? (
                              <Pause className="w-5 h-5 text-white" />
                            ) : (
                              <Play className="w-5 h-5 text-white ml-0.5" />
                            )}
                          </Button>
                        </div>
                        <Badge className="absolute top-3 left-3 bg-transparent border-white/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                          <Star className="w-3 h-3 mr-1" />
                          {beat.albumType}
                        </Badge>
                      </div>

                      {/* Beat Details */}
                      <div className="flex-1 p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={beat.avatar} />
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                                  {beat.avatarFallback}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <Link to={`/album/${beat.albumId}`}>
                                  <h3 className="font-semibold text-lg mb-1 hover:text-primary transition-colors">{beat.title}</h3>
                                </Link>
                                <p className="text-muted-foreground text-sm">{beat.artist}</p>
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {beat.description}
                            </p>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(beat.releaseDate)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {beat.duration}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-3">
                              <Badge variant="secondary" className="text-xs rounded-full px-2 py-0.5 bg-muted/50">
                                {beat.fullGenre}
                              </Badge>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-medium text-muted-foreground mb-1">
                              Coming Soon
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground h-8 px-2">
                              <Heart className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground h-8 px-2">
                              <Share2 className="w-3 h-3" />
                            </Button>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="gap-1 rounded-full h-8 px-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (currentTrack?.id === beat.id && isPlaying) {
                                  pauseTrack();
                                } else {
                                  const trackData: any = {
                                    id: beat.id,
                                    title: beat.title,
                                    artist: beat.artist,
                                    avatar: beat.avatar || '',
                                    cover: beat.cover,
                                    genre: beat.genre,
                                    audioHash: beat.audioHash,
                                    duration: beat.duration,
                                    likes: beat.likes
                                  };
                                  playTrack(trackData);
                                  // Record play event
                                  const duration = typeof beat.duration === 'string' 
                                    ? parseInt(beat.duration.split(':')[0]) * 60 + parseInt(beat.duration.split(':')[1] || '0')
                                    : 180;
                                  void recordMusicPlay(trackData, address, duration, 'beats');
                                }
                              }}
                            >
                              {currentTrack?.id === beat.id && isPlaying ? (
                                <Pause className="w-3 h-3" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                              Play
                            </Button>
                            <Link to={`/album/${beat.albumId}`}>
                              <Button size="sm" variant="outline" className="gap-1 rounded-full h-8 px-3">
                                View Album
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredBeats.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No tracks found</h3>
                  <p className="text-muted-foreground">Try selecting a different genre or check back later for new releases</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Beats;