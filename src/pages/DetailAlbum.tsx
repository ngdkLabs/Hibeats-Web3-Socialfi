import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TipButton } from "@/components/TipButton";
import { TipStats } from "@/components/TipStats";
import { TipTarget } from "@/services/tipService";
import {
  Heart,
  Share2,
  Play,
  Pause,
  MoreHorizontal,
  Music,
  Calendar,
  Award,
  ChevronLeft,
  Plus
} from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Navbar from "@/components/Navbar";
import { useAudio } from "@/contexts/AudioContext";
import { useSequence } from "@/contexts/SequenceContext";
import { subgraphService } from "@/services/subgraphService";
import { profileService } from "@/services/profileService";
import { toast } from "sonner";
import { readContract } from "@wagmi/core";
import { wagmiConfig, CONTRACT_ADDRESSES } from "@/lib/web3-config";
import { SONG_NFT_ABI } from "@/lib/abis/SongNFT";
import { usePlayCounts } from "@/hooks/usePlayCounts";
import { useSongLike, useAlbumLike } from "@/hooks/useMusicInteractions";
import { useTips } from "@/hooks/useTips";
import { DollarSign } from "lucide-react";

// Interface for supporter with profile data
interface SupporterWithProfile {
  address: string;
  amount: number;
  tipCount: number;
  username?: string;
  displayName?: string;
  avatarHash?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
}

