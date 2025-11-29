/**
 * React Hooks for Advanced Messaging Features V2
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { SDK } from '@somnia-chain/streams'
import {
  addReactionV2,
  removeReactionV2,
  fetchReactionsV2,
  setTypingV2,
  fetchTypingV2,
  updatePresenceV2,
  fetchPresenceV2,
  pinMessageV2,
  unpinMessageV2,
  fetchPinnedMessagesV2
} from '../services/advancedMessagingV2'
import { UserStatus } from '../lib/messagingSchemasV2'

/**
 * Hook for message reactions
 */
export function useMessageReactions(
  sdk: SDK | null,
  publicClient: any,
  messageId: `0x${string}` | null,
  publisher: `0x${string}`
) {
  const [reactions, setReactions] = useState<Array<{ emoji: string; reactor: `0x${string}`; timestamp: number }>>([])
  const [loading, setLoading] = useState(false)

  const loadReactions = useCallback(async () => {
    if (!sdk || !messageId) return

    setLoading(true)
    try {
      const data = await fetchReactionsV2(sdk, messageId, publisher)
      setReactions(data)
    } catch (error) {
      console.error('Failed to load reactions:', error)
    } finally {
      setLoading(false)
    }
  }, [sdk, messageId, publisher])

  const addReaction = useCallback(async (emoji: string, reactorAddress: `0x${string}`) => {
    if (!sdk || !messageId) return

    try {
      await addReactionV2(sdk, publicClient, messageId, reactorAddress, emoji)
      await loadReactions()
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }, [sdk, publicClient, messageId, loadReactions])

  const removeReaction = useCallback(async (emoji: string, reactorAddress: `0x${string}`) => {
    if (!sdk || !messageId) return

    try {
      await removeReactionV2(sdk, publicClient, messageId, reactorAddress, emoji)
      await loadReactions()
    } catch (error) {
      console.error('Failed to remove reaction:', error)
    }
  }, [sdk, publicClient, messageId, loadReactions])

  useEffect(() => {
    loadReactions()
  }, [loadReactions])

  return { reactions, loading, addReaction, removeReaction, reload: loadReactions }
}

/**
 * Hook for typing indicator
 */
export function useTypingIndicator(
  sdk: SDK | null,
  conversationId: `0x${string}` | null,
  currentUserAddress: `0x${string}` | null
) {
  const [isTyping, setIsTyping] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const startTyping = useCallback(() => {
    if (!sdk || !conversationId || !currentUserAddress) return

    setIsTyping(true)
    setTypingV2(sdk, conversationId, currentUserAddress, true)

    // Auto-stop typing after 3 seconds
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      stopTyping()
    }, 3000)
  }, [sdk, conversationId, currentUserAddress])

  const stopTyping = useCallback(() => {
    if (!sdk || !conversationId || !currentUserAddress) return

    setIsTyping(false)
    setTypingV2(sdk, conversationId, currentUserAddress, false)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [sdk, conversationId, currentUserAddress])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { isTyping, startTyping, stopTyping }
}

/**
 * Hook for user presence
 */
export function useUserPresence(
  sdk: SDK | null,
  userAddress: `0x${string}` | null,
  refreshMs: number = 30000 // 30 seconds
) {
  const [presence, setPresence] = useState<{ isOnline: boolean; lastSeen: number; statusMessage: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const loadPresence = useCallback(async () => {
    if (!sdk || !userAddress) {
      setLoading(false)
      return
    }

    try {
      const data = await fetchPresenceV2(sdk, userAddress)
      setPresence(data)
    } catch (error) {
      console.error('Failed to load presence:', error)
    } finally {
      setLoading(false)
    }
  }, [sdk, userAddress])

  const updateStatus = useCallback(async (status: UserStatus, statusMessage: string = '') => {
    if (!sdk || !userAddress) return

    try {
      await updatePresenceV2(sdk, userAddress, status, statusMessage)
      await loadPresence()
    } catch (error) {
      console.error('Failed to update presence:', error)
    }
  }, [sdk, userAddress, loadPresence])

  useEffect(() => {
    loadPresence()
    const interval = setInterval(loadPresence, refreshMs)
    return () => clearInterval(interval)
  }, [loadPresence, refreshMs])

  return { presence, loading, updateStatus, reload: loadPresence }
}

/**
 * Hook for pinned messages
 */
export function usePinnedMessages(
  sdk: SDK | null,
  publicClient: any,
  conversationId: `0x${string}` | null,
  publisher: `0x${string}`
) {
  const [pinnedMessages, setPinnedMessages] = useState<Array<{ messageId: `0x${string}`; pinnedBy: `0x${string}`; pinnedAt: number }>>([])
  const [loading, setLoading] = useState(false)

  const loadPinned = useCallback(async () => {
    if (!sdk || !conversationId) return

    setLoading(true)
    try {
      const data = await fetchPinnedMessagesV2(sdk, conversationId, publisher)
      setPinnedMessages(data)
    } catch (error) {
      console.error('Failed to load pinned messages:', error)
    } finally {
      setLoading(false)
    }
  }, [sdk, conversationId, publisher])

  const pinMessage = useCallback(async (messageId: `0x${string}`, pinnedBy: `0x${string}`) => {
    if (!sdk || !conversationId) return

    try {
      await pinMessageV2(sdk, publicClient, conversationId, messageId, pinnedBy)
      await loadPinned()
    } catch (error) {
      console.error('Failed to pin message:', error)
    }
  }, [sdk, publicClient, conversationId, loadPinned])

  const unpinMessage = useCallback(async (messageId: `0x${string}`, pinnedBy: `0x${string}`) => {
    if (!sdk || !conversationId) return

    try {
      await unpinMessageV2(sdk, publicClient, conversationId, messageId, pinnedBy)
      await loadPinned()
    } catch (error) {
      console.error('Failed to unpin message:', error)
    }
  }, [sdk, publicClient, conversationId, loadPinned])

  useEffect(() => {
    loadPinned()
  }, [loadPinned])

  return { pinnedMessages, loading, pinMessage, unpinMessage, reload: loadPinned }
}
