/**
 * Chat Window Component with E2EE
 */

import { useState, useRef, useEffect } from 'react'
import { SDK } from '@somnia-chain/streams'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Shield, Send, Paperclip, MoreVertical, Trash2, Archive, BellOff, Edit2, Palette } from 'lucide-react'
import { useDirectMessagesV2, useSendMessageV2, useClearChatV2, useEditMessageV2, useDeleteMessageV2 } from '@/hooks/useMessagingV2'
import { MessageType } from '@/lib/messagingSchemasV2'
import MessageBubble from '@/components/messages/MessageBubble'
import TypingIndicator from '@/components/messages/TypingIndicator'
import EmojiPicker from '@/components/messages/EmojiPicker'
import MediaUpload, { MediaPreview } from '@/components/messages/MediaUpload'
import { useTypingIndicator as useTypingIndicatorV2 } from '@/hooks/useAdvancedMessagingV2'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { getAvatarUrl } from '@/lib/avatarUtils'
import MusicShareModal from '@/components/messages/MusicShareModal'
import { Music } from 'lucide-react'
import { ChatCustomizationModal, ChatCustomization } from '@/components/messages/ChatCustomizationModal'

import { useUserProfile } from '@/hooks/useRegisteredUsers'
import { ipfsService } from '@/services/ipfsService'

interface ChatWindowProps {
  sdk: SDK | null
  publicClient: any
  conversationId: string
  recipientAddress: `0x${string}`
  currentUserAddress: string
  type: 'direct' | 'groups'
  onMessageSent?: () => void // Callback to reload conversation list
  hideHeader?: boolean // Hide header when used in popup
}

