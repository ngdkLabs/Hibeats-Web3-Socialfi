/**
 * Conversation List Component
 */

import { useState, useEffect } from 'react'
import { SDK } from '@somnia-chain/streams'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Plus, MessageSquare } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { fetchUserConversationsV2 } from '@/services/messagingServiceV2'
import NewConversationDialog from '@/components/messages/NewConversationDialog'
import { generateConversationId } from '@/lib/conversationUtils'
import { useUserProfile } from '@/hooks/useRegisteredUsers'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { getAvatarUrl } from '@/lib/avatarUtils'

interface Conversation {
  id: string
  name: string
  address: string
  avatarHash?: string
  lastMessage: string
  lastMessageTime: number
  unreadCount: number
  isOnline: boolean
  isEncrypted: boolean
}

interface ConversationListProps {
  sdk: SDK | null
  currentUserAddress: string
  selectedConversation: string | null
  onSelectConversation: (id: string, recipientAddress: string) => void
  type: 'direct' | 'groups'
}

export default function ConversationList({
  sdk,
  currentUserAddress,
  selectedConversation,
  onSelectConversation,
  type
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true) // Only show spinner on first load
  const [isRefreshing, setIsRefreshing] = useState(false) // Background refresh indicator

  // Load conversations from blockchain
  useEffect(() => {
    if (!sdk || !currentUserAddress) return

    let isFirstLoad = true

    const loadConversations = async (showLoading = false) => {
      try {
        // Only show loading spinner on first load
        if (showLoading && isFirstLoad) {
          setInitialLoading(true)
        } else {
          setIsRefreshing(true)
        }
        
        // Fetch conversations from blockchain
        const convs = await fetchUserConversationsV2(sdk, currentUserAddress as `0x${string}`)
        
        // Convert to UI format
        const uiConversations: Conversation[] = convs.map(conv => ({
          id: conv.conversationId,
          name: conv.otherParticipant.substring(0, 10) + '...', // Will be updated by profile
          address: conv.otherParticipant,
          lastMessage: conv.lastMessage || 'No messages yet',
          lastMessageTime: conv.lastMessageTime,
          unreadCount: conv.unreadCount,
          isOnline: false, // Will be updated by presence
          isEncrypted: false // V2 is not encrypted
        }))
        
        setConversations(uiConversations)
        
        if (isFirstLoad) {
          isFirstLoad = false
        }
      } catch (error) {
        console.error('Failed to load conversations:', error)
      } finally {
        setInitialLoading(false)
        setIsRefreshing(false)
      }
    }

    // Initial load with spinner
    loadConversations(true)
    
    // Background refresh every 3 seconds (no spinner)
    const interval = setInterval(() => loadConversations(false), 3000)
    return () => clearInterval(interval)
  }, [sdk, currentUserAddress, type])

  const handleNewConversation = (recipientAddress: string, recipientName: string, avatarHash?: string) => {
    console.log('🆕 [CONVERSATION LIST] Creating new conversation')
    console.log('   Recipient:', recipientAddress)
    console.log('   Name:', recipientName)
    
    // Create conversation ID using helper function
    const conversationId = generateConversationId(currentUserAddress, recipientAddress)
    
    console.log('   Conversation ID:', conversationId)
    
    // Add to conversations if not exists
    const exists = conversations.find(c => c.address.toLowerCase() === recipientAddress.toLowerCase())
    if (!exists) {
      const newConv: Conversation = {
        id: conversationId,
        name: recipientName,
        address: recipientAddress,
        avatarHash,
        lastMessage: 'Start chatting...',
        lastMessageTime: Date.now(),
        unreadCount: 0,
        isOnline: false,
        isEncrypted: true
      }
      console.log('   Adding new conversation to list')
      setConversations(prev => [newConv, ...prev])
    } else {
      console.log('   Conversation already exists, selecting it')
    }
    
    // Select the conversation and open chat
    console.log('   Opening chat window...')
    onSelectConversation(conversationId, recipientAddress)
    setShowNewDialog(false)
  }

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    return `${days}d`
  }

  return (
    <>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-10 bg-muted/50 border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
        />
      </div>

      {/* New Conversation Button - Hidden, use dialog trigger in header if needed */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="bg-[#1a1625] border-white/10 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-[20px] font-semibold">
              New Message
            </DialogTitle>
          </DialogHeader>
          <NewConversationDialog
            sdk={sdk}
            currentUserAddress={currentUserAddress}
            type={type}
            onClose={() => setShowNewDialog(false)}
            onCreateConversation={handleNewConversation}
          />
        </DialogContent>
      </Dialog>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto -mx-4 scrollbar-custom">
        {initialLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              Start a new conversation to begin messaging
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={selectedConversation === conv.id}
              onSelect={() => onSelectConversation(conv.id, conv.address)}
              formatTime={formatTime}
            />
          ))
        )}
      </div>
    </>
  )
}

/**
 * Conversation Item Component with Profile Loading
 */
function ConversationItem({ 
  conversation, 
  isSelected, 
  onSelect, 
  formatTime 
}: { 
  conversation: Conversation
  isSelected: boolean
  onSelect: () => void
  formatTime: (timestamp: number) => string
}) {
  const { profile, loading } = useUserProfile(conversation.address as `0x${string}`)

  const displayName = loading 
    ? conversation.name 
    : (profile?.displayName || conversation.address.substring(0, 10) + '...')
  
  // Profile loaded - no need to log in production

  return (
    <button
      onClick={onSelect}
      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-all relative border-l-2 ${
        isSelected ? 'bg-primary/5 border-l-primary' : 'border-l-transparent'
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="w-11 h-11">
          <AvatarImage 
            src={getAvatarUrl(profile?.avatarHash)}
            alt={displayName}
          />
          <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
            {displayName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {profile?.isOnline && (
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-sm truncate text-foreground">
            {displayName}
          </h3>
          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
            {formatTime(conversation.lastMessageTime)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate leading-tight">
            {conversation.lastMessage}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="ml-2 min-w-[18px] h-[18px] px-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
