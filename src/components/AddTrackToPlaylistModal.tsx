import { useState, useEffect } from 'react';
import { X, Search, Music, Loader2, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useMyMusic } from '@/hooks/useMyMusic';
import { useOwnedNFTs } from '@/hooks/useOwnedNFTs';
import { subgraphService } from '@/services/subgraphService';
import { getIpfsUrl } from '@/lib/ipfs';

interface AddTrackToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrack: (trackId: string) => Promise<boolean>;
  existingTrackIds: string[];
}

interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
  duration: string;
  genre: string;
  isOwned?: boolean;
}

export default function AddTrackToPlaylistModal({
  isOpen,
  onClose,
  onAddTrack,
  existingTrackIds
}: AddTrackToPlaylistModalProps) {
  const [activeTab, setActiveTab] = useState<'owned' | 'global'>('owned');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  const [globalTracks, setGlobalTracks] = useState<Track[]>([]);
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);

  // Helper function to format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Load owned music
  const { songs: ownedSongs, isLoading: isLoadingOwned } = useMyMusic();
  const { ownedNFTs, isLoading: isLoadingNFTs } = useOwnedNFTs();

  // Convert owned songs to Track format
  const ownedTracks: Track[] = [
    ...ownedSongs.map(song => ({
      id: song.tokenId.toString(),
      title: song.title,
      artist: song.artist,
      cover: song.imageUrl,
      duration: formatDuration(song.duration),
      genre: song.genre,
      isOwned: true
    })),
    ...ownedNFTs.singles.map(nft => ({
      id: nft.tokenId,
      title: nft.title,
      artist: nft.artist,
      cover: nft.imageUrl,
      duration: formatDuration(nft.duration),
      genre: nft.genre,
      isOwned: true
    }))
  ];

  // Load global music when switching to global tab
  useEffect(() => {
    if (activeTab === 'global' && globalTracks.length === 0) {
      loadGlobalMusic();
    }
  }, [activeTab]);

  const loadGlobalMusic = async () => {
    setIsLoadingGlobal(true);
    try {
      console.log('🌍 [AddTrack] Loading global music...');
      
      // Load from subgraph
      const songs = await subgraphService.getAllSongs(100, 0);
      
      const tracks: Track[] = songs.map(song => ({
        id: song.id,
        title: song.title || `Track #${song.id}`,
        artist: song.artist?.displayName || song.artist?.username || 'Unknown Artist',
        cover: getIpfsUrl(song.coverHash || ''),
        duration: formatDuration(Number(song.duration) || 180),
        genre: song.genre || 'Unknown',
        isOwned: false
      }));
      
      setGlobalTracks(tracks);
      console.log(`✅ [AddTrack] Loaded ${tracks.length} global tracks`);
    } catch (error) {
      console.error('❌ [AddTrack] Failed to load global music:', error);
      toast.error('Failed to load global music');
    } finally {
      setIsLoadingGlobal(false);
    }
  };

  const handleAddTrack = async (trackId: string) => {
    if (existingTrackIds.includes(trackId)) {
      toast.info('Track already in playlist');
      return;
    }

    setAddingTrackId(trackId);
    try {
      console.log(`➕ [ADD-TRACK-MODAL] Adding track ${trackId}...`);
      const success = await onAddTrack(trackId);
      if (success) {
        console.log(`✅ [ADD-TRACK-MODAL] Track ${trackId} added successfully`);
        toast.success('Track added to playlist!');
        // Don't close modal automatically - let user add more tracks
        // User can close manually when done
      } else {
        console.error(`❌ [ADD-TRACK-MODAL] Failed to add track ${trackId}`);
        toast.error('Failed to add track to playlist');
      }
    } catch (error) {
      console.error('❌ [ADD-TRACK-MODAL] Error adding track:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to add track: ${errorMessage}`);
    } finally {
      setAddingTrackId(null);
    }
  };

  // Filter tracks based on search
  const currentTracks = activeTab === 'owned' ? ownedTracks : globalTracks;
  const filteredTracks = currentTracks.filter(track =>
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = activeTab === 'owned' 
    ? (isLoadingOwned || isLoadingNFTs)
    : isLoadingGlobal;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white">Add Track</h2>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === 'owned' ? 'From your collection' : 'From global library'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & Search */}
        <div className="p-6 space-y-4 border-b border-white/5">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('owned')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'owned'
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              My Music
            </button>
            <button
              onClick={() => setActiveTab('global')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'global'
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Global
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/20 transition-all"
            />
          </div>
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="text-center py-16">
              <Music className="w-12 h-12 mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">
                {searchQuery ? 'No tracks found' : 'No tracks available'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTracks.map((track) => {
                const isInPlaylist = existingTrackIds.includes(track.id);
                const isAdding = addingTrackId === track.id;

                return (
                  <div
                    key={track.id}
                    className={`group flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isInPlaylist
                        ? 'opacity-50'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    {/* Cover */}
                    <img
                      src={track.cover}
                      alt={track.title}
                      className="w-12 h-12 rounded object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white text-sm truncate">{track.title}</h4>
                      <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                    </div>

                    {/* Duration */}
                    <span className="text-xs text-gray-500 hidden sm:block">{track.duration}</span>

                    {/* Add Button */}
                    <button
                      onClick={() => handleAddTrack(track.id)}
                      disabled={isInPlaylist || isAdding}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        isInPlaylist
                          ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                          : isAdding
                          ? 'bg-white text-black'
                          : 'bg-white text-black hover:scale-105'
                      }`}
                    >
                      {isAdding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isInPlaylist ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        'Add'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
