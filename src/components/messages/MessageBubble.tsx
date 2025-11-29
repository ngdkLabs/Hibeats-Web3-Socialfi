/**
 * Message Bubble Component V2
 */

import { DirectMessageV2, MessageType } from '@/lib/messagingSchemasV2'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAvatarUrl } from '@/lib/avatarUtils'
import MusicCard from '@/components/messages/MusicCard'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Edit2, Trash2 } from 'lucide-react'

interface MessageBubbleProps {
  message: DirectMessageV2
  isOwn: boolean
  showAvatar: boolean
  senderAvatarHash?: string
  senderDisplayName?: string
  onDelete?: (message: DirectMessageV2) => void
  onEdit?: (message: DirectMessageV2) => void
  customBubbleColor?: string
}

export default function MessageBubble({ 
  message, 
  isOwn, 
  showAvatar,
  senderAvatarHash,
  senderDisplayName,
  onDelete,
  onEdit,
  customBubbleColor
}: MessageBubbleProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  // Get avatar URL using shared utility
  const avatarUrl = getAvatarUrl(senderAvatarHash);
  
  // Avatar loaded

  // Check if message has media (image/video/music)
  const hasMedia = message.messageType === MessageType.IMAGE || 
                    message.messageType === MessageType.VIDEO || 
                    message.messageType === MessageType.MUSIC_TRACK
  
  const renderContent = () => {
    switch (message.messageType) {
      case MessageType.MUSIC_TRACK:
        try {
          const musicData = JSON.parse(message.content)
          return (
            <MusicCard
              trackId={musicData.trackId}
              title={musicData.title}
              artist={musicData.artist}
              coverHash={musicData.coverHash}
              audioHash={musicData.audioHash}
              duration={musicData.duration}
            />
          )
        } catch (error) {
          return <p className="text-xs text-muted-foreground">Invalid music data</p>
        }

      case MessageType.IMAGE:
        // Convert IPFS URL to gateway URL
        const getImageUrl = (url: string) => {
          if (url.startsWith('ipfs://')) {
            const hash = url.replace('ipfs://', '')
            return `https://gateway.pinata.cloud/ipfs/${hash}`
          }
          return url
        }

        return (
          <div className="space-y-2">
            {message.mediaUrl && (
              <img
                src={getImageUrl(message.mediaUrl)}
                alt="Shared image"
                className="rounded-[18px] max-w-sm w-full object-cover shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(getImageUrl(message.mediaUrl), '_blank')}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  console.error('Failed to load image:', target.src)
                  // Try alternative IPFS gateways
                  if (target.src.includes('gateway.pinata.cloud')) {
                    const hash = target.src.split('/ipfs/')[1]
                    target.src = `https://ipfs.io/ipfs/${hash}`
                  } else if (target.src.includes('ipfs.io')) {
                    const hash = target.src.split('/ipfs/')[1]
                    target.src = `https://cloudflare-ipfs.com/ipfs/${hash}`
                  }
                }}
              />
            )}
            {message.content && message.content !== '📷 Image' && (
              <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
          </div>
        )

      case MessageType.VIDEO:
        return (
          <div className="space-y-2">
            {message.mediaUrl && (
              <video
                controls
                src={message.mediaUrl}
                className="rounded-[18px] max-w-sm w-full shadow-md"
              />
            )}
            {message.content && (
              <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
          </div>
        )

      case MessageType.AUDIO:
        return (
          <div className="space-y-2">
            {message.mediaUrl && (
              <audio controls src={message.mediaUrl} className="w-full" />
            )}
            {message.content && (
              <p className="text-[15px] leading-[1.4]">{message.content}</p>
            )}
          </div>
        )

      case MessageType.FILE:
        return (
          <div className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-lg">📎</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium truncate">
                {message.content || 'File'}
              </p>
              <a
                href={message.mediaUrl}
                download
                className="text-[13px] text-primary hover:underline"
              >
                Download
              </a>
            </div>
          </div>
        )

      default:
        return (
          <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )
    }
  }

  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} mb-2 group`}>
      {/* Avatar - Hidden for cleaner look like screenshot */}
      {!isOwn && showAvatar && <div className="w-0 flex-shrink-0" />}
      {!isOwn && !showAvatar && <div className="w-0 flex-shrink-0" />}

      {/* Message Content */}
      <div className={`flex flex-col max-w-[60%] ${isOwn ? 'items-end' : 'items-start'} relative`}>
        {/* Dropdown menu for own messages */}
        {isOwn && !message.isDeleted && (onDelete || onEdit) && (
          <div className={`absolute -top-2 ${isOwn ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1 hover:bg-muted rounded-full"
                  title="Message options"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
                {onEdit && message.messageType === MessageType.TEXT && (
                  <DropdownMenuItem onClick={() => onEdit(message)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(message)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        {/* Sender name for received messages */}
        {!isOwn && showAvatar && (
          <span className="text-xs text-muted-foreground mb-1 ml-1">
            {senderDisplayName || message.sender.substring(0, 10)}
          </span>
        )}
        
        {/* Message Bubble - Clean Dark Style */}
        {hasMedia ? (
          // Media message: No bubble background, just media + caption
          <div className="space-y-1.5">
            {renderContent()}
          </div>
        ) : (
          // Text/File message: Clean bubble with primary color for own messages
          <div
            className={`px-4 py-2.5 rounded-[18px] ${
              isOwn
                ? customBubbleColor ? '' : 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}
            style={isOwn && customBubbleColor ? {
              backgroundColor: customBubbleColor,
              color: '#ffffff'
            } : undefined}
          >
            {renderContent()}
          </div>
        )}

        {/* Metadata - Clean style */}
        <div className={`flex items-center gap-1.5 mt-1 ml-1 ${isOwn ? 'flex-row-reverse mr-1' : 'flex-row'}`}>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
          {message.isEdited && (
            <span className="text-xs text-muted-foreground">• Edited</span>
          )}
        </div>
      </div>
    </div>
  )
}
