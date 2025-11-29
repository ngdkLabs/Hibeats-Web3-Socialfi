import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Play, Users, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { useAudio } from "@/contexts/AudioContext";
import album1 from "@/assets/album-1.jpg";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { profileService } from "@/services/profileService";
import { readContract } from '@wagmi/core';
import { wagmiConfig, CONTRACT_ADDRESSES } from '@/lib/web3-config';
import { USER_PROFILE_ABI } from '@/lib/abis/UserProfile';
import { useSequence } from "@/contexts/SequenceContext";
import { subgraphService } from "@/services/subgraphService";

interface ArtistData {
  address: string;
  username: string;
  displayName: string;
  bio: string;
  avatarHash: string;
  isVerified: boolean;
  isArtist: boolean;
  followerCount: number;
  followingCount: number;
}

const FeaturedArtists = () => {
  const { playTrack, setPlaylist } = useAudio();
  const { address } = useAccount();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingArtists, setFollowingArtists] = useState<Set<string>>(new Set());
  
  // 🔥 Follow functionality (same as UserProfile)
  const { followUser, unfollowUser, smartAccountAddress } = useSequence();
  
  // Track recent follow/unfollow actions to prevent auto-refresh from reverting optimistic updates
  const [recentActions, setRecentActions] = useState<Set<string>>(new Set());

  // Load verified artists from blockchain
  useEffect(() => {
    const loadVerifiedArtists = async () => {
      try {
        setLoading(true);
        console.log('🎨 [FeaturedArtists] Loading verified artists...');
        
        // Get verified artists addresses from contract
        const verifiedArtistsAddresses = await readContract(wagmiConfig, {
          address: CONTRACT_ADDRESSES.userProfile as `0x${string}`,
          abi: USER_PROFILE_ABI,
          functionName: 'getVerifiedArtists',
        } as any) as string[];
        
        console.log('✅ [FeaturedArtists] Found', verifiedArtistsAddresses.length, 'verified artists');
        
        if (verifiedArtistsAddresses.length === 0) {
          setArtists([]);
          setLoading(false);
          return;
        }
        
        // Load profiles for all verified artists
        const artistProfiles = await Promise.all(
          verifiedArtistsAddresses.map(async (address) => {
            try {
              const profile = await profileService.getProfile(address);
              if (profile && profile.isArtist) {
                return {
                  address: profile.userAddress,
                  username: profile.username || 'Unknown',
                  displayName: profile.displayName || 'Unknown Artist',
                  bio: profile.bio || 'No bio available',
                  avatarHash: profile.avatarHash || '',
                  isVerified: profile.isVerified,
                  isArtist: profile.isArtist,
                  followerCount: profile.followerCount || 0,
                  followingCount: profile.followingCount || 0,
                };
              }
              return null;
            } catch (error) {
              console.error('❌ Failed to load profile for', address, error);
              return null;
            }
          })
        );
        
        // Filter out null values
        const validArtists = artistProfiles.filter(artist => artist !== null) as ArtistData[];
        
        console.log('✅ [FeaturedArtists] Loaded', validArtists.length, 'artist profiles');
        setArtists(validArtists);
        
      } catch (error) {
        console.error('❌ [FeaturedArtists] Error loading verified artists:', error);
        setArtists([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadVerifiedArtists();
  }, []);

  // Load following status for current user with real-time updates
  useEffect(() => {
    const loadFollowingStatus = async () => {
      if (!smartAccountAddress || artists.length === 0) return;
      
      try {
        console.log('👥 [FeaturedArtists] Loading following status for', smartAccountAddress);
        
        // Use DataStream V3 service to check follow status (same as UserProfile)
        const { somniaDatastreamServiceV3 } = await import('@/services/somniaDatastreamService.v3');
        
        // Check follow status for each artist
        const followingSet = new Set<string>();
        await Promise.all(
          artists.map(async (artist) => {
            try {
              // Skip artists with recent actions (preserve optimistic update)
              if (recentActions.has(artist.address.toLowerCase())) {
                console.log('⏭️ [Skip] Preserving optimistic update for', artist.address);
                // Keep current state for this artist
                if (followingArtists.has(artist.address.toLowerCase())) {
                  followingSet.add(artist.address.toLowerCase());
                }
                return;
              }
              
              const isFollowingArtist = await somniaDatastreamServiceV3.isFollowing(smartAccountAddress, artist.address);
              if (isFollowingArtist) {
                followingSet.add(artist.address.toLowerCase());
              }
            } catch (error) {
              console.error('❌ Failed to check follow status for', artist.address, error);
            }
          })
        );
        
        console.log('✅ [FeaturedArtists] User is following', followingSet.size, 'artists');
        setFollowingArtists(followingSet);
        
      } catch (error) {
        console.error('❌ [FeaturedArtists] Failed to load following status:', error);
      }
    };
    
    // Initial load
    loadFollowingStatus();
    
    // Real-time updates: Poll every 10 seconds
    const intervalId = setInterval(() => {
      console.log('🔄 [FeaturedArtists] Auto-refreshing follow status...');
      loadFollowingStatus();
    }, 10000); // 10 seconds
    
    return () => {
      clearInterval(intervalId);
    };
  }, [smartAccountAddress, artists, recentActions, followingArtists]);

  const genres = [
    { id: "all", name: "All Artists", count: artists.length },
    { id: "verified", name: "Verified", count: artists.filter(a => a.isVerified).length },
  ];

  // 👥 Handle follow/unfollow artist (Optimistic update like button)
  const handleFollowArtist = async (artistAddress: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!smartAccountAddress) {
      toast.error('Please connect your wallet to follow artists');
      return;
    }

    if (artistAddress.toLowerCase() === smartAccountAddress.toLowerCase()) {
      toast.error("You can't follow yourself");
      return;
    }

    const isCurrentlyFollowing = followingArtists.has(artistAddress.toLowerCase());
    const actionType = isCurrentlyFollowing ? 'unfollow' : 'follow';
    const previousFollowerCount = artists.find(a => a.address.toLowerCase() === artistAddress.toLowerCase())?.followerCount || 0;

    // ⚡ INSTANT OPTIMISTIC UPDATE (like button behavior)
    console.log(`⚡ [Optimistic] ${actionType === 'unfollow' ? 'Unfollowing' : 'Following'} artist:`, artistAddress);
    
    // Mark this artist as having recent action (prevent auto-refresh from reverting)
    setRecentActions(prev => new Set(prev).add(artistAddress.toLowerCase()));
    
    // Clear recent action after 15 seconds (enough time for batch to flush and blockchain to update)
    setTimeout(() => {
      setRecentActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(artistAddress.toLowerCase());
        return newSet;
      });
      console.log('✅ [Optimistic] Cleared recent action for', artistAddress);
    }, 15000);
    
    if (isCurrentlyFollowing) {
      setFollowingArtists(prev => {
        const newSet = new Set(prev);
        newSet.delete(artistAddress.toLowerCase());
        return newSet;
      });
    } else {
      setFollowingArtists(prev => new Set(prev).add(artistAddress.toLowerCase()));
    }

    // Update follower count in UI
    setArtists(prev => prev.map(artist => 
      artist.address.toLowerCase() === artistAddress.toLowerCase()
        ? { ...artist, followerCount: artist.followerCount + (isCurrentlyFollowing ? -1 : 1) }
        : artist
    ));

    // 🔥 Execute blockchain transaction in BACKGROUND with BATCH (don't await, don't block UI)
    (async () => {
      try {
        const result = actionType === 'unfollow' 
          ? await unfollowUser(artistAddress, false) // Use batch mode
          : await followUser(artistAddress, false); // Use batch mode
        
        console.log(`✅ [Batch] ${actionType} queued:`, result);
        
        // Send notification for follow (in background)
        if (actionType === 'follow') {
          try {
            const { notificationService } = await import('@/services/notificationService');
            await notificationService.notifyFollow(smartAccountAddress, artistAddress);
            console.log('✅ [Background] Follow notification sent');
          } catch (notifError) {
            console.warn('⚠️ [Background] Failed to send notification:', notifError);
          }
        }
        
        // ✅ Optimistic update is already correct - no need to verify
        // Batch system ensures transaction will succeed
        console.log(`✅ [Optimistic] ${actionType} completed successfully`);
        
      } catch (error) {
        console.error(`❌ [Batch] ${actionType} failed:`, error);
        
        // Revert optimistic update only on error
        setFollowingArtists(prev => {
          const newSet = new Set(prev);
          if (isCurrentlyFollowing) {
            newSet.add(artistAddress.toLowerCase());
          } else {
            newSet.delete(artistAddress.toLowerCase());
          }
          return newSet;
        });
        
        // Revert follower count
        setArtists(prev => prev.map(artist => 
          artist.address.toLowerCase() === artistAddress.toLowerCase()
            ? { ...artist, followerCount: previousFollowerCount }
            : artist
        ));
        
        // Show error toast
        toast.error(`Failed to ${actionType} artist. Please try again.`);
      }
    })();
  };

  // 🎵 Play artist's music
  const handlePlayArtistMusic = async (artistAddress: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Find artist info for display
    const artistInfo = artists.find(a => a.address.toLowerCase() === artistAddress.toLowerCase());
    const artistName = artistInfo?.displayName || artistInfo?.username || 'Artist';

    try {
      const toastId = toast.loading('Loading artist music...');
      
      console.log('🎵 [FeaturedArtists] Loading songs for artist:', artistAddress);
      
      // Strategy: Get all songs and filter by artist (same as useTrendingMusic)
      // This is more reliable than getSongsByArtist which may have query issues
      const allSongs = await subgraphService.getAllSongs(1000, 0);
      console.log('🎵 [FeaturedArtists] Total songs in subgraph:', allSongs?.length || 0);
      
      // Filter songs by artist address
      const artistSongs = allSongs.filter((song: any) => 
        song.artist?.id?.toLowerCase() === artistAddress.toLowerCase()
      );
      console.log('🎵 [FeaturedArtists] Songs by this artist:', artistSongs?.length || 0);
      
      // Log raw data for debugging
      if (artistSongs && artistSongs.length > 0) {
        const firstSong = artistSongs[0];
        if (firstSong) {
          console.log('🎵 [FeaturedArtists] First song raw data:', {
            id: firstSong.id,
            title: firstSong.title,
            audioHash: firstSong.audioHash,
            coverHash: firstSong.coverHash,
            artist: firstSong.artist
          });
        }
      }
      
      toast.dismiss(toastId);
      
      if (!artistSongs || artistSongs.length === 0) {
        toast.info(`No music found for ${artistName}`);
        return;
      }

      // Helper to clean IPFS hash (remove ipfs:// prefix if present)
      const cleanIpfsHash = (hash: string): string => {
        if (!hash) return '';
        // Remove ipfs:// prefix if present
        return hash.replace('ipfs://', '').replace('ipfs:', '');
      };

      // Convert to Track format
      const tracks = artistSongs.map((song: any) => {
        const tokenId = parseInt(song.id || song.tokenId || '0');
        const audioHash = cleanIpfsHash(song.audioHash || '');
        const coverHash = cleanIpfsHash(song.coverHash || '');
        const avatarHash = cleanIpfsHash(song.artist?.avatarHash || '');
        const artistAvatarHash = cleanIpfsHash(artistInfo?.avatarHash || '');
        
        return {
          id: tokenId,
          title: song.title || `Track #${tokenId}`,
          artist: song.artist?.displayName || song.artist?.username || artistName,
          avatar: avatarHash 
            ? `https://ipfs.io/ipfs/${avatarHash}`
            : (artistAvatarHash ? `https://ipfs.io/ipfs/${artistAvatarHash}` : ''),
          cover: coverHash 
            ? `https://ipfs.io/ipfs/${coverHash}`
            : album1,
          genre: song.genre || 'Unknown',
          duration: String(song.duration || 180),
          audioUrl: audioHash 
            ? `https://ipfs.io/ipfs/${audioHash}`
            : '',
          likes: song.likeCount || 0,
          plays: song.playCount || 0,
        };
      }).filter((t: any) => t.audioUrl && t.audioUrl.length > 0);

      console.log('🎵 [FeaturedArtists] Playable tracks:', tracks.length);

      if (tracks.length > 0) {
        const firstTrack = tracks[0];
        if (firstTrack) {
          console.log('🎵 [FeaturedArtists] First playable track:', {
            id: firstTrack.id,
            title: firstTrack.title,
            audioUrl: firstTrack.audioUrl
          });
          
          // Set playlist and play
          setPlaylist(tracks);
          playTrack(firstTrack);
          toast.success(`Playing ${tracks.length} songs by ${artistName}`);
        } else {
          toast.info(`No playable audio found for ${artistName}`);
        }
      } else {
        toast.info(`No playable audio found for ${artistName}. Songs may not have audio files uploaded.`);
      }
    } catch (error) {
      toast.dismiss();
      console.error('❌ [FeaturedArtists] Failed to play artist music:', error);
      toast.error('Failed to load artist music');
    }
  };

  const filteredArtists = artists.filter(artist => {
    const matchesSearch = artist.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         artist.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         artist.bio.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === "all" || 
                        (selectedGenre === "verified" && artist.isVerified);
    return matchesSearch && matchesGenre;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Main Content */}
      <main className="pt-16">
        <div className="container mx-auto px-6 py-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-clash font-semibold text-3xl mb-1">Featured Artists</h1>
            <p className="text-muted-foreground text-base">Discover talented creators and musicians in our community</p>
          </div>

          {/* Search and Filters */}
          <div className="mb-8 space-y-4">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search artists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Genre Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {genres.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => setSelectedGenre(genre.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                    selectedGenre === genre.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="text-sm font-medium">{genre.name}</span>
                  <Badge variant={selectedGenre === genre.id ? "secondary" : "outline"} className="text-xs ml-1">
                    {genre.count}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Card key={i} className="border-border/20 bg-card/50 backdrop-blur-sm rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center mb-4">
                      <div className="w-20 h-20 mb-3 rounded-full bg-muted animate-pulse" />
                      <div className="h-5 w-32 bg-muted animate-pulse rounded mb-2" />
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="h-12 bg-muted animate-pulse rounded mb-4" />
                    <div className="flex gap-2">
                      <div className="flex-1 h-8 bg-muted animate-pulse rounded-full" />
                      <div className="w-8 h-8 bg-muted animate-pulse rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Artists Grid */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredArtists.map((artist) => (
                <Link 
                  key={artist.address} 
                  to={`/profile/${artist.username}`}
                  className="block"
                >
                  <Card className="group hover:shadow-lg transition-all duration-300 border-border/20 bg-card/50 backdrop-blur-sm rounded-2xl h-full">
                    <CardContent className="p-6">
                      {/* Artist Avatar and Basic Info */}
                      <div className="flex flex-col items-center text-center mb-4">
                        <Avatar className="w-20 h-20 mb-3">
                          {artist.avatarHash ? (
                            <AvatarImage src={`https://ipfs.io/ipfs/${artist.avatarHash}`} />
                          ) : (
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.address}`} />
                          )}
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xl">
                            {artist.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg truncate">{artist.displayName}</h3>
                          {artist.isVerified && <VerifiedBadge size="sm" />}
                        </div>
                        <p className="text-muted-foreground text-sm">@{artist.username}</p>
                        <p className="text-muted-foreground text-xs mt-1">{artist.followerCount} followers</p>
                      </div>

                      {/* Bio */}
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3 text-center min-h-[60px]">
                        {artist.bio || 'No bio available'}
                      </p>

                      {/* Stats */}
                      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {artist.followerCount} followers
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {artist.followingCount} following
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={followingArtists.has(artist.address.toLowerCase()) ? "outline" : "default"}
                          className="flex-1 rounded-full text-xs h-8"
                          onClick={(e) => handleFollowArtist(artist.address, e)}
                          disabled={!smartAccountAddress || artist.address.toLowerCase() === smartAccountAddress.toLowerCase()}
                        >
                          {followingArtists.has(artist.address.toLowerCase()) ? 'Following' : 'Follow'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="rounded-full w-8 h-8 p-0"
                          onClick={(e) => handlePlayArtistMusic(artist.address, e)}
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {!loading && filteredArtists.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No artists found</h3>
              <p className="text-muted-foreground">
                {artists.length === 0 
                  ? 'No verified artists yet. Be the first to become a verified artist!'
                  : 'Try adjusting your search or filter criteria'
                }
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FeaturedArtists;