import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { useSomniaDatastream } from '@/contexts/SomniaDatastreamContext';
import { somniaDatastreamService } from '@/services/somniaDatastreamService';

export interface OwnedNFT {
  tokenId: string;
  title: string;
  artist: string;
  genre: string;
  duration: number;
  ipfsAudioHash: string;
  ipfsArtworkHash: string;
  ipfsMetadataHash: string;
  royaltyPercentage: number;
  isExplicit: boolean;
  artistAddress: string;
  createdAt: number;
  likeCount: number;
  playCount: number;
  imageUrl: string;
  audioUrl: string;
  metadataUrl: string;
  // Additional metadata for categorization
  metadata?: {
    title?: string;
    artist?: string;
    genre?: string;
    duration?: number;
    image?: string;
    type?: 'single' | 'playlist' | 'album';
    creator?: string;
    trackCount?: number;
    description?: string;
    year?: number;
  };
}

export interface OwnedNFTsData {
  singles: OwnedNFT[];
  playlists: OwnedNFT[];
  albums: OwnedNFT[];
}

export const useOwnedNFTs = () => {
  const { address } = useAccount();
  const { isConnected: datastreamConnected, readMusicEvents } = useSomniaDatastream();
  const [ownedNFTs, setOwnedNFTs] = useState<OwnedNFTsData>({ singles: [], playlists: [], albums: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SONG_NFT_ADDRESS = '0x328f1d2448897109b8Bc1C20b684088b83bb4127';

  // Query owned NFTs from DataStream cache
  const queryOwnedNFTsFromDataStream = async (userAddress: string): Promise<OwnedNFTsData | null> => {
    try {
      // Query NFT ownership data from DataStream schema
      const ownershipData = await somniaDatastreamService.getAllPublisherDataForSchema(
        'hibeats_nft_ownership_v1',
        userAddress.toLowerCase()
      );

      if (!ownershipData || ownershipData.length === 0) {
        return null;
      }

      // Categorize NFTs based on metadata
      const categorizedNFTs: OwnedNFTsData = {
        singles: [],
        playlists: [],
        albums: []
      };

      for (const ownershipRecord of ownershipData) {
        const nft: OwnedNFT = {
          tokenId: ownershipRecord.tokenId,
          title: ownershipRecord.title || 'Untitled',
          artist: ownershipRecord.artist || 'Unknown Artist',
          genre: ownershipRecord.genre || 'Music',
          duration: ownershipRecord.duration || 0,
          ipfsAudioHash: ownershipRecord.ipfsAudioHash || '',
          ipfsArtworkHash: ownershipRecord.ipfsArtworkHash || '',
          ipfsMetadataHash: ownershipRecord.ipfsMetadataHash || '',
          royaltyPercentage: ownershipRecord.royaltyPercentage || 0,
          isExplicit: ownershipRecord.isExplicit || false,
          artistAddress: ownershipRecord.artistAddress || '',
          createdAt: ownershipRecord.createdAt || Date.now(),
          likeCount: ownershipRecord.likeCount || 0,
          playCount: ownershipRecord.playCount || 0,
          imageUrl: ownershipRecord.imageUrl || '',
          audioUrl: ownershipRecord.audioUrl || '',
          metadataUrl: ownershipRecord.metadataUrl || '',
          metadata: ownershipRecord.metadata || {}
        };

        // Categorize based on metadata type
        const type = nft.metadata?.type;
        if (type === 'playlist') {
          categorizedNFTs.playlists.push(nft);
        } else if (type === 'album') {
          categorizedNFTs.albums.push(nft);
        } else {
          categorizedNFTs.singles.push(nft);
        }
      }

      return categorizedNFTs;
    } catch (error: any) {
      // NoData() error is expected when no data exists yet
      if (error?.message?.includes('NoData()')) {
        console.log('📭 No NFT ownership data found in DataStream');
        return null;
      }
      console.error('Failed to query NFTs from DataStream:', error);
      return null;
    }
  };

  // Query owned NFTs from subgraph (avoids RPC rate limits)
  const queryOwnedNFTsFromSubgraph = async (userAddress: string): Promise<OwnedNFTsData> => {
    try {
      console.log('🔍 [useOwnedNFTs] Querying NFTs from subgraph for:', userAddress);

      // Import subgraph service
      const { subgraphService } = await import('@/services/subgraphService');

      // Get owned songs from subgraph
      const ownedSongs = await subgraphService.getUserOwnedSongs(userAddress, 100, 0);
      
      // Get user's playlists from subgraph
      const userPlaylists = await subgraphService.getUserPlaylists(userAddress, 50, 0);
      
      // Get user's albums from subgraph
      const userAlbums = await subgraphService.getUserAlbums(userAddress, 50, 0);

      console.log('📊 [useOwnedNFTs] Subgraph results:', {
        songs: ownedSongs.length,
        playlists: userPlaylists.length,
        albums: userAlbums.length
      });

      // Helper to extract IPFS hash
      const extractIpfsHash = (hash: string): string => {
        if (!hash) return '';
        return hash.replace('ipfs://', '');
      };

      const categorizedNFTs: OwnedNFTsData = {
        singles: [],
        playlists: [],
        albums: []
      };

      // Map songs
      categorizedNFTs.singles = ownedSongs.map(song => {
        const audioHash = extractIpfsHash(song.audioHash || '');
        const coverHash = extractIpfsHash(song.coverHash || '');

        return {
          tokenId: song.id,
          title: song.title || `Track #${song.id}`,
          artist: song.artist?.displayName || song.artist?.username || 'Unknown Artist',
          genre: song.genre || 'Unknown',
          duration: Number(song.duration) || 180,
          ipfsAudioHash: audioHash,
          ipfsArtworkHash: coverHash,
          ipfsMetadataHash: '',
          royaltyPercentage: Number(song.royaltyPercentage) || 500,
          isExplicit: false, // Not in subgraph schema
          artistAddress: song.artist?.id || '',
          createdAt: Number(song.createdAt) || Math.floor(Date.now() / 1000),
          likeCount: Number(song.likeCount) || 0,
          playCount: Number(song.playCount) || 0,
          imageUrl: coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '',
          audioUrl: audioHash ? `https://gateway.pinata.cloud/ipfs/${audioHash}` : '',
          metadataUrl: '',
          metadata: {
            title: song.title,
            artist: song.artist?.displayName || song.artist?.username,
            genre: song.genre,
            duration: Number(song.duration) || 180,
            image: coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '',
            type: 'single'
          }
        };
      });

      // Map playlists
      categorizedNFTs.playlists = userPlaylists.map(playlist => {
        const coverHash = extractIpfsHash(playlist.coverHash || '');

        return {
          tokenId: playlist.id,
          title: playlist.name || 'Untitled Playlist',
          artist: playlist.owner?.displayName || playlist.owner?.username || 'Unknown',
          genre: 'Playlist',
          duration: 0,
          ipfsAudioHash: '',
          ipfsArtworkHash: coverHash,
          ipfsMetadataHash: '',
          royaltyPercentage: 0,
          isExplicit: false,
          artistAddress: playlist.owner?.id || '',
          createdAt: Number(playlist.createdAt) || Math.floor(Date.now() / 1000),
          likeCount: 0,
          playCount: 0,
          imageUrl: coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '',
          audioUrl: '',
          metadataUrl: '',
          metadata: {
            title: playlist.name,
            artist: playlist.owner?.displayName || playlist.owner?.username,
            description: playlist.description,
            image: coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '',
            type: 'playlist',
            trackCount: Number(playlist.songCount) || 0
          }
        };
      });

      // Map albums
      categorizedNFTs.albums = userAlbums.map(album => {
        const coverHash = extractIpfsHash(album.coverImageHash || '');
        const releaseTimestamp = Number(album.releaseDate) || 0;

        return {
          tokenId: album.id,
          title: album.title || 'Untitled Album',
          artist: album.artist?.displayName || album.artist?.username || 'Unknown Artist',
          genre: album.albumType || 'Album',
          duration: 0,
          ipfsAudioHash: '',
          ipfsArtworkHash: coverHash,
          ipfsMetadataHash: '',
          royaltyPercentage: 0,
          isExplicit: false,
          artistAddress: album.artist?.id || '',
          createdAt: Number(album.createdAt) || Math.floor(Date.now() / 1000),
          likeCount: 0,
          playCount: 0,
          imageUrl: coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '',
          audioUrl: '',
          metadataUrl: '',
          metadata: {
            title: album.title,
            artist: album.artist?.displayName || album.artist?.username,
            description: album.description,
            image: coverHash ? `https://gateway.pinata.cloud/ipfs/${coverHash}` : '',
            type: 'album',
            trackCount: Number(album.songCount) || 0,
            year: releaseTimestamp > 0 ? new Date(releaseTimestamp * 1000).getFullYear() : undefined
          }
        };
      });

      console.log('✅ [useOwnedNFTs] Categorized NFTs:', {
        singles: categorizedNFTs.singles.length,
        playlists: categorizedNFTs.playlists.length,
        albums: categorizedNFTs.albums.length
      });

      return categorizedNFTs;
    } catch (error) {
      console.error('❌ [useOwnedNFTs] Failed to query NFTs from subgraph:', error);
      return { singles: [], playlists: [], albums: [] };
    }
  };

  // Index owned NFTs in DataStream for caching
  const indexOwnedNFTsInDataStream = async (userAddress: string, nftsData: OwnedNFTsData) => {
    try {
      const allNFTs = [...nftsData.singles, ...nftsData.playlists, ...nftsData.albums];
      console.log(`📝 [useOwnedNFTs] Caching ${allNFTs.length} NFTs for user ${userAddress}`);
      
      // Store in localStorage as a simple cache mechanism
      const cacheKey = `owned_nfts_${userAddress.toLowerCase()}`;
      const cacheData = {
        timestamp: Date.now(),
        data: nftsData,
        count: allNFTs.length
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`✅ [useOwnedNFTs] Cached ${allNFTs.length} NFTs to localStorage`);
    } catch (error) {
      console.error('Failed to cache NFTs:', error);
    }
  };
  
  // Get cached NFTs from localStorage
  const getCachedNFTs = (userAddress: string): OwnedNFTsData | null => {
    try {
      const cacheKey = `owned_nfts_${userAddress.toLowerCase()}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const cacheData = JSON.parse(cached);
      const cacheAge = Date.now() - cacheData.timestamp;
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      
      if (cacheAge > CACHE_TTL) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      console.log(`⚡ [useOwnedNFTs] Using cached NFTs (age: ${Math.round(cacheAge / 1000)}s)`);
      return cacheData.data;
    } catch (error) {
      return null;
    }
  };

  const fetchOwnedNFTs = async () => {
    if (!address || !window.ethereum) {
      setOwnedNFTs({ singles: [], playlists: [], albums: [] });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First try localStorage cache (fastest)
      const localCached = getCachedNFTs(address);
      if (localCached && (localCached.singles.length > 0 || localCached.playlists.length > 0 || localCached.albums.length > 0)) {
        console.log('✅ Found cached NFT data in localStorage');
        setOwnedNFTs(localCached);
        setIsLoading(false);
        return;
      }
      
      // Then try DataStream cache
      if (datastreamConnected) {
        try {
          console.log('🔍 Querying owned NFTs from DataStream cache...');
          const cachedNFTs = await queryOwnedNFTsFromDataStream(address);
          if (cachedNFTs && (cachedNFTs.singles.length > 0 || cachedNFTs.playlists.length > 0 || cachedNFTs.albums.length > 0)) {
            console.log('✅ Found cached NFT data in DataStream');
            setOwnedNFTs(cachedNFTs);
            setIsLoading(false);
            return;
          }
        } catch (datastreamError) {
          console.warn('⚠️ DataStream query failed, falling back to blockchain:', datastreamError);
        }
      }

      // Fallback to subgraph query (avoids RPC rate limits)
      console.log('🔗 Querying owned NFTs from subgraph...');
      const subgraphNFTs = await queryOwnedNFTsFromSubgraph(address);

      // Index the results in DataStream for future queries
      if (datastreamConnected && subgraphNFTs) {
        try {
          await indexOwnedNFTsInDataStream(address, subgraphNFTs);
          console.log('✅ Indexed NFT ownership data in DataStream');
        } catch (indexError) {
          console.warn('⚠️ Failed to index NFTs in DataStream:', indexError);
        }
      }

      setOwnedNFTs(subgraphNFTs);
    } catch (error) {
      console.error('Failed to fetch owned NFTs:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch NFTs');
      setOwnedNFTs({ singles: [], playlists: [], albums: [] });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOwnedNFTs();
  }, [address]);

  const refetch = () => {
    fetchOwnedNFTs();
  };

  return {
    ownedNFTs,
    isLoading,
    error,
    refetch
  };
};