import { SDK } from '@somnia-chain/streams';
import { SOMNIA_CONFIG_V3 } from '@/config/somniaDataStreams.v3';
import { somniaDatastreamServiceV3 } from './somniaDatastreamService.v3';
import { subgraphService } from './subgraphService';
import { publisherIndexer } from './publisherIndexer';

export interface SearchResult {
  id: string;
  type: 'track' | 'artist' | 'album' | 'playlist' | 'user' | 'post' | 'quote';
  title: string;
  subtitle?: string;
  image?: string;
  verified?: boolean;
  plays?: number;
  followers?: number;
  username?: string;
  description?: string;
  trackCount?: number;
  createdAt?: number;
  // Track-specific fields
  albumId?: string;
  // Post-specific fields
  content?: string;
  author?: string;
  authorUsername?: string;
  authorDisplayName?: string;
  authorAvatar?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  quotedPostId?: number;
}

export interface SearchFilters {
  category?: 'all' | 'tracks' | 'artists' | 'albums' | 'playlists' | 'users';
  sortBy?: 'relevance' | 'recent' | 'popular';
  limit?: number;
}

class SearchService {
  private sdk: SDK | null = null;

  initialize(sdk: SDK) {
    this.sdk = sdk;
  }

  /**
   * Perform advanced search across all content types
   */
  async search(query: string, filters: SearchFilters = {}): Promise<SearchResult[]> {
    console.log('🔍 [SEARCH] Starting search:', { query, filters, sdkInitialized: !!this.sdk });
    
    if (!this.sdk) {
      console.warn('⚠️ [SEARCH] SDK not initialized, trying to initialize...');
      try {
        const sdk = await somniaDatastreamServiceV3.getSDK();
        if (sdk) {
          this.sdk = sdk;
          console.log('✅ [SEARCH] SDK initialized successfully');
        } else {
          console.error('❌ [SEARCH] Failed to get SDK');
          return [];
        }
      } catch (error) {
        console.error('❌ [SEARCH] Error initializing SDK:', error);
        return [];
      }
    }

    const {
      category = 'all',
      sortBy = 'relevance',
      limit = 20
    } = filters;

    try {
      const results: SearchResult[] = [];
      const startTime = Date.now();

      // Search tracks
      if (category === 'all' || category === 'tracks') {
        console.log('🎵 [SEARCH] Searching tracks...');
        const tracks = await this.searchTracks(query, limit);
        console.log(`✅ [SEARCH] Found ${tracks.length} tracks`);
        results.push(...tracks);
      }

      // Search artists/users
      if (category === 'all' || category === 'artists' || category === 'users') {
        console.log('👤 [SEARCH] Searching users/artists...');
        const users = await this.searchUsers(query, limit);
        console.log(`✅ [SEARCH] Found ${users.length} users`);
        results.push(...users);
      }

      // Search albums
      if (category === 'all' || category === 'albums') {
        console.log('💿 [SEARCH] Searching albums...');
        const albums = await this.searchAlbums(query, limit);
        console.log(`✅ [SEARCH] Found ${albums.length} albums`);
        results.push(...albums);
      }

      // Search playlists
      if (category === 'all' || category === 'playlists') {
        console.log('📝 [SEARCH] Searching playlists...');
        const playlists = await this.searchPlaylists(query, limit);
        console.log(`✅ [SEARCH] Found ${playlists.length} playlists`);
        results.push(...playlists);
      }

      // Posts and quotes removed from search - not needed in main search
      // Users can find posts/quotes in Feed page

      // Sort results
      const sortedResults = this.sortResults(results, sortBy);
      
      const duration = Date.now() - startTime;
      console.log(`✅ [SEARCH] Search completed in ${duration}ms:`, {
        query,
        category,
        totalResults: sortedResults.length,
        breakdown: {
          tracks: sortedResults.filter(r => r.type === 'track').length,
          artists: sortedResults.filter(r => r.type === 'artist').length,
          users: sortedResults.filter(r => r.type === 'user').length,
          albums: sortedResults.filter(r => r.type === 'album').length,
          playlists: sortedResults.filter(r => r.type === 'playlist').length,
        }
      });
      
      return sortedResults;
    } catch (error) {
      console.error('❌ [SEARCH] Search error:', error);
      return [];
    }
  }

