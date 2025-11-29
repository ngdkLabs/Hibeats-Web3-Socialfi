/**
 * Typing Indicator Component
 * Shows animated dots when user is typing
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAvatarUrl } from '@/lib/avatarUtils'

interface TypingIndicatorProps {
  userAddress: string
  userName?: string
  showAvatar?: boolean
  avatarHash?: string
}

export default function TypingIndicator({ 
  userAddress, 
  userName, 
  showAvatar = true,
  avatarHash 
}: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-3 mb-2 animate-fade-in">
      {showAvatar && (
        <Avatar className="w-8 h-8 flex-shrink-0 border border-white/10">
          <AvatarImage 
            src={getAvatarUrl(avatarHash)}
            alt={userName || 'User'}
          />
          <AvatarFallback className="bg-lime-400/10 text-lime-400 text-xs font-semibold">
            {(userName || userAddress).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className="bg-[#2a2435] border border-white/10 rounded-[18px] rounded-bl-sm px-4 py-3">
        <div className="flex items-center gap-1">
          <span 
            className="w-2 h-2 bg-lime-400 rounded-full animate-bounce" 
            style={{ animationDelay: '0ms', animationDuration: '1s' }} 
          />
          <span 
            className="w-2 h-2 bg-lime-400 rounded-full animate-bounce" 
            style={{ animationDelay: '150ms', animationDuration: '1s' }} 
          />
          <span 
            className="w-2 h-2 bg-lime-400 rounded-full animate-bounce" 
            style={{ animationDelay: '300ms', animationDuration: '1s' }} 
          />
        </div>
      </div>
      
      {userName && (
        <span className="text-xs text-gray-500">
          {userName} is typing...
        </span>
      )}
    </div>
  )
}
