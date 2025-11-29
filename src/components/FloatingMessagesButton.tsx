/**
 * Floating Messages Button Component (Instagram-style)
 * Shows at bottom-right corner with unread count and recent avatars
 * Opens a popup with all conversations when clicked
 */

import { useState, useEffect } from 'react'
import { SDK } from '@somnia-chain/streams'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Send, X, Maximize2, Loader2, ChevronLeft } from 'lucide-react'
import { fetchUserConversationsV2 } from '@/services/messagingServiceV2'
import { getAvatarUrl } from '@/lib/avatarUtils'
import { useUserProfile } from '@/hooks/useRegisteredUsers'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import ChatWindow from '@/components/messages/ChatWindow'

interface FloatingMessagesButtonProps {
  currentUserAddress: string | null
}

interface Conversation {
  conversationId: string
  otherParticipant: string
  lastMessage: string
  lastMessageTime: number
  unreadCount: number
}

export default function FloatingMessagesButton({
  currentUserAddress
}: FloatingMessagesButtonProps) {
  const { connector } = useAccount()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [allConversations, setAllConversations] = useState<Conversation[]>([])
  const [sdk, setSdk] = useState<SDK | null>(null)
  
  // Calculate total unread count from all conversations
  const unreadCount = allConversations.reduce((sum, conv) => sum + conv.unreadCount, 0)
  const [publicClient, setPublicClient] = useState<any>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const navigate = useNavigate()

  // Initialize SDK and publicClient with wallet support
  useEffect(() => {
    if (!currentUserAddress || !connector) return

    const initSDK = async () => {
      try {
        console.log('🔧 [FLOATING MESSAGES] Initializing SDK with wallet...')
        const { createPublicClient, createWalletClient, http, custom } = await import('viem')
        const { somniaTestnet } = await import('@/lib/web3-config')
        
        const rpcUrl = somniaTestnet.rpcUrls.default.http[0]
        
        // Create public client
        const pubClient = createPublicClient({
          chain: somniaTestnet,
          transport: http(rpcUrl)
        })
        
        setPublicClient(pubClient)
        
        // Create wallet client for sending messages
        let walletClient: any
        try {
          const provider = await connector.getProvider() as any
          
          if (provider) {
            walletClient = createWalletClient({
              account: currentUserAddress as `0x${string}`,
              chain: somniaTestnet,
              transport: custom(provider as any)
            }) as any
            console.log('✅ [FLOATING MESSAGES] Wallet client created with connector')
          } else if ((window as any).ethereum) {
            walletClient = createWalletClient({
              account: currentUserAddress as `0x${string}`,
              chain: somniaTestnet,
              transport: custom((window as any).ethereum as any)
            }) as any
            console.log('✅ [FLOATING MESSAGES] Wallet client created with window.ethereum')
          }
        } catch (error) {
          console.error('❌ [FLOATING MESSAGES] Error getting provider:', error)
          if ((window as any).ethereum) {
            walletClient = createWalletClient({
              account: currentUserAddress as `0x${string}`,
              chain: somniaTestnet,
              transport: custom((window as any).ethereum as any)
            }) as any
            console.log('✅ [FLOATING MESSAGES] Wallet client created (fallback)')
          }
        }

        if (!walletClient) {
          console.error('❌ [FLOATING MESSAGES] Failed to create wallet client')
          return
        }
        
        // Create SDK with wallet support
        const newSdk = new SDK({
          public: pubClient,
          wallet: walletClient
        } as any)
        
        setSdk(newSdk)
        console.log('✅ [FLOATING MESSAGES] SDK initialized with wallet support')
      } catch (error) {
        console.error('❌ [FLOATING MESSAGES] Failed to initialize SDK:', error)
      }
    }

    initSDK()
  }, [currentUserAddress, connector])

  // Load conversations in background
  useEffect(() => {
    if (!sdk || !currentUserAddress) return

    const loadConversations = async (isInitialLoad = false) => {
      try {
        // Only show loading on initial load when modal is opened
        if (isInitialLoad && isOpen && allConversations.length === 0) {
          setLoading(true)
        }
        
        const convs = await fetchUserConversationsV2(sdk, currentUserAddress as `0x${string}`)
        
        // Store all conversations
        setAllConversations(convs)
        
        // Take only 3 most recent for button preview
        setConversations(convs.slice(0, 3))
      } catch (error) {
        console.error('Failed to load conversations:', error)
      } finally {
        setLoading(false)
      }
    }

    // Initial load
    loadConversations(true)
    
    // Background refresh every 10 seconds (no loading indicator)
    const interval = setInterval(() => loadConversations(false), 10000)
    return () => clearInterval(interval)
  }, [sdk, currentUserAddress, isOpen])

  if (!currentUserAddress) return null

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
      {/* Popup Chat List or Chat Detail */}
      {isOpen && (
        <div className="fixed bottom-32 right-6 z-50 w-[420px] h-[600px] max-h-[calc(100vh-14rem)]">
          <Card className="bg-card/98 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl overflow-hidden h-full flex flex-col">
            {selectedConversation ? (
              /* Chat Detail View */
              <>
                {/* Chat Header */}
                <ChatHeader
                  conversation={selectedConversation}
                  onBack={() => setSelectedConversation(null)}
                  onMaximize={() => {
                    navigate(`/messages?conversation=${selectedConversation.conversationId}`)
                    setIsOpen(false)
                    setSelectedConversation(null)
                  }}
                  onClose={() => {
                    setIsOpen(false)
                    setSelectedConversation(null)
                  }}
                />
                
                {/* Chat Window */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <ChatWindow
                    conversationId={selectedConversation.conversationId}
                    recipientAddress={selectedConversation.otherParticipant as `0x${string}`}
                    sdk={sdk}
                    publicClient={publicClient}
                    currentUserAddress={currentUserAddress as `0x${string}`}
                    type="direct"
                    hideHeader={true}
                    onMessageSent={() => {
                      // Reload conversations after message sent
                      if (sdk && currentUserAddress) {
                        fetchUserConversationsV2(sdk, currentUserAddress as `0x${string}`)
                          .then(convs => {
                            setAllConversations(convs)
                            setConversations(convs.slice(0, 3))
                          })
                          .catch(err => console.error('Failed to reload conversations:', err))
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              /* Conversations List View */
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">Messages</h3>
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-8 h-8 p-0 hover:bg-muted"
                      onClick={() => navigate('/messages')}
                      title="Open in full page"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-8 h-8 p-0 hover:bg-muted"
                      onClick={() => setIsOpen(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Conversations List */}
                <div className="flex-1 overflow-y-auto relative">
                  {/* Background loading indicator - subtle and non-blocking */}
                  {loading && allConversations.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-card/50 backdrop-blur-sm z-10">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <p className="text-xs text-muted-foreground">Loading messages...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Show conversations immediately if available */}
                  {allConversations.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <Send className="w-12 h-12 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground font-medium">No messages yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Start a conversation with other users
                      </p>
                    </div>
                  ) : (
                    <>
                      {allConversations.map((conv) => (
                        <ConversationItem
                          key={conv.conversationId}
                          conversation={conv}
                          formatTime={formatTime}
                          onClick={() => setSelectedConversation(conv)}
                        />
                      ))}
                      
                      {/* Subtle refresh indicator at bottom when loading in background */}
                      {loading && allConversations.length > 0 && (
                        <div className="flex items-center justify-center py-2 border-t border-border/30">
                          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Floating Button - Hidden when modal is open */}
      {!isOpen && (
        <div className="fixed bottom-32 right-6 z-50">
          <Button
            onClick={() => setIsOpen(!isOpen)}
          className="h-14 px-5 rounded-full bg-black/20 hover:bg-black/30 shadow-lg backdrop-blur-xl transition-all duration-200 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
          }}
        >
          <div className="flex items-center gap-3">
            {/* Icon with badge */}
            <div className="relative">
              <Send className="w-5 h-5 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>

            {/* Text */}
            <span className="font-medium text-foreground">Messages</span>

            {/* Recent avatars */}
            {conversations.length > 0 && (
              <div className="flex -space-x-2">
                {conversations.map((conv, index) => (
                  <RecentAvatar
                    key={conv.conversationId}
                    address={conv.otherParticipant}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>
        </Button>
        </div>
      )}
    </>
  )
}

/**
 * Chat Header Component
 */
function ChatHeader({
  conversation,
  onBack,
  onMaximize,
  onClose
}: {
  conversation: Conversation
  onBack: () => void
  onMaximize: () => void
  onClose: () => void
}) {
  const { profile } = useUserProfile(conversation.otherParticipant as `0x${string}`)
  const displayName = profile?.displayName || conversation.otherParticipant.substring(0, 10) + '...'

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 hover:bg-muted"
          onClick={onBack}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <Avatar className="w-10 h-10">
          <AvatarImage src={getAvatarUrl(profile?.avatarHash)} alt={displayName} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-sm truncate">{displayName}</h4>
            {profile?.isVerified && <VerifiedBadge size="sm" />}
          </div>
          {profile?.isOnline && (
            <p className="text-xs text-green-500">Online</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 hover:bg-muted"
          onClick={onMaximize}
          title="Open in full page"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 hover:bg-muted"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

/**
 * Conversation Item Component
 */
function ConversationItem({
  conversation,
  formatTime,
  onClick
}: {
  conversation: Conversation
  formatTime: (timestamp: number) => string
  onClick: () => void
}) {
  const { profile } = useUserProfile(conversation.otherParticipant as `0x${string}`)
  const displayName = profile?.displayName || conversation.otherParticipant.substring(0, 10) + '...'
  const hasUnread = conversation.unreadCount > 0

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/30 last:border-0"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="w-14 h-14">
          <AvatarImage src={getAvatarUrl(profile?.avatarHash)} alt={displayName} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {profile?.isOnline && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-card rounded-full" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <h4 className={`text-sm truncate ${hasUnread ? 'font-bold' : 'font-medium'}`}>
              {displayName}
            </h4>
            {profile?.isVerified && <VerifiedBadge size="sm" />}
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
            {formatTime(conversation.lastMessageTime)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-sm truncate ${hasUnread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            {conversation.lastMessage}
          </p>
          {hasUnread && (
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 ml-2" />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Recent Avatar Component
 */
function RecentAvatar({ address, index }: { address: string; index: number }) {
  const { profile } = useUserProfile(address as `0x${string}`)
  const displayName = profile?.displayName || address.substring(0, 10)

  return (
    <Avatar 
      className="w-8 h-8 border-2 border-card ring-1 ring-border/20"
      style={{ zIndex: 3 - index }}
    >
      <AvatarImage src={getAvatarUrl(profile?.avatarHash)} alt={displayName} />
      <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
        {displayName.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