  /**
   * Search for tracks from subgraph (NFT songs)
   */
  private async searchTracks(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const lowerQuery = query.toLowerCase();
      
      console.log(`🎵 [SEARCH-TRACKS] Fetching songs from subgraph (limit: ${limit * 3})...`);
      
      // Get all songs from subgraph
      const allSongs = await subgraphService.getAllSongs(limit * 3, 0);
      
      console.log(`🎵 [SEARCH-TRACKS] Got ${allSongs?.length || 0} songs from subgraph`);
      
      if (!allSongs || allSongs.length === 0) {
        console.warn('⚠️ [SEARCH-TRACKS] No songs found in subgraph - this is normal if no songs have been minted yet');
        console.log('💡 [SEARCH-TRACKS] Tip: Mint some songs first to see them in search results');
        return [];
      }

      const tracks: SearchResult[] = [];
      
      for (const song of allSongs) {
        try {
          // Filter by query - search in title, artist name, genre
          const titleMatch = song.title?.toLowerCase().includes(lowerQuery);
          const artistMatch = song.artist?.displayName?.toLowerCase().includes(lowerQuery) ||
                             song.artist?.username?.toLowerCase().includes(lowerQuery);
          const genreMatch = song.genre?.toLowerCase().includes(lowerQuery);
          
          if (titleMatch || artistMatch || genreMatch) {
            // Extract IPFS hash
            const coverHash = song.coverHash?.replace('ipfs://', '') || '';
            const imageUrl = coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '/placeholder.svg';
            
            // Get albumId from song data
            const albumId = song.album?.albumId || song.albumId;
            
            tracks.push({
              id: song.id,
              type: 'track',
              title: song.title || 'Untitled',
              subtitle: song.artist?.displayName || song.artist?.username || 'Unknown Artist',
              image: imageUrl,
              plays: Number(song.playCount) || 0,
              createdAt: Number(song.createdAt) * 1000 || Date.now(),
              albumId: albumId, // Add albumId for navigation
            });
          }
        } catch (err) {
          console.error('Error parsing track:', err);
        }
      }

      console.log(`🎵 [SEARCH-TRACKS] Filtered to ${tracks.length} matching tracks`);
      
      // Sort by relevance (exact match first, then by plays)
      tracks.sort((a, b) => {
        const aExactMatch = a.title.toLowerCase() === lowerQuery;
        const bExactMatch = b.title.toLowerCase() === lowerQuery;
        
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        
        return (b.plays || 0) - (a.plays || 0);
      });

      const finalTracks = tracks.slice(0, limit);
      console.log(`✅ [SEARCH-TRACKS] Returning ${finalTracks.length} tracks`);
      
      return finalTracks;
    } catch (error) {
      console.error('❌ [SEARCH-TRACKS] Error searching tracks:', error);
      return [];
    }
  }

  /**
   * Search for users/artists using Subgraph (primary) + DataStream (fallback)
   * Same strategy as PostComposer @mention
   */
  private async searchUsers(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const lowerQuery = query.toLowerCase();
      
      console.log(`👤 [SEARCH-USERS] Searching users with query: "${lowerQuery}"`);
      
      const users: SearchResult[] = [];
      const userMap = new Map<string, SearchResult>();

      // Strategy 1: Fetch from Subgraph (primary source - indexed and fast)
      try {
        const { apolloClient } = await import('@/lib/apollo-client');
        const { GET_ALL_USERS } = await import('@/graphql/queries');

        console.log('📡 [SEARCH-USERS] Querying Subgraph...');
        const result = await apolloClient.query({
          query: GET_ALL_USERS,
          variables: {
            first: limit * 3, // Get more to filter
            skip: 0,
            orderBy: 'createdAt',
            orderDirection: 'desc'
          },
          fetchPolicy: 'network-only'
        });

        if ((result.data as any)?.userProfiles && (result.data as any).userProfiles.length > 0) {
          const subgraphUsers = (result.data as any).userProfiles
            .filter((p: any) => p.username) // Only users with username
            .filter((p: any) => {
              // Filter by query
              const nameMatch = p.displayName?.toLowerCase().includes(lowerQuery);
              const usernameMatch = p.username?.toLowerCase().includes(lowerQuery);
              const addressMatch = p.id?.toLowerCase().includes(lowerQuery) || 
                                  p.id?.toLowerCase().startsWith(lowerQuery);
              return nameMatch || usernameMatch || addressMatch;
            });
          
          console.log(`✅ [SEARCH-USERS] Found ${subgraphUsers.length} matching users from Subgraph`);
          
          // Add to map
          subgraphUsers.forEach((p: any) => {
            const cleanAvatarHash = p.avatarHash?.replace('ipfs://', '') || '';
            const avatarUrl = cleanAvatarHash ? `https://gateway.pinata.cloud/ipfs/${cleanAvatarHash}` : undefined;
            
            const user: SearchResult = {
              id: p.id,
              type: p.isArtist ? 'artist' : 'user',
              title: p.displayName || p.username || 'Anonymous',
              subtitle: `@${p.username}`,
              image: avatarUrl,
              verified: p.isVerified || false,
              username: p.username,
              createdAt: Number(p.createdAt) * 1000 || Date.now(),
            };
            
            userMap.set(p.username.toLowerCase(), user);
          });
        } else {
          console.log('📭 [SEARCH-USERS] No users in Subgraph result');
        }
      } catch (error) {
        console.error('❌ [SEARCH-USERS] Subgraph fetch failed:', error);
      }

      // Strategy 2: Fetch from DataStream (fallback/supplement)
      if (this.sdk) {
        try {
          console.log('👤 [SEARCH-USERS] Querying DataStream...');
          
          const schemaString = SOMNIA_CONFIG_V3.schemaStrings.profiles;
          const schemaId = await this.sdk.streams.computeSchemaId(schemaString);
          
          if (schemaId) {
            const publishers = publisherIndexer.getAllPublishers();
            
            if (publishers.length > 0) {
              const allProfilesArrays = await Promise.all(
                publishers.map(async (publisher) => {
                  try {
                    if (!publisher || !publisher.startsWith('0x')) return [];
                    
                    const profiles = await this.sdk!.streams.getAllPublisherDataForSchema(
                      schemaId as `0x${string}`,
                      publisher as `0x${string}`
                    );
                    return profiles || [];
                  } catch (error: any) {
                    if (error?.message?.includes('NoData()')) return [];
                    return [];
                  }
                })
              );

              const rawProfiles = allProfilesArrays.flat();
              
              console.log(`👤 [SEARCH-USERS] Got ${rawProfiles.length} profiles from DataStream`);
              
              // Helper functions
              const safeExtractValue = (item: any, defaultValue: any = '') => {
                if (!item) return defaultValue;
                if (item.value !== undefined) {
                  if (typeof item.value === 'object' && item.value.value !== undefined) {
                    return item.value.value;
                  }
                  return item.value;
                }
                return item;
              };

              const safeString = (value: any, defaultValue: string = ''): string => {
                if (value === null || value === undefined) return defaultValue;
                if (typeof value === 'string') return value;
                if (typeof value === 'object') return defaultValue;
                return String(value);
              };

              const safeNumber = (value: any, defaultValue: number = 0): number => {
                if (value === null || value === undefined) return defaultValue;
                if (typeof value === 'number') return value;
                if (typeof value === 'bigint') return Number(value);
                if (typeof value === 'object') return defaultValue;
                const num = Number(value);
                return isNaN(num) ? defaultValue : num;
              };
              
              for (const item of rawProfiles) {
                try {
                  if (!item || !Array.isArray(item) || item.length === 0) continue;
                  
                  const userAddress = safeString(safeExtractValue(item[0]));
                  const username = safeString(safeExtractValue(item[1]));
                  const displayName = safeString(safeExtractValue(item[2]));
                  const bio = safeString(safeExtractValue(item[3]));
                  const avatarHash = safeString(safeExtractValue(item[4]));
                  const followerCount = safeNumber(safeExtractValue(item[5]), 0);
                  const isVerified = Boolean(safeExtractValue(item[7]));
                  const isArtist = Boolean(safeExtractValue(item[8]));
                  
                  if (!username || username.trim() === '') continue;
                  
                  // Filter by query
                  const nameMatch = displayName?.toLowerCase().includes(lowerQuery);
                  const usernameMatch = username?.toLowerCase().includes(lowerQuery);
                  const bioMatch = bio?.toLowerCase().includes(lowerQuery);
                  const addressMatch = userAddress?.toLowerCase().includes(lowerQuery) || 
                                      userAddress?.toLowerCase().startsWith(lowerQuery);
                  
                  if (nameMatch || usernameMatch || bioMatch || addressMatch) {
                    // Only add if not already in map (Subgraph takes priority)
                    const key = username.toLowerCase();
                    if (!userMap.has(key)) {
                      const cleanAvatarHash = avatarHash?.replace('ipfs://', '') || '';
                      const avatarUrl = cleanAvatarHash ? `https://gateway.pinata.cloud/ipfs/${cleanAvatarHash}` : undefined;
                      
                      userMap.set(key, {
                        id: userAddress,
                        type: isArtist ? 'artist' : 'user',
                        title: displayName || username || 'Anonymous',
                        subtitle: bio || `${followerCount || 0} followers`,
                        image: avatarUrl,
                        verified: isVerified,
                        followers: followerCount,
                        username: username,
                        createdAt: Date.now(),
                      });
                    }
                  }
                } catch (err) {
                  console.error('Error parsing DataStream user:', err);
                }
              }
              
              console.log(`✅ [SEARCH-USERS] Added ${userMap.size - users.length} users from DataStream`);
            }
          }
        } catch (error) {
          console.warn('⚠️ [SEARCH-USERS] DataStream fetch failed:', error);
        }
      }

      // Convert map to array
      const allUsers = Array.from(userMap.values());

      console.log(`👤 [SEARCH-USERS] Total users found: ${allUsers.length}`);
      
      // Sort by relevance (exact match first, then by followers)
      allUsers.sort((a, b) => {
        // Check for exact matches on username or address
        const aUsernameExact = a.username?.toLowerCase() === lowerQuery;
        const bUsernameExact = b.username?.toLowerCase() === lowerQuery;
        const aAddressExact = a.id?.toLowerCase() === lowerQuery;
        const bAddressExact = b.id?.toLowerCase() === lowerQuery;
        const aNameExact = a.title.toLowerCase() === lowerQuery;
        const bNameExact = b.title.toLowerCase() === lowerQuery;
        
        const aExactMatch = aUsernameExact || aAddressExact || aNameExact;
        const bExactMatch = bUsernameExact || bAddressExact || bNameExact;
        
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        
        // Prioritize verified users
        if (a.verified && !b.verified) return -1;
        if (!a.verified && b.verified) return 1;
        
        // Prioritize artists
        if (a.type === 'artist' && b.type !== 'artist') return -1;
        if (a.type !== 'artist' && b.type === 'artist') return 1;
        
        // Finally sort by followers
        return (b.followers || 0) - (a.followers || 0);
      });

      const finalUsers = allUsers.slice(0, limit);
      console.log(`✅ [SEARCH-USERS] Returning ${finalUsers.length} users`);
      
      return finalUsers;
    } catch (error) {
      console.error('❌ [SEARCH-USERS] Error searching users:', error);
      return [];
    }
  }

  /**
   * Search for albums from subgraph
   */
  private async searchAlbums(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const lowerQuery = query.toLowerCase();
      
      console.log(`💿 [SEARCH-ALBUMS] Fetching albums from subgraph (limit: ${limit * 3})...`);
      
      // Get all albums from subgraph
      const allAlbums = await subgraphService.getAllAlbums(limit * 3, 0);
      
      console.log(`💿 [SEARCH-ALBUMS] Got ${allAlbums?.length || 0} albums from subgraph`);
      
      if (!allAlbums || allAlbums.length === 0) {
        console.warn('⚠️ [SEARCH-ALBUMS] No albums found in subgraph - this is normal if no albums have been created yet');
        console.log('💡 [SEARCH-ALBUMS] Tip: Create and publish some albums first to see them in search results');
        return [];
      }

      const albums: SearchResult[] = [];
      
      for (const album of allAlbums) {
        try {
          // Only show published albums
          if (album.isPublished === false) continue;
          
          // Filter by query - search in title, artist name
          const titleMatch = album.title?.toLowerCase().includes(lowerQuery);
          const artistMatch = album.artist?.displayName?.toLowerCase().includes(lowerQuery) ||
                             album.artist?.username?.toLowerCase().includes(lowerQuery);
          
          if (titleMatch || artistMatch) {
            // Extract IPFS hash
            const coverHash = album.coverImageHash?.replace('ipfs://', '') || '';
            const imageUrl = coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '/placeholder.svg';
            
            // Calculate total plays from songs
            const totalPlays = album.songs?.reduce((sum, s) => sum + (Number(s.song?.playCount) || 0), 0) || 0;
            
            albums.push({
              id: album.albumId,
              type: 'album',
              title: album.title || 'Untitled Album',
              subtitle: album.artist?.displayName || album.artist?.username || 'Unknown Artist',
              image: imageUrl,
              plays: totalPlays,
              trackCount: Number(album.songCount) || album.songs?.length || 0,
              createdAt: Number(album.createdAt) * 1000 || Date.now(),
            });
          }
        } catch (err) {
          console.error('Error parsing album:', err);
        }
      }

      console.log(`💿 [SEARCH-ALBUMS] Filtered to ${albums.length} matching albums`);
      
      // Sort by relevance (exact match first, then by plays)
      albums.sort((a, b) => {
        const aExactMatch = a.title.toLowerCase() === lowerQuery;
        const bExactMatch = b.title.toLowerCase() === lowerQuery;
        
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        
        return (b.plays || 0) - (a.plays || 0);
      });

      const finalAlbums = albums.slice(0, limit);
      console.log(`✅ [SEARCH-ALBUMS] Returning ${finalAlbums.length} albums`);
      
      return finalAlbums;
    } catch (error) {
      console.error('❌ [SEARCH-ALBUMS] Error searching albums:', error);
      return [];
    }
  }

  /**
   * Search for playlists from datastream
   */
  private async searchPlaylists(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const lowerQuery = query.toLowerCase();
      
      console.log(`📝 [SEARCH-PLAYLISTS] Fetching posts from datastream (limit: ${limit * 3})...`);
      
      // Get all posts from datastream and filter for playlists
      const allPosts = await somniaDatastreamServiceV3.getAllPosts(limit * 3);
      
      console.log(`📝 [SEARCH-PLAYLISTS] Got ${allPosts?.length || 0} posts from datastream`);
      
      if (!allPosts || allPosts.length === 0) {
        console.warn('⚠️ [SEARCH-PLAYLISTS] No posts found in datastream - this is normal if no posts have been created yet');
        console.log('💡 [SEARCH-PLAYLISTS] Tip: Create some playlists first to see them in search results');
        return [];
      }

      const playlists: SearchResult[] = [];
      
      for (const post of allPosts) {
        try {
          // Skip deleted posts
          if (post.isDeleted) continue;
          
          // Parse content to check if it's a playlist
          let postContent: any = {};
          try {
            postContent = typeof post.content === 'string' ? JSON.parse(post.content) : post.content;
          } catch {
            continue; // Skip if can't parse
          }
          
          // Check if this is a playlist post (has playlist data)
          if (!postContent.type || postContent.type !== 'playlist') continue;
          
          // Filter by query - search in playlist name, description
          const titleMatch = postContent.name?.toLowerCase().includes(lowerQuery);
          const descMatch = postContent.description?.toLowerCase().includes(lowerQuery);
          
          if (titleMatch || descMatch) {
            // Extract cover image
            const coverHash = postContent.coverUrl?.replace('ipfs://', '') || '';
            const imageUrl = coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '/placeholder.svg';
            
            playlists.push({
              id: post.id.toString(),
              type: 'playlist',
              title: postContent.name || 'Untitled Playlist',
              subtitle: `${postContent.tracks?.length || 0} tracks`,
              image: imageUrl,
              description: postContent.description,
              trackCount: postContent.tracks?.length || 0,
              createdAt: post.timestamp * 1000,
            });
          }
        } catch (err) {
          console.error('Error parsing playlist:', err);
        }
      }

      console.log(`📝 [SEARCH-PLAYLISTS] Filtered to ${playlists.length} matching playlists`);
      
      // Sort by relevance (exact match first, then by creation date)
      playlists.sort((a, b) => {
        const aExactMatch = a.title.toLowerCase() === lowerQuery;
        const bExactMatch = b.title.toLowerCase() === lowerQuery;
        
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      const finalPlaylists = playlists.slice(0, limit);
      console.log(`✅ [SEARCH-PLAYLISTS] Returning ${finalPlaylists.length} playlists`);
      
      return finalPlaylists;
    } catch (error) {
      console.error('❌ [SEARCH-PLAYLISTS] Error searching playlists:', error);
      return [];
    }
  }

  /**
   * Sort search results
   */
  private sortResults(results: SearchResult[], sortBy: string): SearchResult[] {
    switch (sortBy) {
      case 'popular':
        return results.sort((a, b) => {
          const aScore = (a.plays || 0) + (a.followers || 0);
          const bScore = (b.plays || 0) + (b.followers || 0);
          return bScore - aScore;
        });
      
      case 'recent':
        return results.sort((a, b) => {
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
      
      case 'relevance':
      default:
        // Keep original order (relevance by query match)
        return results;
    }
  }

  /**
   * Get all user profiles for @mention feature
   * Returns all users with their profile data
   */
  async getAllUsersForMention(query?: string): Promise<SearchResult[]> {
    try {
      if (!this.sdk) {
        console.warn('⚠️ [SEARCH-MENTION] SDK not initialized');
        return [];
      }

      const lowerQuery = query?.toLowerCase() || '';
      
      console.log('👤 [SEARCH-MENTION] Fetching users for mention...', { query: lowerQuery });
      
      // Get profiles schema ID
      const schemaString = SOMNIA_CONFIG_V3.schemaStrings.profiles;
      const schemaId = await this.sdk.streams.computeSchemaId(schemaString);
      
      if (!schemaId) {
        console.error('❌ [SEARCH-MENTION] Failed to compute schema ID');
        return [];
      }
      
      // Get all publishers
      const publishers = publisherIndexer.getAllPublishers();
      
      if (publishers.length === 0) {
        console.warn('⚠️ [SEARCH-MENTION] No publishers indexed');
        return [];
      }

      // Load profiles from all publishers
      const allProfilesArrays = await Promise.all(
        publishers.map(async (publisher) => {
          try {
            if (!publisher || !publisher.startsWith('0x')) {
              return [];
            }
            
            const profiles = await this.sdk!.streams.getAllPublisherDataForSchema(
              schemaId as `0x${string}`,
              publisher as `0x${string}`
            );
            return profiles || [];
          } catch (error: any) {
            if (error?.message?.includes('NoData()')) {
              return [];
            }
            console.warn(`⚠️ [SEARCH-MENTION] Failed to load from ${publisher.slice(0, 10)}:`, error?.message);
            return [];
          }
        })
      );

      const rawProfiles = allProfilesArrays.flat();
      
      console.log(`👤 [SEARCH-MENTION] Got ${rawProfiles.length} total profiles`);
      
      if (!rawProfiles || rawProfiles.length === 0) {
        return [];
      }

      // Helper functions
      const safeExtractValue = (item: any, defaultValue: any = '') => {
        if (!item) return defaultValue;
        if (item.value !== undefined) {
          if (typeof item.value === 'object' && item.value.value !== undefined) {
            return item.value.value;
          }
          return item.value;
        }
        return item;
      };

      const safeString = (value: any, defaultValue: string = ''): string => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return defaultValue;
        return String(value);
      };

      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'object') return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
      };
      
      const users: SearchResult[] = [];
      
      for (const item of rawProfiles) {
        try {
          if (!item || !Array.isArray(item) || item.length === 0) continue;
          
          // Decode profile data (9 fields)
          const userAddress = safeString(safeExtractValue(item[0]));
          const username = safeString(safeExtractValue(item[1]));
          const displayName = safeString(safeExtractValue(item[2]));
          const bio = safeString(safeExtractValue(item[3]));
          const avatarHash = safeString(safeExtractValue(item[4]));
          const followerCount = safeNumber(safeExtractValue(item[5]), 0);
          const isVerified = Boolean(safeExtractValue(item[7]));
          const isArtist = Boolean(safeExtractValue(item[8]));
          
          // Filter by query if provided
          if (lowerQuery) {
            const nameMatch = displayName?.toLowerCase().includes(lowerQuery);
            const usernameMatch = username?.toLowerCase().includes(lowerQuery);
            
            if (!nameMatch && !usernameMatch) {
              continue;
            }
          }
          
          // Extract avatar URL
          const cleanAvatarHash = avatarHash?.replace('ipfs://', '') || '';
          const avatarUrl = cleanAvatarHash ? `https://gateway.pinata.cloud/ipfs/${cleanAvatarHash}` : undefined;
          
          users.push({
            id: userAddress,
            type: isArtist ? 'artist' : 'user',
            title: displayName || username || 'Anonymous',
            subtitle: `@${username || userAddress.slice(0, 8)}`,
            image: avatarUrl,
            verified: isVerified,
            followers: followerCount,
            username: username,
            createdAt: Date.now(),
          });
        } catch (err) {
          console.error('Error parsing user for mention:', err);
        }
      }

      // Sort by followers
      users.sort((a, b) => (b.followers || 0) - (a.followers || 0));

      console.log(`✅ [SEARCH-MENTION] Returning ${users.length} users`);
      
      return users;
    } catch (error) {
      console.error('❌ [SEARCH-MENTION] Error fetching users:', error);
      return [];
    }
  }

  /**
   * Get trending searches (from analytics or predefined)
   */
  async getTrendingSearches(): Promise<string[]> {
    // TODO: Implement analytics-based trending searches
    return [
      'Lo-fi beats',
      'Chill vibes',
      'Electronic',
      'Hip hop',
      'Indie rock',
      'Jazz fusion',
      'Ambient',
      'House music'
    ];
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!query.trim()) return [];

    try {
      // Get recent successful searches
      const results = await this.search(query, { limit: limit * 2 });
      
      // Extract unique titles
      const suggestions = [...new Set(results.map(r => r.title))];
      
      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * Get artist by address or username
   */
  async getArtistByIdentifier(identifier: string): Promise<SearchResult | null> {
    try {
      if (!this.sdk) {
        console.warn('⚠️ [SEARCH-ARTIST] SDK not initialized');
        return null;
      }

      console.log('🎤 [SEARCH-ARTIST] Fetching artist:', identifier);
      
      // Get profiles schema ID
      const schemaString = SOMNIA_CONFIG_V3.schemaStrings.profiles;
      const schemaId = await this.sdk.streams.computeSchemaId(schemaString);
      
      if (!schemaId) {
        console.error('❌ [SEARCH-ARTIST] Failed to compute schema ID');
        return null;
      }
      
      // Get all publishers
      const publishers = publisherIndexer.getAllPublishers();
      
      if (publishers.length === 0) {
        console.warn('⚠️ [SEARCH-ARTIST] No publishers indexed');
        return null;
      }

      // Load profiles from all publishers
      const allProfilesArrays = await Promise.all(
        publishers.map(async (publisher) => {
          try {
            if (!publisher || !publisher.startsWith('0x')) {
              return [];
            }
            
            const profiles = await this.sdk!.streams.getAllPublisherDataForSchema(
              schemaId as `0x${string}`,
              publisher as `0x${string}`
            );
            return profiles || [];
          } catch (error: any) {
            if (error?.message?.includes('NoData()')) {
              return [];
            }
            return [];
          }
        })
      );

      const rawProfiles = allProfilesArrays.flat();
      
      // Helper functions
      const safeExtractValue = (item: any, defaultValue: any = '') => {
        if (!item) return defaultValue;
        if (item.value !== undefined) {
          if (typeof item.value === 'object' && item.value.value !== undefined) {
            return item.value.value;
          }
          return item.value;
        }
        return item;
      };

      const safeString = (value: any, defaultValue: string = ''): string => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return defaultValue;
        return String(value);
      };

      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'object') return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
      };
      
      // Find matching profile
      for (const item of rawProfiles) {
        try {
          if (!item || !Array.isArray(item) || item.length === 0) continue;
          
          // Decode profile data (9 fields)
          const userAddress = safeString(safeExtractValue(item[0]));
          const username = safeString(safeExtractValue(item[1]));
          const displayName = safeString(safeExtractValue(item[2]));
          const bio = safeString(safeExtractValue(item[3]));
          const avatarHash = safeString(safeExtractValue(item[4]));
          const followerCount = safeNumber(safeExtractValue(item[5]), 0);
          const isVerified = Boolean(safeExtractValue(item[7]));
          const isArtist = Boolean(safeExtractValue(item[8]));
          
          // Skip profiles without username
          if (!username || username.trim() === '') {
            continue;
          }
          
          // Match by address (exact or partial) or username (exact or partial)
          const lowerIdentifier = identifier.toLowerCase();
          const addressExactMatch = userAddress.toLowerCase() === lowerIdentifier;
          const addressPartialMatch = userAddress.toLowerCase().startsWith(lowerIdentifier);
          const usernameExactMatch = username.toLowerCase() === lowerIdentifier;
          const usernamePartialMatch = username.toLowerCase().includes(lowerIdentifier);
          
          if (addressExactMatch || addressPartialMatch || usernameExactMatch || usernamePartialMatch) {
            // Extract avatar URL
            const cleanAvatarHash = avatarHash?.replace('ipfs://', '') || '';
            const avatarUrl = cleanAvatarHash ? `https://gateway.pinata.cloud/ipfs/${cleanAvatarHash}` : undefined;
            
            console.log(`✅ [SEARCH-ARTIST] Found artist: ${displayName || username}`);
            
            return {
              id: userAddress,
              type: isArtist ? 'artist' : 'user',
              title: displayName || username || 'Anonymous',
              subtitle: bio || `${followerCount || 0} followers`,
              image: avatarUrl,
              verified: isVerified,
              followers: followerCount,
              username: username,
              description: bio,
              createdAt: Date.now(),
            };
          }
        } catch (err) {
          console.error('Error parsing artist profile:', err);
        }
      }

      console.log(`⚠️ [SEARCH-ARTIST] Artist not found: ${identifier}`);
      return null;
    } catch (error) {
      console.error('❌ [SEARCH-ARTIST] Error fetching artist:', error);
      return null;
    }
  }

  /**
   * Get album by ID
   */
  async getAlbumById(albumId: string): Promise<SearchResult | null> {
    try {
      console.log('💿 [SEARCH-ALBUM] Fetching album:', albumId);
      
      // Get album from subgraph
      const album = await subgraphService.getAlbumById(albumId);
      
      if (!album) {
        console.log(`⚠️ [SEARCH-ALBUM] Album not found: ${albumId}`);
        return null;
      }
      
      // Extract IPFS hash
      const coverHash = album.coverImageHash?.replace('ipfs://', '') || '';
      const imageUrl = coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '/placeholder.svg';
      
      // Calculate total plays from songs
      const totalPlays = album.songs?.reduce((sum: number, s: any) => sum + (Number(s.song?.playCount) || 0), 0) || 0;
      
      console.log(`✅ [SEARCH-ALBUM] Found album: ${album.title}`);
      
      return {
        id: album.albumId,
        type: 'album',
        title: album.title || 'Untitled Album',
        subtitle: album.artist?.displayName || album.artist?.username || 'Unknown Artist',
        image: imageUrl,
        plays: totalPlays,
        trackCount: Number(album.songCount) || album.songs?.length || 0,
        description: album.description,
        createdAt: Number(album.createdAt) * 1000 || Date.now(),
      };
    } catch (error) {
      console.error('❌ [SEARCH-ALBUM] Error fetching album:', error);
      return null;
    }
  }

  /**
   * Search for posts from datastream
   */
  private async searchPosts(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const lowerQuery = query.toLowerCase();
      
      console.log(`📄 [SEARCH-POSTS] Fetching posts from datastream...`);
      
      // Get all posts from datastream
      const allPosts = await somniaDatastreamServiceV3.getAllPosts(limit * 3);
      
      console.log(`📄 [SEARCH-POSTS] Got ${allPosts?.length || 0} posts from datastream`);
      
      if (!allPosts || allPosts.length === 0) {
        console.warn('⚠️ [SEARCH-POSTS] No posts found');
        return [];
      }

      const posts: SearchResult[] = [];
      
      // Get profiles for author info
      const profileCache = new Map<string, any>();
      
      for (const post of allPosts) {
        try {
          // Skip deleted posts
          if (post.isDeleted) continue;
          
          // Skip quote posts (they have separate category)
          if (post.quotedPostId && post.quotedPostId > 0) continue;
          
          // Parse content
          let postContent = '';
          try {
            const parsed = typeof post.content === 'string' ? JSON.parse(post.content) : post.content;
            postContent = parsed.text || parsed.content || post.content;
          } catch {
            postContent = post.content;
          }
          
          // Filter by query - search in content and author
          const contentMatch = postContent?.toLowerCase().includes(lowerQuery);
          const authorMatch = post.author?.toLowerCase().includes(lowerQuery);
          
          if (!contentMatch && !authorMatch) continue;
          
          // Get author profile
          let authorProfile = profileCache.get(post.author);
          if (!authorProfile) {
            authorProfile = await this.getProfileByAddress(post.author);
            if (authorProfile) {
              profileCache.set(post.author, authorProfile);
            }
          }
          
          posts.push({
            id: post.id.toString(),
            type: 'post',
            title: postContent.substring(0, 100) + (postContent.length > 100 ? '...' : ''),
            subtitle: `by ${authorProfile?.displayName || authorProfile?.username || post.author.slice(0, 8)}`,
            content: postContent,
            author: post.author,
            authorUsername: authorProfile?.username,
            authorDisplayName: authorProfile?.displayName,
            authorAvatar: authorProfile?.avatarUrl,
            verified: authorProfile?.isVerified,
            createdAt: post.timestamp * 1000,
          });
        } catch (err) {
          console.error('Error parsing post:', err);
        }
      }

      console.log(`📄 [SEARCH-POSTS] Filtered to ${posts.length} matching posts`);
      
      // Sort by relevance (exact match first, then by timestamp)
      posts.sort((a, b) => {
        const aExactMatch = a.content?.toLowerCase() === lowerQuery;
        const bExactMatch = b.content?.toLowerCase() === lowerQuery;
        
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      const finalPosts = posts.slice(0, limit);
      console.log(`✅ [SEARCH-POSTS] Returning ${finalPosts.length} posts`);
      
      return finalPosts;
    } catch (error) {
      console.error('❌ [SEARCH-POSTS] Error searching posts:', error);
      return [];
    }
  }

  /**
   * Search for quote posts from datastream
   */
  private async searchQuotes(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const lowerQuery = query.toLowerCase();
      
      console.log(`💬 [SEARCH-QUOTES] Fetching quote posts from datastream...`);
      
      // Get all posts from datastream
      const allPosts = await somniaDatastreamServiceV3.getAllPosts(limit * 3);
      
      console.log(`💬 [SEARCH-QUOTES] Got ${allPosts?.length || 0} posts from datastream`);
      
      if (!allPosts || allPosts.length === 0) {
        console.warn('⚠️ [SEARCH-QUOTES] No posts found');
        return [];
      }

      const quotes: SearchResult[] = [];
      
      // Get profiles for author info
      const profileCache = new Map<string, any>();
      
      for (const post of allPosts) {
        try {
          // Skip deleted posts
          if (post.isDeleted) continue;
          
          // Only include quote posts
          if (!post.quotedPostId || post.quotedPostId === 0) continue;
          
          // Parse content
          let postContent = '';
          try {
            const parsed = typeof post.content === 'string' ? JSON.parse(post.content) : post.content;
            postContent = parsed.text || parsed.content || post.content;
          } catch {
            postContent = post.content;
          }
          
          // Filter by query - search in content and author
          const contentMatch = postContent?.toLowerCase().includes(lowerQuery);
          const authorMatch = post.author?.toLowerCase().includes(lowerQuery);
          
          if (!contentMatch && !authorMatch) continue;
          
          // Get author profile
          let authorProfile = profileCache.get(post.author);
          if (!authorProfile) {
            authorProfile = await this.getProfileByAddress(post.author);
            if (authorProfile) {
              profileCache.set(post.author, authorProfile);
            }
          }
          
          quotes.push({
            id: post.id.toString(),
            type: 'quote',
            title: postContent.substring(0, 100) + (postContent.length > 100 ? '...' : ''),
            subtitle: `Quote by ${authorProfile?.displayName || authorProfile?.username || post.author.slice(0, 8)}`,
            content: postContent,
            author: post.author,
            authorUsername: authorProfile?.username,
            authorDisplayName: authorProfile?.displayName,
            authorAvatar: authorProfile?.avatarUrl,
            verified: authorProfile?.isVerified,
            quotedPostId: post.quotedPostId,
            createdAt: post.timestamp * 1000,
          });
        } catch (err) {
          console.error('Error parsing quote:', err);
        }
      }

      console.log(`💬 [SEARCH-QUOTES] Filtered to ${quotes.length} matching quotes`);
      
      // Sort by timestamp (newest first)
      quotes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const finalQuotes = quotes.slice(0, limit);
      console.log(`✅ [SEARCH-QUOTES] Returning ${finalQuotes.length} quotes`);
      
      return finalQuotes;
    } catch (error) {
      console.error('❌ [SEARCH-QUOTES] Error searching quotes:', error);
      return [];
    }
  }

  /**
   * Get profile by address (helper function)
   */
  private async getProfileByAddress(address: string): Promise<any | null> {
    try {
      if (!this.sdk) return null;
      
      // Get profiles schema ID
      const schemaString = SOMNIA_CONFIG_V3.schemaStrings.profiles;
      const schemaId = await this.sdk.streams.computeSchemaId(schemaString);
      
      if (!schemaId) return null;
      
      // Try to get profile from this address as publisher
      try {
        const profiles = await this.sdk.streams.getAllPublisherDataForSchema(
          schemaId as `0x${string}`,
          address as `0x${string}`
        );
        
        if (profiles && profiles.length > 0) {
          const item = profiles[0];
          
          // Helper functions
          const safeExtractValue = (item: any, defaultValue: any = '') => {
            if (!item) return defaultValue;
            if (item.value !== undefined) {
              if (typeof item.value === 'object' && item.value.value !== undefined) {
                return item.value.value;
              }
              return item.value;
            }
            return item;
          };

          const safeString = (value: any, defaultValue: string = ''): string => {
            if (value === null || value === undefined) return defaultValue;
            if (typeof value === 'string') return value;
            if (typeof value === 'object') return defaultValue;
            return String(value);
          };
          
          if (!item || !Array.isArray(item) || item.length < 8) {
            return null;
          }
          
          const username = safeString(safeExtractValue(item[1]));
          const displayName = safeString(safeExtractValue(item[2]));
          const avatarHash = safeString(safeExtractValue(item[4]));
          const isVerified = Boolean(safeExtractValue(item[7]));
          
          const cleanAvatarHash = avatarHash?.replace('ipfs://', '') || '';
          const avatarUrl = cleanAvatarHash ? `https://gateway.pinata.cloud/ipfs/${cleanAvatarHash}` : undefined;
          
          return {
            username,
            displayName,
            avatarUrl,
            isVerified,
          };
        }
      } catch (error: any) {
        if (!error?.message?.includes('NoData()')) {
          console.warn(`⚠️ [SEARCH] Failed to get profile for ${address.slice(0, 10)}:`, error?.message);
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ [SEARCH] Error getting profile:', error);
      return null;
    }
  }

  /**
   * Search user by username or address
   */
  async searchUserByIdentifier(identifier: string): Promise<SearchResult | null> {
    try {
      if (!this.sdk) {
        console.warn('⚠️ [SEARCH-USER] SDK not initialized');
        return null;
      }

      console.log('👤 [SEARCH-USER] Searching user:', identifier);
      
      const lowerIdentifier = identifier.toLowerCase();
      
      // Get profiles schema ID
      const schemaString = SOMNIA_CONFIG_V3.schemaStrings.profiles;
      const schemaId = await this.sdk.streams.computeSchemaId(schemaString);
      
      if (!schemaId) {
        console.error('❌ [SEARCH-USER] Failed to compute schema ID');
        return null;
      }
      
      // Get all publishers
      const publishers = publisherIndexer.getAllPublishers();
      
      if (publishers.length === 0) {
        console.warn('⚠️ [SEARCH-USER] No publishers indexed');
        return null;
      }

      // Load profiles from all publishers
      const allProfilesArrays = await Promise.all(
        publishers.map(async (publisher) => {
          try {
            if (!publisher || !publisher.startsWith('0x')) {
              return [];
            }
            
            const profiles = await this.sdk!.streams.getAllPublisherDataForSchema(
              schemaId as `0x${string}`,
              publisher as `0x${string}`
            );
            return profiles || [];
          } catch (error: any) {
            if (error?.message?.includes('NoData()')) {
              return [];
            }
            return [];
          }
        })
      );

      const rawProfiles = allProfilesArrays.flat();
      
      // Helper functions
      const safeExtractValue = (item: any, defaultValue: any = '') => {
        if (!item) return defaultValue;
        if (item.value !== undefined) {
          if (typeof item.value === 'object' && item.value.value !== undefined) {
            return item.value.value;
          }
          return item.value;
        }
        return item;
      };

      const safeString = (value: any, defaultValue: string = ''): string => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return defaultValue;
        return String(value);
      };

      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'object') return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
      };
      
      // Find matching profile
      for (const item of rawProfiles) {
        try {
          if (!item || !Array.isArray(item) || item.length === 0) continue;
          
          // Decode profile data (9 fields)
          const userAddress = safeString(safeExtractValue(item[0]));
          const username = safeString(safeExtractValue(item[1]));
          const displayName = safeString(safeExtractValue(item[2]));
          const bio = safeString(safeExtractValue(item[3]));
          const avatarHash = safeString(safeExtractValue(item[4]));
          const followerCount = safeNumber(safeExtractValue(item[5]), 0);
          const isVerified = Boolean(safeExtractValue(item[7]));
          const isArtist = Boolean(safeExtractValue(item[8]));
          
          // Skip profiles without username
          if (!username || username.trim() === '') {
            continue;
          }
          
          // Match by address (exact or partial) or username (exact or partial)
          const addressExactMatch = userAddress.toLowerCase() === lowerIdentifier;
          const addressPartialMatch = userAddress.toLowerCase().startsWith(lowerIdentifier);
          const usernameExactMatch = username.toLowerCase() === lowerIdentifier;
          const usernamePartialMatch = username.toLowerCase().includes(lowerIdentifier);
          
          if (addressExactMatch || addressPartialMatch || usernameExactMatch || usernamePartialMatch) {
            // Extract avatar URL
            const cleanAvatarHash = avatarHash?.replace('ipfs://', '') || '';
            const avatarUrl = cleanAvatarHash ? `https://gateway.pinata.cloud/ipfs/${cleanAvatarHash}` : undefined;
            
            console.log(`✅ [SEARCH-USER] Found user: ${displayName || username}`);
            
            return {
              id: userAddress,
              type: isArtist ? 'artist' : 'user',
              title: displayName || username || 'Anonymous',
              subtitle: bio || `${followerCount || 0} followers`,
              image: avatarUrl,
              verified: isVerified,
              followers: followerCount,
              username: username,
              description: bio,
              createdAt: Date.now(),
            };
          }
        } catch (err) {
          console.error('Error parsing user profile:', err);
        }
      }

      console.log(`⚠️ [SEARCH-USER] User not found: ${identifier}`);
      return null;
    } catch (error) {
      console.error('❌ [SEARCH-USER] Error searching user:', error);
      return null;
    }
  }
}

export const searchService = new SearchService();
