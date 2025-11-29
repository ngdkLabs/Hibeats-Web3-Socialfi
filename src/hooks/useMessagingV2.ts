/**
 * React Hooks untuk Messaging V2
 * Simplified - No encryption, fast & reliable
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { SDK } from '@somnia-chain/streams'
import {
  sendDirectMessageV2,
  fetchDirectMessagesV2,
  editMessageV2,
  deleteMessageV2,
  clearChatV2,
  markAsReadV2
} from '../services/messagingServiceV2'
import {
  MessageType,
  type DirectMessageV2
} from '../lib/messagingSchemasV2'

/**
 * Hook untuk fetch direct messages V2
 */
export function useDirectMessagesV2(
  sdk: SDK | null,
  conversationId: `0x${string}` | null,
  participant1: `0x${string}`,
  participant2: `0x${string}`,
  refreshMs: number = 3000
) {
  const [messages, setMessages] = useState<DirectMessageV2[]>([])
  const [initialLoading, setInitialLoading] = useState(true) // Only for first load
  const [isRefreshing, setIsRefreshing] = useState(false) // Background refresh
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstLoadRef = useRef(true)

  const loadMessages = useCallback(async (showLoading = false) => {
    if (!sdk || !conversationId) {
      setInitialLoading(false)
      return
    }

    try {
      // Only show loading spinner on first load
      if (showLoading && isFirstLoadRef.current) {
        setInitialLoading(true)
      } else {
        setIsRefreshing(true)
      }

      const msgs = await fetchDirectMessagesV2(
        sdk,
        conversationId,
        participant1,
        participant2,
        100
      )
      setMessages(msgs)
      setError(null)
      
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false
      }
    } catch (err: any) {
      console.error('❌ Failed to load messages:', err)
      setError(err.message || 'Failed to load messages')
    } finally {
      setInitialLoading(false)
      setIsRefreshing(false)
    }
  }, [sdk, conversationId, participant1, participant2])

  useEffect(() => {
    if (!sdk || !conversationId) return

    // Initial load with spinner
    loadMessages(true)

    // Background refresh without spinner
    timerRef.current = setInterval(() => loadMessages(false), refreshMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      isFirstLoadRef.current = true // Reset for next mount
    }
  }, [loadMessages, refreshMs, sdk, conversationId])

  return { 
    messages, 
    loading: initialLoading, // Only true on first load
    isRefreshing, // True during background refresh
    error, 
    reload: () => loadMessages(false) // Manual reload without spinner
  }
}

/**
 * Hook untuk send messages V2
 */
export function useSendMessageV2(
  sdk: SDK | null,
  publicClient: any,
  senderAddress: `0x${string}` | null
) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (
    recipientAddress: `0x${string}`,
    content: string,
    messageType: MessageType = MessageType.TEXT,
    mediaUrl: string = '',
    replyToMessageId?: `0x${string}`
  ) => {
    if (!sdk || !senderAddress) {
      throw new Error('SDK or sender not initialized')
    }

    setSending(true)
    setError(null)

    // Start logging
    const { interactionLogger } = await import('@/utils/interactionLogger');
    const logId = interactionLogger.logStart('SEND_MESSAGE', 'USER', {
      recipientAddress,
      content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      contentType: messageType.toString(),
      fromUser: senderAddress,
    });

    try {
      const txHash = await sendDirectMessageV2(
        sdk,
        publicClient,
        senderAddress,
        recipientAddress,
        content,
        messageType,
        mediaUrl,
        replyToMessageId
      );
      
      // Log success
      interactionLogger.logSuccess(logId, txHash || 'N/A', senderAddress);
      
      return txHash;
    } catch (err: any) {
      console.error('❌ Failed to send message:', err);
      const errorMessage = err.message || 'Failed to send message';
      setError(errorMessage);
      
      // Log failure
      interactionLogger.logFailure(logId, err);
      
      throw new Error(errorMessage);
    } finally {
      setSending(false);
    }
  }, [sdk, publicClient, senderAddress])

  return { sendMessage, sending, error }
}

/**
 * Hook untuk edit message V2
 */
export function useEditMessageV2(
  sdk: SDK | null,
  publicClient: any
) {
  const [editing, setEditing] = useState(false)

  const editMessage = useCallback(async (
    messageId: `0x${string}`,
    newContent: string,
    originalMessage: DirectMessageV2
  ) => {
    if (!sdk) throw new Error('SDK not initialized')

    setEditing(true)
    try {
      const txHash = await editMessageV2(
        sdk,
        publicClient,
        messageId,
        newContent,
        originalMessage
      )
      return txHash
    } catch (err: any) {
      console.error('❌ Failed to edit message:', err)
      throw err
    } finally {
      setEditing(false)
    }
  }, [sdk, publicClient])

  return { editMessage, editing }
}

/**
 * Hook untuk delete message V2
 */
export function useDeleteMessageV2(
  sdk: SDK | null,
  publicClient: any
) {
  const [deleting, setDeleting] = useState(false)

  const deleteMessage = useCallback(async (
    messageId: `0x${string}`,
    originalMessage: DirectMessageV2
  ) => {
    if (!sdk) throw new Error('SDK not initialized')

    setDeleting(true)
    try {
      const txHash = await deleteMessageV2(
        sdk,
        publicClient,
        messageId,
        originalMessage
      )
      return txHash
    } catch (err: any) {
      console.error('❌ Failed to delete message:', err)
      throw err
    } finally {
      setDeleting(false)
    }
  }, [sdk, publicClient])

  return { deleteMessage, deleting }
}

/**
 * Hook untuk clear chat V2
 */
export function useClearChatV2(
  sdk: SDK | null,
  publicClient: any,
  currentUserAddress: `0x${string}` | null
) {
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearChat = useCallback(async (
    conversationId: `0x${string}`,
    participant1: `0x${string}`,
    participant2: `0x${string}`
  ) => {
    if (!sdk || !currentUserAddress) {
      throw new Error('SDK or user not initialized')
    }

    setClearing(true)
    setError(null)

    try {
      const txHashes = await clearChatV2(
        sdk,
        publicClient,
        conversationId,
        participant1,
        participant2,
        currentUserAddress
      )
      
      console.log(`✅ Chat cleared, ${txHashes.length} messages deleted`)
      return txHashes
    } catch (err: any) {
      console.error('❌ Failed to clear chat:', err)
      const errorMessage = err.message || 'Failed to clear chat'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setClearing(false)
    }
  }, [sdk, publicClient, currentUserAddress])

  return { clearChat, clearing, error }
}

/**
 * Hook untuk mark as read V2
 */
export function useMarkAsReadV2(
  sdk: SDK | null,
  publicClient: any
) {
  const [marking, setMarking] = useState(false)

  const markAsRead = useCallback(async (
    messageId: `0x${string}`,
    originalMessage: DirectMessageV2
  ) => {
    if (!sdk) throw new Error('SDK not initialized')

    setMarking(true)
    try {
      const txHash = await markAsReadV2(
        sdk,
        publicClient,
        messageId,
        originalMessage
      )
      return txHash
    } catch (err: any) {
      console.error('❌ Failed to mark as read:', err)
      throw err
    } finally {
      setMarking(false)
    }
  }, [sdk, publicClient])

  return { markAsRead, marking }
}
