/**
 * Music Card Component for Messages
 * Same design as PostCard music display
 */

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Pause } from 'lucide-react'
import { useAudio } from '@/contexts/AudioContext'
import { useGlobalPlayCounts } from '@/contexts/PlayCountContext'
import { recordMusicPlay } from '@/utils/playCountHelper'
import { useAccount } from 'wagmi'

interface MusicCardProps {
  trackId: string | number
  title: string
  artist: string
  coverHash?: string
  audioHash: string
  duration?: number
}

export default function MusicCard({
  trackId,
  title,
  artist,
  coverHash,
  audioHash,
  duration
}: MusicCardProps) {
  const { 
    currentTrack, 
    isPlaying: audioIsPlaying, 
    playTrack, 
    pauseTrack,
    currentTime,
    duration: audioDuration
  } = useAudio()
  const globalPlayCounts = useGlobalPlayCounts()
  const { address } = useAccount()

  const [imageUrl, setImageUrl] = useState<string>('/assets/default-cover.jpg')
  const [hasRecordedPlay, setHasRecordedPlay] = useState(false)

  const trackIdNum = typeof trackId === 'string' ? parseInt(trackId) : trackId
  const isCurrentTrack = currentTrack?.id === trackIdNum
  const isPlaying = isCurrentTrack && audioIsPlaying

  // Handle cover image
  useEffect(() => {
    if (coverHash) {
      const cleanHash = coverHash.replace('ipfs://', '')
      setImageUrl(`https://ipfs.io/ipfs/${cleanHash}`)
    }
  }, [coverHash])

  // Fetch play count when component mounts
  useEffect(() => {
    if (trackIdNum) {
      globalPlayCounts.refreshPlayCounts([trackIdNum])
    }
  }, [trackIdNum, globalPlayCounts])

  // Reset hasRecordedPlay when track changes
  useEffect(() => {
    if (!isCurrentTrack) {
      setHasRecordedPlay(false)
    }
  }, [isCurrentTrack])

  const handlePlayPause = () => {
    if (isPlaying) {
      pauseTrack()
    } else {
      // Get audio URL from IPFS
      const cleanAudioHash = audioHash.replace('ipfs://', '')
      const audioUrl = `https://ipfs.io/ipfs/${cleanAudioHash}`
      
      // Play the track
      playTrack({
        id: trackIdNum,
        title,
        artist,
        avatar: imageUrl,
        cover: imageUrl,
        genre: 'Music',
        duration: duration ? formatTime(duration) : '0:00',
        audioUrl,
        likes: 0
      })

      // Record play count immediately when user clicks play
      if (!hasRecordedPlay && address) {
        console.log('🎵 [MusicCard] Recording play for track:', trackIdNum)
        recordMusicPlay(
          {
            id: trackIdNum,
            title,
            artist,
            duration: duration || 0,
            tokenId: trackIdNum
          } as any,
          address,
          duration || 0,
          'post'
        )
        setHasRecordedPlay(true)
        
        // Optimistically increment play count in UI
        globalPlayCounts.incrementPlayCount(trackIdNum)
        
        // Refresh play count after 2 seconds to get accurate count from datastream
        setTimeout(() => {
          globalPlayCounts.refreshPlayCounts([trackIdNum])
        }, 2000)
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = isCurrentTrack && audioDuration > 0 
    ? (currentTime / audioDuration) * 100 
    : 0

  return (
    <Card className="border-border/30 bg-muted/30 max-w-sm">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Cover Image */}
          <img
            src={imageUrl}
            alt={title}
            className="w-12 h-12 rounded-md object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              if (coverHash) {
                const cleanHash = coverHash.replace('ipfs://', '')
                if (target.src.includes('ipfs.io')) {
                  target.src = `https://gateway.pinata.cloud/ipfs/${cleanHash}`
                } else if (target.src.includes('gateway.pinata.cloud')) {
                  target.src = `https://cloudflare-ipfs.com/ipfs/${cleanHash}`
                } else {
                  target.src = '/assets/default-cover.jpg'
                }
              } else {
                target.src = '/assets/default-cover.jpg'
              }
            }}
          />

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{title}</h4>
            <p className="text-xs text-muted-foreground truncate">{artist}</p>
            
            {/* Progress Bar */}
            <div className="flex items-center gap-2 mt-1">
              {/* Play count */}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Play className="w-3 h-3" />
                {globalPlayCounts.getPlayCount(typeof trackId === 'string' ? parseInt(trackId) : trackId)}
              </span>
              
              {/* Duration or current time */}
              {isCurrentTrack && audioIsPlaying && audioDuration > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {formatTime(currentTime)}
                </span>
              ) : duration ? (
                <span className="text-xs text-muted-foreground">
                  {formatTime(duration)}
                </span>
              ) : null}
              
              <div className="flex-1 bg-muted rounded-full h-1">
                <div 
                  className="bg-primary h-1 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Play/Pause Button */}
          <Button
            size="sm"
            variant="ghost"
            className="w-8 h-8 p-0 rounded-full"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
