/**
 * Music Share Modal Component
 * Allows users to share their music tracks in chat
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Music, Play, Loader2 } from 'lucide-react'
import { useMyMusic } from '@/hooks/useMyMusic'
import { useGlobalPlayCounts } from '@/contexts/PlayCountContext'
import { getAvatarUrl } from '@/lib/avatarUtils'

interface Track {
  id: string
  title: string
  artist: string
  coverHash?: string
  audioHash: string
  duration?: number
  plays?: number
}

interface MusicShareModalProps {
  open: boolean
  onClose: () => void
  onSelectTrack: (track: Track) => void
}

export default function MusicShareModal({ open, onClose, onSelectTrack }: MusicShareModalProps) {
  const { songs, isLoading: loading } = useMyMusic()
  const globalPlayCounts = useGlobalPlayCounts()
  const [tracks, setTracks] = useState<Track[]>([])
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Convert songs to tracks format
  useEffect(() => {
    if (songs && songs.length > 0) {
      const convertedTracks: Track[] = songs.map(song => ({
        id: song.tokenId.toString(),
        title: song.title,
        artist: song.artist,
        coverHash: song.ipfsArtworkHash,
        audioHash: song.ipfsAudioHash,
        duration: song.duration,
        plays: song.playCount
      }))
      setTracks(convertedTracks)
      setFilteredTracks(convertedTracks)
    } else {
      setTracks([])
      setFilteredTracks([])
    }
  }, [songs])

  // Filter tracks based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = tracks.filter(track =>
        track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.artist.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredTracks(filtered)
    } else {
      setFilteredTracks(tracks)
    }
  }, [searchQuery, tracks])

  const handleSelectTrack = (track: Track) => {
    onSelectTrack(track)
    onClose()
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Share Your Music
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search your tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tracks List */}
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Music className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No tracks found' : 'No tracks yet'}
              </p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {searchQuery ? 'Try a different search' : 'Create your first track to share'}
              </p>
            </div>
          ) : (
            filteredTracks.map((track) => (
              <button
                key={track.id}
                onClick={() => handleSelectTrack(track)}
                className="w-full flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                {/* Cover */}
                <Avatar className="w-14 h-14 rounded-md">
                  <AvatarImage src={getAvatarUrl(track.coverHash)} alt={track.title} />
                  <AvatarFallback className="bg-primary/10 text-primary rounded-md">
                    <Music className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-sm text-foreground truncate">
                    {track.title}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {track.artist}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(track.duration)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Play className="w-3 h-3" />
                      {globalPlayCounts.getPlayCount(parseInt(track.id)).toLocaleString()} plays
                    </span>
                  </div>
                </div>

                {/* Share Button */}
                <Button size="sm" variant="outline">
                  Share
                </Button>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