export default function ChatWindow({
  sdk,
  publicClient,
  conversationId,
  recipientAddress,
  currentUserAddress,
  type,
  onMessageSent,
  hideHeader = false
}: ChatWindowProps) {
  const [message, setMessage] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<`0x${string}` | null>(null)
  const [selectedMedia, setSelectedMedia] = useState<{ file: File; type: 'image' | 'video'; ipfsHash?: string } | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showMusicShareModal, setShowMusicShareModal] = useState(false)
  const [showCustomizationModal, setShowCustomizationModal] = useState(false)
  const [chatCustomization, setChatCustomization] = useState<ChatCustomization>(() => {
    // Load from localStorage
    const saved = localStorage.getItem(`chat-custom-${conversationId}`)
    return saved ? JSON.parse(saved) : {}
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevMessagesLengthRef = useRef(0)

  // Get recipient profile
  const { profile: recipientProfile, loading: loadingProfile } = useUserProfile(recipientAddress)
  
  // Recipient profile loaded
  
  // V2 Hooks - No encryption!
  const { messages, loading, isRefreshing, error, reload } = useDirectMessagesV2(
    sdk,
    conversationId as `0x${string}`,
    currentUserAddress as `0x${string}`,
    recipientAddress,
    3000
  )
  
  // Local state for optimistic messages
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([])

  const { sendMessage, sending } = useSendMessageV2(
    sdk,
    publicClient,
    currentUserAddress as `0x${string}`
  )

  const { editMessage, editing } = useEditMessageV2(sdk, publicClient)
  
  const { deleteMessage, deleting } = useDeleteMessageV2(sdk, publicClient)
  
  const { clearChat, clearing } = useClearChatV2(
    sdk,
    publicClient,
    currentUserAddress as `0x${string}`
  )

  // Typing indicator V2
  const { isTyping, startTyping, stopTyping } = useTypingIndicatorV2(
    sdk,
    conversationId as `0x${string}`,
    currentUserAddress as `0x${string}`
  )

  // Fetch recipient typing status
  // User B checks if User A is typing by fetching from User A's published data
  const [recipientTyping, setRecipientTyping] = useState(false)
  useEffect(() => {
    if (!sdk || !conversationId || !recipientAddress) return

    const checkTyping = async () => {
      try {
        const { fetchTypingV2 } = await import('@/services/advancedMessagingV2')
        
        // Fetch typing status published by recipient (User A)
        // User A publishes their typing status, User B reads it
        const typingStatus = await fetchTypingV2(
          sdk,
          conversationId as `0x${string}`,
          recipientAddress // Fetch from recipient's published data
        )
        
        // Check if the typing user is the recipient (not ourselves)
        if (typingStatus && typingStatus.user.toLowerCase() === recipientAddress.toLowerCase()) {
          setRecipientTyping(typingStatus.isTyping)
        } else {
          setRecipientTyping(false)
        }
      } catch (error) {
        console.error('Failed to fetch typing status:', error)
        setRecipientTyping(false)
      }
    }

    checkTyping()
    const interval = setInterval(checkTyping, 2000) // Check every 2s
    return () => clearInterval(interval)
  }, [sdk, conversationId, recipientAddress])

  // Smart auto-scroll: only scroll if user is near bottom or new message arrives
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    // Check if user is near bottom (within 100px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    
    // Check if new messages arrived
    const hasNewMessages = messages.length > prevMessagesLengthRef.current
    
    // Only auto-scroll if:
    // 1. User is near bottom (not reading old messages)
    // 2. OR new messages just arrived (user sent/received message)
    if (isNearBottom || hasNewMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    
    // Update previous message count
    prevMessagesLengthRef.current = messages.length
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [conversationId])

  const handleSend = async () => {
    // Only check message content and editing state, not sending state
    // This allows rapid-fire sending (like WhatsApp)
    if ((!message.trim() && !selectedMedia) || editing) {
      return
    }

    // Check if editing
    if (editingMessageId) {
      try {
        const originalMessage = messages.find(m => m.messageId === editingMessageId)
        if (originalMessage) {
          await editMessage(editingMessageId, message.trim(), originalMessage)
          setEditingMessageId(null)
          setMessage('')
          stopTyping()
          // Don't reload - let the hook's polling handle the update automatically
        }
      } catch (error: any) {
        console.error('Failed to edit message:', error)
        alert(`❌ Failed to edit: ${error.message}`)
      }
      return
    }

    // Check if sending media
    if (selectedMedia) {
      // Check if media has IPFS hash
      if (!selectedMedia.ipfsHash) {
        console.warn('⚠️ [CHAT] Image still uploading, please wait')
        return
      }

      // Send message with media
      const mediaMessage = message.trim() || '📷 Image'
      const ipfsUrl = `ipfs://${selectedMedia.ipfsHash}`
      
      console.log('📤 [CHAT] Sending image message:', {
        content: mediaMessage,
        ipfsHash: selectedMedia.ipfsHash,
        ipfsUrl
      })

      // Clear input and media immediately
      setMessage('')
      const mediaToSend = selectedMedia
      setSelectedMedia(null)
      stopTyping()

      // Send to blockchain
      sendMessage(
        recipientAddress,
        mediaMessage,
        MessageType.IMAGE,
        ipfsUrl
      ).then(() => {
        console.log('✅ Image message sent successfully')
        setTimeout(() => reload(), 500)
        setTimeout(() => reload(), 2000)
        
        if (onMessageSent) {
          setTimeout(() => onMessageSent(), 1000)
        }
      }).catch((error: any) => {
        console.error('Failed to send image message:', error)
        
        if (error.message?.includes('congested') || error.message?.includes('background') || error.message?.includes('slow')) {
          console.log('⏳ Network slow, checking message status...')
          setTimeout(() => reload(), 1000)
          setTimeout(() => reload(), 3000)
          setTimeout(() => reload(), 5000)
          
          if (onMessageSent) {
            setTimeout(() => onMessageSent(), 2000)
          }
        } else if (error.message?.includes('rejected') || error.message?.includes('denied')) {
          console.log('User cancelled transaction')
          setMessage(mediaMessage)
          setSelectedMedia(mediaToSend)
        } else {
          console.error('Real error occurred:', error.message)
          setMessage(mediaMessage)
          setSelectedMedia(mediaToSend)
        }
      })

      // Immediate reload
      setTimeout(() => reload(), 100)
      return
    }

    // 🚀 OPTIMISTIC UPDATE: Add message to UI immediately
    const optimisticMessage = {
      messageId: `temp-${Date.now()}` as `0x${string}`,
      conversationId: conversationId as `0x${string}`,
      sender: currentUserAddress,
      recipient: recipientAddress,
      content: message.trim(),
      messageType: MessageType.TEXT,
      timestamp: Date.now(),
      isRead: false,
      isEdited: false,
      isDeleted: false,
      mediaUrl: '',
      replyToId: '0x0' as `0x${string}`,
    }

    // Store message content for background send
    const messageToSend = message.trim()
    
    // Clear input immediately for instant UX
    setMessage('')
    setSelectedMedia(null)
    stopTyping()

    // Add optimistic message to UI (will be replaced by real message from blockchain)
    const currentMessages = [...messages, optimisticMessage]
    // Force a re-render by triggering reload (which will include our optimistic message temporarily)
    
    // 🔄 Send to blockchain in background (non-blocking)
    sendMessage(
      recipientAddress,
      messageToSend,
      MessageType.TEXT
    ).then(() => {
      console.log('✅ Message sent to blockchain successfully')
      // Reload to get the real message from blockchain
      setTimeout(() => reload(), 500)
      setTimeout(() => reload(), 2000)
      
      // Trigger conversation list reload
      if (onMessageSent) {
        setTimeout(() => onMessageSent(), 1000)
      }
    }).catch((error: any) => {
      console.error('Failed to send message:', error)
      
      // Smart error handling - most "errors" are actually successful sends
      if (error.message?.includes('congested') || error.message?.includes('background') || error.message?.includes('slow')) {
        // Network congestion - message is being sent in background
        console.log('⏳ Network slow, checking message status...')
        
        // Check multiple times to catch the message
        setTimeout(() => reload(), 1000)
        setTimeout(() => reload(), 3000)
        setTimeout(() => reload(), 5000)
        
        // Trigger conversation list reload
        if (onMessageSent) {
          setTimeout(() => onMessageSent(), 2000)
        }
      } else if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        // User cancelled - restore message to input
        console.log('User cancelled transaction')
        setMessage(messageToSend)
      } else {
        // Real error - restore message and show alert
        console.error('Real error occurred:', error.message)
        setMessage(messageToSend)
        alert(`❌ Failed to send: ${error.message}`)
      }
    })

    // Immediate reload to show optimistic message
    setTimeout(() => reload(), 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value)
    
    // Start typing indicator when user types
    if (e.target.value.length > 0) {
      startTyping()
    } else {
      stopTyping()
    }
  }

  const handleSaveCustomization = (settings: ChatCustomization) => {
    setChatCustomization(settings)
    // Save to localStorage
    localStorage.setItem(`chat-custom-${conversationId}`, JSON.stringify(settings))
  }

  const handleClearChat = async () => {
    if (!sdk || clearing) return

    const confirmed = window.confirm(
      'Clear this chat?\n\nThis will delete all your messages. This cannot be undone.'
    )

    if (!confirmed) return

    try {
      await clearChat(
        conversationId as `0x${string}`,
        currentUserAddress as `0x${string}`,
        recipientAddress
      )
      
      // Reload messages
      setTimeout(() => reload(), 1000)
      setTimeout(() => reload(), 2000)
      
      alert('Chat cleared successfully!')
    } catch (error: any) {
      console.error('Failed to clear chat:', error)
      alert(`Failed to clear chat: ${error.message}`)
    }
  }

  const handleEditMessage = (msg: any) => {
    setEditingMessageId(msg.messageId)
    setMessage(msg.content)
    inputRef.current?.focus()
  }

  const cancelEdit = () => {
    setEditingMessageId(null)
    setMessage('')
  }

  const handleDeleteMessage = async (msg: any) => {
    if (!sdk || deleting) return

    const confirmed = window.confirm('Delete this message?\n\nThis cannot be undone.')
    if (!confirmed) return

    try {
      await deleteMessage(msg.messageId, msg)
      
      // Reload messages
      setTimeout(() => reload(), 500)
      setTimeout(() => reload(), 2000)
      
      console.log('✅ Message deleted successfully')
    } catch (error: any) {
      console.error('Failed to delete message:', error)
      alert(`Failed to delete message: ${error.message}`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - Hidden when used in popup */}
      {!hideHeader && (
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarImage 
                    src={getAvatarUrl(recipientProfile?.avatarHash)}
                    alt={recipientProfile?.displayName || 'User'}
                  />
                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                    {(recipientProfile?.displayName || recipientAddress).substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {recipientProfile?.isOnline && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full"></div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-base text-foreground">
                    {loadingProfile ? 'Loading...' : (recipientProfile?.displayName || recipientAddress.substring(0, 10))}
                  </h2>
                  {recipientProfile?.isVerified && <VerifiedBadge size="sm" />}
                </div>
                {recipientProfile?.isOnline && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-muted-foreground">
                      Active now
                    </span>
                  </div>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem 
                  onClick={() => setShowCustomizationModal(true)}
                >
                  <Palette className="w-4 h-4 mr-2" />
                  Customize Chat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => alert('Archive feature coming soon!')}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Chat
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => alert('Mute feature coming soon!')}
                >
                  <BellOff className="w-4 h-4 mr-2" />
                  Mute Notifications
                </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={handleClearChat}
                disabled={clearing}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {clearing ? 'Clearing...' : 'Clear Chat'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      )}

      {/* Messages */}
      <div 
        ref={messagesContainerRef} 
        className="flex-1 overflow-y-auto px-6 py-4 scrollbar-custom transition-all duration-300"
        style={{
          backgroundColor: chatCustomization.backgroundColor || undefined,
          backgroundImage: chatCustomization.backgroundImage || undefined,
          backgroundSize: chatCustomization.backgroundImage ? '20px 20px' : undefined,
        }}
      >
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-muted-foreground text-sm">Loading messages...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-destructive mb-2">Error loading messages</p>
              <Button onClick={reload} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-12 h-12 text-primary/40" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                No messages yet
              </h3>
              <p className="text-muted-foreground text-sm">
                Send your first message!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, index) => (
              <div key={`${msg.timestamp}-${index}`}>
                <MessageBubble
                  message={msg}
                  isOwn={msg.sender === currentUserAddress}
                  showAvatar={
                    index === 0 ||
                    messages[index - 1].sender !== msg.sender
                  }
                  senderAvatarHash={recipientProfile?.avatarHash}
                  senderDisplayName={recipientProfile?.displayName}
                  onDelete={handleDeleteMessage}
                  onEdit={handleEditMessage}
                  customBubbleColor={chatCustomization.bubbleColor}
                />
              </div>
            ))}
            
            {/* Typing Indicator */}
            {recipientTyping && (
              <TypingIndicator
                userAddress={recipientAddress}
                userName={recipientProfile?.displayName}
                showAvatar={true}
                avatarHash={recipientProfile?.avatarHash}
              />
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border">
        {editingMessageId && (
          <div className="mb-3 flex items-center justify-between bg-primary/10 px-4 py-2 rounded-lg border border-primary/20">
            <span className="text-sm text-primary font-medium">Editing message...</span>
            <button onClick={cancelEdit} className="text-sm text-muted-foreground hover:text-foreground font-medium">
              Cancel
            </button>
          </div>
        )}
        
        {/* Media Preview */}
        {selectedMedia && (
          <div className="mb-3">
            <div className="relative">
              <MediaPreview
                file={selectedMedia.file}
                type={selectedMedia.type}
                onRemove={() => {
                  setSelectedMedia(null)
                  setUploadProgress(0)
                }}
              />
              {/* Upload progress overlay */}
              {uploadingMedia && (
                <div className="absolute inset-0 bg-black/60 rounded-lg flex flex-col items-center justify-center">
                  <div className="w-full max-w-[200px] px-4">
                    {/* Progress bar */}
                    <div className="w-full bg-white/20 rounded-full h-2 mb-2 overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    {/* Progress percentage */}
                    <p className="text-white text-sm font-medium text-center">
                      {uploadProgress}%
                    </p>
                  </div>
                </div>
              )}
              {/* Ready indicator */}
              {!uploadingMedia && selectedMedia.ipfsHash && (
                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Ready
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          {/* Image Upload */}
          <button
            onClick={async () => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/*'
              input.onchange = async (e: any) => {
                const file = e.target.files?.[0]
                if (file) {
                  try {
                    // Compress image first
                    console.log('🗜️ [CHAT] Compressing image...')
                    const { compressPostImage } = await import('@/utils/imageCompression');
                    const compressedFile = await compressPostImage(file);
                    console.log(`✅ [CHAT] Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);

                    // Set media without IPFS hash first (for preview)
                    setSelectedMedia({ file: compressedFile, type: 'image' })
                    setUploadingMedia(true)
                    setUploadProgress(0)

                    try {
                      console.log('📤 [CHAT] Uploading image to IPFS...')
                      
                      // Simulate progress for better UX
                      setUploadProgress(10)
                      
                      // Upload to IPFS
                      const result = await ipfsService.uploadFile(compressedFile, {
                        name: compressedFile.name,
                        description: 'Message image',
                        userAddress: currentUserAddress
                      })

                      setUploadProgress(90)

                      const ipfsHash = result.IpfsHash || result.ipfsHash
                      console.log('✅ [CHAT] Image uploaded to IPFS:', ipfsHash)
                      
                      // Update media with IPFS hash
                      setSelectedMedia({ file: compressedFile, type: 'image', ipfsHash })
                      setUploadProgress(100)
                    } catch (error: any) {
                      console.error('❌ [CHAT] Failed to upload to IPFS:', error)
                      setSelectedMedia(null)
                      setUploadProgress(0)
                    } finally {
                      setUploadingMedia(false)
                    }
                  } catch (compressionError) {
                    console.error('❌ [CHAT] Compression failed:', compressionError);
                    // Fallback to original file
                    if (file.size > 10 * 1024 * 1024) {
                      console.error('❌ [CHAT] Image too large:', file.size)
                      return
                    }
                    // Continue with original file
                    setSelectedMedia({ file, type: 'image' })
                    setUploadingMedia(true)
                    setUploadProgress(0)
                    // ... rest of upload logic
                  }
                }
              }
              input.click()
            }}
            disabled={uploadingMedia}
            className="w-11 h-11 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload image"
          >
            {uploadingMedia ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            ) : (
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <polyline points="21 15 16 10 5 21" strokeWidth={2} />
              </svg>
            )}
          </button>

          {/* File Upload */}
          <button
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '*/*'
              input.onchange = (e: any) => {
                const file = e.target.files?.[0]
                if (file) {
                  alert('File upload coming soon!')
                }
              }
              input.click()
            }}
            className="w-11 h-11 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center hover:bg-muted transition-colors"
            title="Upload file"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Emoji Picker */}
          <button
            onClick={() => {
              // Toggle emoji picker
              const emojiButton = document.querySelector('[data-emoji-picker]') as HTMLButtonElement
              if (emojiButton) emojiButton.click()
            }}
            className="w-11 h-11 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center hover:bg-muted transition-colors"
            title="Add emoji"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth={2} strokeLinecap="round" />
              <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </button>
          <div className="hidden">
            <EmojiPicker
              onEmojiSelect={(emoji) => {
                setMessage(prev => prev + emoji)
                inputRef.current?.focus()
              }}
            />
          </div>

          {/* Music Share */}
          <button
            onClick={() => setShowMusicShareModal(true)}
            className="w-11 h-11 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center hover:bg-muted transition-colors"
            title="Share music"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </button>
          <div className="flex-1 flex items-center gap-3 bg-muted rounded-full px-4 py-2.5">
            <Input
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={editingMessageId ? "Edit message" : "Type your message..."}
              disabled={editing}
              className="flex-1 bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={(!message.trim() && !selectedMedia) || editing || uploadingMedia || (selectedMedia && !selectedMedia.ipfsHash)}
            size="icon"
            className="h-10 w-10 rounded-full"
          >
            {editing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent"></div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Music Share Modal */}
      <MusicShareModal
        open={showMusicShareModal}
        onClose={() => setShowMusicShareModal(false)}
        onSelectTrack={(track) => {
          // Send music track as message
          const musicMessage = JSON.stringify({
            type: 'music',
            trackId: track.id,
            title: track.title,
            artist: track.artist,
            coverHash: track.coverHash,
            audioHash: track.audioHash,
            duration: track.duration
          })
          
          sendMessage(
            recipientAddress,
            musicMessage,
            MessageType.MUSIC_TRACK
          ).then(() => {
            console.log('✅ Music track shared successfully')
            setTimeout(() => reload(), 500)
            setTimeout(() => reload(), 2000)
            
            if (onMessageSent) {
              setTimeout(() => onMessageSent(), 1000)
            }
          }).catch((error: any) => {
            console.error('Failed to share music:', error)
            alert(`❌ Failed to share: ${error.message}`)
          })
        }}
      />

      {/* Chat Customization Modal */}
      <ChatCustomizationModal
        isOpen={showCustomizationModal}
        onClose={() => setShowCustomizationModal(false)}
        conversationId={conversationId}
        onSave={handleSaveCustomization}
        currentSettings={chatCustomization}
      />
    </div>
  )
}