const DetailAlbum = () => {
  const { albumId } = useParams();
  const navigate = useNavigate();
  const { address } = useAccount();
  const { currentTrack, isPlaying, playTrack, pauseTrack } = useAudio();
  const { addSongToAlbum } = useSequence();
  
  const [album, setAlbum] = useState<any>(null);
  const [albumTracks, setAlbumTracks] = useState<any[]>([]);
  const [artistProfile, setArtistProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [availableSongs, setAvailableSongs] = useState<any[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [supportersWithProfiles, setSupportersWithProfiles] = useState<SupporterWithProfile[]>([]);
  const [isLoadingSupporters, setIsLoadingSupporters] = useState(false);
  
  // Use tips hook for album supporters
  const { stats: tipStats, isLoading: isLoadingTips, formatAmount } = useTips(TipTarget.ALBUM, albumId ? parseInt(albumId) : 0);
  
  // Use play counts hook
  const tokenIds = albumTracks.map(t => t.tokenId);
  const { bestSong, recordPlay, getPlayCount, isBestSong: checkIsBestSong } = usePlayCounts(tokenIds);

  // Fetch album data from subgraph
  useEffect(() => {
    const fetchAlbumData = async () => {
      if (!albumId) return;

      setIsLoading(true);
      try {
        console.log('🎵 [DetailAlbum] Fetching album data for ID:', albumId);
        console.log('🎵 [DetailAlbum] albumId type:', typeof albumId);

        // Get album from subgraph
        const albumData = await subgraphService.getAlbumById(albumId);
        
        console.log('🎵 [DetailAlbum] Album data received:', albumData);
        
        if (!albumData) {
          console.error('❌ [DetailAlbum] Album not found, redirecting to explore');
          toast.error('Album not found');
          navigate('/explore');
          return;
        }

        // 🔒 ACCESS CONTROL: Check if album is published
        const artistAddress = typeof albumData.artist === 'string' ? albumData.artist : albumData.artist.id;
        const isOwner = address && artistAddress.toLowerCase() === address.toLowerCase();
        
        if (!albumData.isPublished && !isOwner) {
          console.error('❌ [DetailAlbum] Album not published and user is not owner');
          toast.error('This album is not published yet');
          navigate('/explore');
          return;
        }

        console.log('✅ [DetailAlbum] Album data from subgraph:', albumData);
        
        // 🔥 TEMPORARY FIX: Fetch coverImageHash from blockchain if not in subgraph
        let enrichedAlbumData = albumData;
        if (!albumData.coverImageHash) {
          try {
            console.log('🔍 Fetching cover image from blockchain...');
            const { ALBUM_MANAGER_ABI } = await import('@/lib/abis/AlbumManager');
            
            const fullAlbumData = await readContract(wagmiConfig, {
              address: CONTRACT_ADDRESSES.albumManager as `0x${string}`,
              abi: ALBUM_MANAGER_ABI,
              functionName: 'getAlbum',
              args: [BigInt(albumId)],
              authorizationList: []
            }) as any;
            
            enrichedAlbumData = {
              ...albumData,
              coverImageHash: fullAlbumData.coverImageHash || '',
              description: fullAlbumData.description || albumData.description
            };
            
            console.log('✅ Cover image fetched:', fullAlbumData.coverImageHash);
          } catch (error) {
            console.error('❌ Failed to fetch cover from blockchain:', error);
          }
        }
        
        setAlbum(enrichedAlbumData);

        // Get artist profile
        const albumArtistAddress = typeof enrichedAlbumData.artist === 'string' ? enrichedAlbumData.artist : enrichedAlbumData.artist.id;
        const profile = await profileService.getProfile(albumArtistAddress.toLowerCase());
        setArtistProfile(profile);

        // Get songs from subgraph data first (more efficient)
        console.log('🎵 Processing songs from album data...');
        
        if (enrichedAlbumData.songs && enrichedAlbumData.songs.length > 0) {
          console.log('✅ Found songs in subgraph data:', enrichedAlbumData.songs.length);
          
          // Map subgraph songs to our format
          // Note: playCount and likeCount are tracked in Datastream, not subgraph
          const songsData = enrichedAlbumData.songs.map((songEntry: any) => {
            const song = songEntry.song;
            return {
              tokenId: Number(song.tokenId),
              title: song.title || 'Untitled',
              artist: song.artist || 'Unknown Artist',
              genre: song.genre || 'Unknown',
              duration: Number(song.duration) || 0,
              ipfsAudioHash: song.audioHash || '',
              ipfsArtworkHash: song.coverHash || '',
              likes: 0, // Will be loaded from Datastream via usePlayCounts hook
              plays: 0  // Will be loaded from Datastream via usePlayCounts hook
            };
          });
          
          console.log('✅ Processed songs from subgraph:', songsData);
          setAlbumTracks(songsData);
        } else {
          // Fallback: Get songs from blockchain if not in subgraph
          console.log('⚠️ No songs in subgraph, fetching from blockchain...');
          
          const { ALBUM_MANAGER_ABI } = await import('@/lib/abis/AlbumManager');
          
          const songTokenIds = await readContract(wagmiConfig, {
            address: CONTRACT_ADDRESSES.albumManager as `0x${string}`,
            abi: ALBUM_MANAGER_ABI,
            functionName: 'getAlbumSongs',
            args: [BigInt(albumId)],
            authorizationList: []
          }) as bigint[];

          console.log('📀 Song token IDs from blockchain:', songTokenIds);

          if (songTokenIds.length === 0) {
            console.log('⚠️ Album has no songs added yet');
            setAlbumTracks([]);
            return;
          }

          // Fetch metadata for each song from blockchain
          const songsData = await Promise.all(
            songTokenIds.map(async (tokenId) => {
              try {
                const metadata = await readContract(wagmiConfig, {
                  address: CONTRACT_ADDRESSES.songNFT as `0x${string}`,
                  abi: SONG_NFT_ABI,
                  functionName: 'getSongMetadata',
                  args: [tokenId],
                  authorizationList: []
                }) as any;

                return {
                  tokenId: Number(tokenId),
                  title: metadata.title || 'Untitled',
                  artist: metadata.artist || 'Unknown Artist',
                  genre: metadata.genre || 'Unknown',
                  duration: Number(metadata.duration) || 0,
                  ipfsAudioHash: metadata.ipfsAudioHash || '',
                  ipfsArtworkHash: metadata.ipfsArtworkHash || '',
                  likes: 0, // Will be loaded from Datastream via usePlayCounts hook
                  plays: 0  // Will be loaded from Datastream via usePlayCounts hook
                };
              } catch (error) {
                console.error(`❌ Failed to fetch song ${tokenId}:`, error);
                return null;
              }
            })
          );

          const validSongs = songsData.filter(song => song !== null);
          console.log('✅ Loaded songs from blockchain:', validSongs);
          setAlbumTracks(validSongs);
        }

      } catch (error) {
        console.error('❌ Error fetching album:', error);
        toast.error('Failed to load album');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbumData();
  }, [albumId, navigate]);

  // Load supporter profiles when tip stats change
  useEffect(() => {
    const loadSupporterProfiles = async () => {
      if (!tipStats.topTippers || tipStats.topTippers.length === 0) {
        setSupportersWithProfiles([]);
        return;
      }

      setIsLoadingSupporters(true);
      try {
        console.log('👥 [DetailAlbum] Loading supporter profiles...');
        
        const supportersData = await Promise.all(
          tipStats.topTippers.map(async (tipper) => {
            try {
              const profile = await profileService.getProfile(tipper.address);
              return {
                address: tipper.address,
                amount: tipper.amount,
                tipCount: tipper.tipCount,
                username: profile?.username,
                displayName: profile?.displayName,
                avatarHash: profile?.avatarHash,
                bio: profile?.bio,
                followerCount: profile?.followerCount || 0,
                followingCount: profile?.followingCount || 0,
              };
            } catch (error) {
              console.error(`Failed to load profile for ${tipper.address}:`, error);
              return {
                address: tipper.address,
                amount: tipper.amount,
                tipCount: tipper.tipCount,
              };
            }
          })
        );

        console.log('✅ [DetailAlbum] Loaded supporter profiles:', supportersData.length);
        setSupportersWithProfiles(supportersData);
      } catch (error) {
        console.error('❌ [DetailAlbum] Failed to load supporter profiles:', error);
      } finally {
        setIsLoadingSupporters(false);
      }
    };

    loadSupporterProfiles();
  }, [tipStats.topTippers]);

  // Helper functions
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getIPFSUrl = (hash: string) => {
    if (!hash) return '';
    if (hash.startsWith('http')) return hash;
    const cleanHash = hash.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${cleanHash}`;
  };

  const getAlbumTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      '0': 'Single',
      '1': 'EP',
      '2': 'Album',
      'SINGLE': 'Single',
      'EP': 'EP',
      'ALBUM': 'Album'
    };
    return types[type] || 'Album';
  };

  // Fetch user's NFT songs
  const fetchUserSongs = async () => {
    if (!address) return;

    setIsLoadingSongs(true);
    try {
      console.log('🔍 Loading your song NFTs...');
      
      const nftBalance = await readContract(wagmiConfig, {
        address: CONTRACT_ADDRESSES.songNFT as `0x${string}`,
        abi: SONG_NFT_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        authorizationList: []
      }) as bigint;

      const balance = Number(nftBalance);
      console.log('📀 You have', balance, 'song NFTs');

      if (balance === 0) {
        toast.info('You don\'t have any song NFTs yet. Create some first!');
        setAvailableSongs([]);
        return;
      }

      // Get artist's songs
      const artistSongs = await readContract(wagmiConfig, {
        address: CONTRACT_ADDRESSES.songNFT as `0x${string}`,
        abi: SONG_NFT_ABI,
        functionName: 'getArtistSongs',
        args: [address as `0x${string}`],
        authorizationList: []
      }) as bigint[];

      console.log('📀 Artist songs:', artistSongs);

      // Fetch metadata for each song
      const songs = await Promise.all(
        artistSongs.map(async (tokenId) => {
          try {
            const metadata = await readContract(wagmiConfig, {
              address: CONTRACT_ADDRESSES.songNFT as `0x${string}`,
              abi: SONG_NFT_ABI,
              functionName: 'getSongMetadata',
              args: [tokenId],
              authorizationList: []
            }) as any;

            return {
              tokenId: Number(tokenId),
              title: metadata.title || 'Untitled',
              artist: metadata.artist || 'Unknown',
              genre: metadata.genre || 'Unknown',
              duration: Number(metadata.duration) || 0
            };
          } catch (error) {
            console.error(`Failed to fetch song ${tokenId}:`, error);
            return null;
          }
        })
      );

      const validSongs = songs.filter(s => s !== null);
      
      // Filter out songs already in album
      const albumSongIds = new Set(albumTracks.map(t => t.tokenId));
      const availableSongsFiltered = validSongs.filter(s => !albumSongIds.has(s!.tokenId));
      
      setAvailableSongs(availableSongsFiltered);
      console.log('✅ Available songs to add:', availableSongsFiltered.length);
      
      if (availableSongsFiltered.length === 0) {
        toast.info('All your songs are already in this album');
      }
    } catch (error) {
      console.error('❌ Error loading songs:', error);
      toast.error('Failed to load your songs');
    } finally {
      setIsLoadingSongs(false);
    }
  };

  // Add song to album
  const handleAddSongToAlbum = async () => {
    if (!selectedSongId || !albumId) {
      toast.error('Please select a song');
      return;
    }

    setIsAddingSong(true);
    try {
      console.log('🎵 Adding song', selectedSongId, 'to album', albumId);
      
      await addSongToAlbum(Number(albumId), Number(selectedSongId));
      
      toast.success('Song added to album successfully!');
      
      // Refresh album data
      setShowAddSongModal(false);
      setSelectedSongId('');
      
      // Reload page to show new song
      window.location.reload();
      
    } catch (error) {
      console.error('❌ Error adding song:', error);
      toast.error('Failed to add song to album');
    } finally {
      setIsAddingSong(false);
    }
  };

  const handleTogglePlay = async (track: any) => {
    if (!track.ipfsAudioHash) {
      toast.error('Audio file not available');
      return;
    }

    const audioUrl = getIPFSUrl(track.ipfsAudioHash);
    const coverUrl = getIPFSUrl(track.ipfsArtworkHash) || getIPFSUrl(album?.coverImageHash);
    
    if (currentTrack?.id === track.tokenId && isPlaying) {
      pauseTrack();
    } else {
      playTrack({
        id: track.tokenId,
        title: track.title,
        artist: track.artist,
        avatar: coverUrl,
        cover: coverUrl,
        audioUrl,
        genre: track.genre,
        duration: track.duration,
        likes: track.likes
      });

      // Record play event using hook
      await recordPlay(track.tokenId, track.duration, 'album');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-16 pb-4">
          <div className="container mx-auto px-6">
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="container mx-auto px-6 py-8">
          <div className="flex gap-8">
            <Skeleton className="w-56 h-56 rounded-lg" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-16 container mx-auto px-6 py-16 text-center">
          <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-semibold mb-2">Album Not Found</h2>
          <p className="text-muted-foreground mb-4">The album you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to="/explore">Back to Explore</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Back Button */}
      <div className="pt-16 pb-4">
        <div className="container mx-auto px-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Album Header */}
      <div className="relative border-b border-border/20 overflow-hidden min-h-[400px]">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: album.coverImageHash 
              ? `url(${getIPFSUrl(album.coverImageHash)})` 
              : 'linear-gradient(135deg, hsl(var(--primary) / 0.05) 0%, hsl(var(--background)) 50%, hsl(var(--secondary) / 0.05) 100%)'
          }}
        ></div>

        {/* Background Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background/80 to-secondary/5 backdrop-blur-sm"></div>

        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 to-transparent"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-secondary/10 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative container mx-auto px-6 py-8 min-h-[400px] flex items-center">
          <div className="flex flex-col md:flex-row gap-8 items-start w-full">
            {/* Album Cover */}
            <div className="relative">
              <div className="w-48 h-48 md:w-56 md:h-56 rounded-lg overflow-hidden ring-4 ring-background/50 shadow-2xl bg-muted">
                {album.coverImageHash ? (
                  <img
                    src={getIPFSUrl(album.coverImageHash)}
                    alt={album.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-16 h-16 text-muted-foreground/20" />
                  </div>
                )}
              </div>
            </div>

            {/* Album Info */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="font-clash font-semibold text-3xl md:text-4xl text-foreground">{album.title}</h1>
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                    {getAlbumTypeLabel(album.albumType)}
                  </Badge>
                  {!album.isPublished && (
                    <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      Unpublished
                    </Badge>
                  )}
                </div>
                <Link 
                  to={`/profile/${artistProfile?.username || album.artist.username || album.artist.id}`}
                  className="text-muted-foreground text-lg hover:text-primary transition-colors"
                >
                  by {artistProfile?.displayName || album.artist.displayName || album.artist.username || `${album.artist.id.slice(0, 6)}...${album.artist.id.slice(-4)}`}
                </Link>
              </div>

              {/* Album Stats */}
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <p className="font-semibold text-xl text-foreground">{albumTracks.length}</p>
                  <p className="text-muted-foreground">Tracks</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-xl text-foreground">
                    {formatDuration(albumTracks.reduce((sum, track) => sum + track.duration, 0))}
                  </p>
                  <p className="text-muted-foreground">Duration</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-xl text-foreground">
                    {formatNumber(albumTracks.reduce((sum, track) => sum + getPlayCount(track.tokenId), 0))}
                  </p>
                  <p className="text-muted-foreground">Plays</p>
                </div>
              </div>

              {/* Album Description */}
              <div className="space-y-2">
                {album.description && (
                  <p className="text-sm leading-relaxed max-w-2xl text-muted-foreground">{album.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {album.createdAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(Number(album.createdAt) * 1000).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Music className="w-4 h-4" />
                    {getAlbumTypeLabel(album.albumType)}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {/* Show Add Songs button if user is the album owner and album has no songs */}
                {address && (typeof album.artist === 'string' ? album.artist : album.artist.id).toLowerCase() === address.toLowerCase() && (
                  <>
                    {/* Show Add Song button based on album type limits */}
                    {(() => {
                      const albumType = album.albumType;
                      const currentSongCount = albumTracks.length;
                      
                      // Single: max 1 song
                      // EP: max 6 songs
                      // Album: unlimited (or max 20)
                      const maxSongs = albumType === 'SINGLE' || albumType === '0' ? 1 
                                     : albumType === 'EP' || albumType === '1' ? 6 
                                     : 20; // Album
                      
                      const canAddMore = currentSongCount < maxSongs;
                      
                      return canAddMore ? (
                        <Button
                          onClick={() => {
                            setShowAddSongModal(true);
                            fetchUserSongs();
                          }}
                          className="px-8 shadow-lg bg-primary hover:bg-primary/90 shadow-primary/25"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Song
                        </Button>
                      ) : (
                        <Button
                          disabled
                          className="px-8 shadow-lg"
                          title={`${getAlbumTypeLabel(albumType)} is full (${currentSongCount}/${maxSongs} songs)`}
                        >
                          <Music className="w-4 h-4 mr-2" />
                          Album Full
                        </Button>
                      );
                    })()}
                  </>
                )}
                <Button
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`px-8 shadow-lg ${isFollowing ? 'bg-muted text-muted-foreground hover:bg-muted' : 'bg-primary hover:bg-primary/90 shadow-primary/25'}`}
                >
                  {isFollowing ? 'Following' : 'Follow Album'}
                </Button>
                <LikeAlbumButton albumId={parseInt(albumId!)} />
                <Button variant="outline" size="sm" className="border-border/50 hover:bg-muted/50">
                  <Share2 className="w-4 h-4" />
                </Button>
                {/* Support Album Button */}
                {album && album.artist.id !== address?.toLowerCase() && (
                  <TipButton
                    targetType={TipTarget.ALBUM}
                    targetId={parseInt(albumId!)}
                    recipientAddress={album.artist.id}
                    recipientName={artistProfile?.displayName || album.artist.displayName || album.artist.username}
                    recipientAvatar={artistProfile?.avatarHash}
                    targetTitle={album.title}
                    variant="outline"
                    size="sm"
                    showIcon={true}
                    showText={true}
                    className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Side - Tracks List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-clash font-semibold text-2xl">Tracks</h2>
              {albumTracks.length > 0 && (
                <Badge variant="outline" className="text-sm">
                  {albumTracks.length} tracks • {formatDuration(albumTracks.reduce((sum, track) => sum + track.duration, 0))}
                </Badge>
              )}
            </div>

            {/* Best Song Badge */}
            {bestSong && albumTracks.length > 1 && (
              <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">🏆 Best Song in Album</h3>
                    <p className="text-xs text-muted-foreground">
                      {albumTracks.find(t => t.tokenId === bestSong.tokenId)?.title || 'Unknown'} • {bestSong.playCount} plays
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Track List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
              {albumTracks.length > 0 ? (
                albumTracks.map((track, index) => {
                  console.log('🎵 Rendering track:', track);
                  const trackPlayCount = getPlayCount(track.tokenId);
                  const isBestSong = checkIsBestSong(track.tokenId) && albumTracks.length > 1;
                  return (
                  <div
                    key={track.tokenId}
                    className={`group flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors duration-200 cursor-pointer border ${
                      isBestSong 
                        ? 'border-primary/30 bg-primary/5' 
                        : 'border-transparent hover:border-border/50'
                    }`}
                  >
                    {/* Track Number */}
                    <div className="w-8 h-8 flex items-center justify-center text-sm font-medium text-muted-foreground group-hover:text-foreground">
                      {isBestSong ? <Award className="w-4 h-4 text-primary" /> : index + 1}
                    </div>

                    {/* Track Cover with Play Button Overlay */}
                    <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                      {/* Cover Image */}
                      {track.ipfsArtworkHash ? (
                        <img
                          src={getIPFSUrl(track.ipfsArtworkHash)}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      ) : album.coverImageHash ? (
                        <img
                          src={getIPFSUrl(album.coverImageHash)}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Music className="w-5 h-5 text-muted-foreground/30" />
                        </div>
                      )}
                      
                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-8 h-8 p-0 text-white hover:bg-white/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePlay(track);
                          }}
                        >
                          {currentTrack?.id === track.tokenId && isPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm truncate">{track.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {track.genre}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatDuration(track.duration)}</span>
                        <span className="flex items-center gap-1">
                          <Play className="w-3 h-3" />
                          {formatNumber(trackPlayCount)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {formatNumber(track.likes)}
                        </span>
                        {isBestSong && (
                          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                            Best Song
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <LikeSongButton songId={track.tokenId} />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
                })
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Music className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-semibold mb-2">No tracks yet</p>
                  <p className="text-sm">This album doesn't have any tracks added yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Album Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Buy Album - COMING SOON (Hidden for now) */}
            {/* 
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-primary mb-1">2.5 ETH</p>
                    <p className="text-sm text-muted-foreground">Complete Album</p>
                  </div>
                  <Button className="w-full gap-2 bg-primary hover:bg-primary/90" size="lg">
                    <ShoppingCart className="w-4 h-4" />
                    Buy Album
                  </Button>
                  <div className="text-center text-xs text-muted-foreground">
                    Includes all 8 tracks in high-quality WAV format
                  </div>
                </div>
              </CardContent>
            </Card>
            */}

            {/* Album Details */}
            <Card className="border-border/50">
              <CardContent className="p-6">
                <h3 className="font-clash font-semibold text-lg mb-4">Album Details</h3>
                <div className="space-y-3">
                  {album.createdAt && (
                    <div className="flex justify-between items-center py-2 border-b border-border/20">
                      <span className="text-sm text-muted-foreground">Release date</span>
                      <span className="text-sm font-medium">
                        {new Date(Number(album.createdAt) * 1000).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-b border-border/20">
                    <span className="text-sm text-muted-foreground">Album Type</span>
                    <span className="text-sm font-medium">{getAlbumTypeLabel(album.albumType)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/20">
                    <span className="text-sm text-muted-foreground">Total Tracks</span>
                    <span className="text-sm font-medium">{albumTracks.length}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Total Duration</span>
                    <span className="text-sm font-medium">
                      {formatDuration(albumTracks.reduce((sum, track) => sum + track.duration, 0))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Album Support Stats */}
            {album && (
              <TipStats
                targetType={TipTarget.ALBUM}
                targetId={parseInt(albumId!)}
                compact={false}
              />
            )}

            {/* Supporters - Real Data */}
            <Card className="border-border/50">
              <CardContent className="p-6">
                <h3 className="font-clash font-semibold text-lg mb-4">Supporters</h3>
                
                {/* Loading State */}
                {(isLoadingTips || isLoadingSupporters) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="w-12 h-12 rounded-full" />
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {!isLoadingTips && !isLoadingSupporters && supportersWithProfiles.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No supporters yet</p>
                    <p className="text-xs">Be the first to support this album!</p>
                  </div>
                )}

                {/* Supporters List */}
                {!isLoadingTips && !isLoadingSupporters && supportersWithProfiles.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {supportersWithProfiles.map((supporter, index) => {
                      const displayName = supporter.displayName || supporter.username || `${supporter.address.slice(0, 6)}...${supporter.address.slice(-4)}`;
                      const avatarInitials = supporter.displayName 
                        ? supporter.displayName.slice(0, 2).toUpperCase()
                        : supporter.address.slice(2, 4).toUpperCase();
                      const avatarUrl = supporter.avatarHash 
                        ? `https://ipfs.io/ipfs/${supporter.avatarHash.replace('ipfs://', '')}`
                        : '';
                      
                      return (
                        <div key={supporter.address} className="relative group">
                          {/* Profile Preview Card */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                            <Card className="w-64 border-border/50 shadow-xl bg-background/95 backdrop-blur-sm">
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <Avatar className="w-12 h-12 ring-2 ring-primary/20">
                                    <AvatarImage src={avatarUrl} />
                                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-primary font-semibold text-sm">
                                      {avatarInitials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-semibold text-sm truncate">{displayName}</h4>
                                      {index < 3 && (
                                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                          Top {index + 1}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                      {supporter.bio || 'No bio available'}
                                    </p>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                                      <span>{formatNumber(supporter.followerCount || 0)} followers</span>
                                      <span>{formatNumber(supporter.followingCount || 0)} following</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-green-500 mb-3">
                                      <DollarSign className="w-3 h-3" />
                                      <span>Supported {formatAmount(supporter.amount)}</span>
                                      <span className="text-muted-foreground">({supporter.tipCount} tips)</span>
                                    </div>
                                    <Link to={`/profile/${supporter.username || supporter.address}`}>
                                      <Button size="sm" className="w-full text-xs h-7">
                                        View Profile
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            {/* Arrow pointer */}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-background/95"></div>
                          </div>

                          {/* Avatar */}
                          <Link to={`/profile/${supporter.username || supporter.address}`}>
                            <div className="flex flex-col items-center gap-2 group/avatar">
                              <div className="relative">
                                <Avatar className="w-12 h-12 ring-2 ring-primary/20 hover:ring-primary/40 transition-all duration-200 group-hover:scale-105">
                                  <AvatarImage src={avatarUrl} />
                                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-primary font-semibold text-sm hover:from-primary/30 hover:to-secondary/30 transition-all duration-200">
                                    {avatarInitials}
                                  </AvatarFallback>
                                </Avatar>
                                {index < 3 && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg">
                                    <span className="text-xs font-semibold text-primary-foreground">{index + 1}</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-center opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200">
                                <p className="text-xs font-medium truncate max-w-[60px]">{displayName}</p>
                                <p className="text-xs text-green-500">{formatAmount(supporter.amount)}</p>
                              </div>
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tags - Generated from song genres */}
            <Card className="border-border/50">
              <CardContent className="p-6">
                <h3 className="font-clash font-semibold text-lg mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {/* Generate unique tags from album tracks genres */}
                  {(() => {
                    // Collect unique genres from all tracks
                    const genres = new Set<string>();
                    albumTracks.forEach(track => {
                      if (track.genre && track.genre !== 'Unknown') {
                        // Split genre if it contains multiple (e.g., "Electronic, Ambient")
                        const genreParts = track.genre.split(/[,\/\s]+/).filter((g: string) => g.trim().length > 0);
                        genreParts.forEach((g: string) => genres.add(g.trim().toLowerCase()));
                      }
                    });
                    
                    // Add album type as tag
                    const albumTypeLabel = getAlbumTypeLabel(album.albumType);
                    if (albumTypeLabel) {
                      genres.add(albumTypeLabel.toLowerCase());
                    }
                    
                    // Convert to array and limit to 8 tags
                    const tagsArray = Array.from(genres).slice(0, 8);
                    
                    // If no tags found, show default message
                    if (tagsArray.length === 0) {
                      return (
                        <span className="text-sm text-muted-foreground">No tags available</span>
                      );
                    }
                    
                    return tagsArray.map((tag, index) => (
                      <Badge 
                        key={index}
                        variant="secondary" 
                        className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        #{tag}
                      </Badge>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Song Modal */}
      <Dialog open={showAddSongModal} onOpenChange={setShowAddSongModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Song to Album</DialogTitle>
            <DialogDescription>
              Select a song from your NFT collection to add to this album.
              {album && (() => {
                const albumType = album.albumType;
                const currentSongCount = albumTracks.length;
                const maxSongs = albumType === 'SINGLE' || albumType === '0' ? 1 
                               : albumType === 'EP' || albumType === '1' ? 6 
                               : 20;
                return (
                  <span className="block mt-1 text-xs">
                    Current: {currentSongCount}/{maxSongs} songs ({getAlbumTypeLabel(albumType)})
                  </span>
                );
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoadingSongs ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : availableSongs.length > 0 ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="song-select">Select Song</Label>
                  <Select value={selectedSongId} onValueChange={setSelectedSongId}>
                    <SelectTrigger id="song-select">
                      <SelectValue placeholder="Choose a song..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSongs.map((song) => (
                        <SelectItem key={song.tokenId} value={song.tokenId.toString()}>
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4" />
                            <span className="font-medium">{song.title}</span>
                            <span className="text-muted-foreground text-sm">• {song.artist}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleAddSongToAlbum}
                    disabled={!selectedSongId || isAddingSong}
                    className="flex-1"
                  >
                    {isAddingSong ? 'Adding...' : 'Add to Album'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddSongModal(false)}
                    disabled={isAddingSong}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Music className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-semibold mb-2">No songs available</p>
                <p className="text-sm mb-4">
                  {albumTracks.length > 0 
                    ? 'All your songs are already in this album'
                    : 'You don\'t have any song NFTs yet'}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddSongModal(false);
                    navigate('/my-collection');
                  }}
                >
                  Go to My Collection
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Like Song Button Component with Twitter-style animation
function LikeSongButton({ songId }: { songId: number }) {
  const { isLiked, toggleLike } = useSongLike(songId);
  const [isAnimating, setIsAnimating] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Trigger animation only when liking (not unliking)
    if (!isLiked) {
      setIsAnimating(true);
      
      // Create particle burst effect (Twitter-style)
      if (buttonRef.current) {
        const button = buttonRef.current;
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Create 6 particles
        for (let i = 0; i < 6; i++) {
          const particle = document.createElement('div');
          particle.className = 'heart-particle';
          particle.innerHTML = '❤️';
          particle.style.cssText = `
            position: fixed;
            left: ${centerX}px;
            top: ${centerY}px;
            font-size: 12px;
            z-index: 9999;
            --tx: ${Math.cos((i * 60) * Math.PI / 180) * 40}px;
            --ty: ${Math.sin((i * 60) * Math.PI / 180) * 40}px;
          `;
          document.body.appendChild(particle);
          
          // Remove particle after animation
          setTimeout(() => {
            particle.remove();
          }, 600);
        }
      }
      
      // Reset animation state
      setTimeout(() => {
        setIsAnimating(false);
      }, 400);
    }
    
    await toggleLike();
  };

  return (
    <Button
      ref={buttonRef}
      size="sm"
      variant="ghost"
      className={`w-8 h-8 p-0 transition-all duration-200 ${isLiked ? 'text-red-500 opacity-100' : 'opacity-0 group-hover:opacity-100'} hover:bg-red-500/10`}
      onClick={handleLike}
    >
      <Heart 
        className={`w-4 h-4 transition-all duration-200 ${
          isLiked ? 'fill-current' : ''
        } ${isAnimating ? 'heart-burst' : isLiked ? 'heart-pop' : ''}`}
      />
    </Button>
  );
}

// Like Album Button Component with Twitter-style animation
function LikeAlbumButton({ albumId }: { albumId: number }) {
  const { isLiked, likeCount, toggleLike } = useAlbumLike(albumId);
  const [isAnimating, setIsAnimating] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleLike = async () => {
    // Trigger animation only when liking (not unliking)
    if (!isLiked) {
      setIsAnimating(true);
      
      // Create particle burst effect (Twitter-style)
      if (buttonRef.current) {
        const button = buttonRef.current;
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Create 6 particles
        for (let i = 0; i < 6; i++) {
          const particle = document.createElement('div');
          particle.className = 'heart-particle';
          particle.innerHTML = '❤️';
          particle.style.cssText = `
            position: fixed;
            left: ${centerX}px;
            top: ${centerY}px;
            font-size: 12px;
            z-index: 9999;
            --tx: ${Math.cos((i * 60) * Math.PI / 180) * 40}px;
            --ty: ${Math.sin((i * 60) * Math.PI / 180) * 40}px;
          `;
          document.body.appendChild(particle);
          
          // Remove particle after animation
          setTimeout(() => {
            particle.remove();
          }, 600);
        }
      }
      
      // Reset animation state
      setTimeout(() => {
        setIsAnimating(false);
      }, 400);
    }
    
    await toggleLike();
  };

  return (
    <Button 
      ref={buttonRef}
      variant="outline" 
      size="sm" 
      className={`gap-2 border-border/50 hover:bg-muted/50 transition-all duration-200 ${isLiked ? 'text-red-500' : ''} hover:bg-red-500/10`}
      onClick={handleLike}
    >
      <Heart 
        className={`w-4 h-4 transition-all duration-200 ${
          isLiked ? 'fill-current' : ''
        } ${isAnimating ? 'heart-burst' : isLiked ? 'heart-pop' : ''}`}
      />
      <span className="text-xs transition-all duration-200">{likeCount > 0 ? likeCount : 'Like'}</span>
    </Button>
  );
}

export default DetailAlbum;