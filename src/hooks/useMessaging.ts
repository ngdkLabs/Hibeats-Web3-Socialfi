/**
 * React Hooks untuk Messaging System
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { SDK } from '@somnia-chain/streams'
import { type Hex } from 'viem'
import {
  fetchDirectMessages,
  fetchGroupMessages,
  sendDirectMessage,
  sendGroupMessage,
  addMessageReaction,
  updateTypingIndicator,
  markMessageAsRead,
  updateUserPresence,
  createGroup,
  addGroupMember,
  registerMessagingSchemas
} from '../services/messagingService'
import {
  MessageType,
  UserStatus,
  GroupRole,
  type DirectMessage,
  type GroupMessage
} from '../lib/messagingSchemas'

/**
 * Hook untuk Direct Messages
 */
export function useDirectMessages(
  sdk: SDK | null,
  conversationId: `0x${string}` | null,
  publisher: `0x${string}`,
  refreshMs: number = 3000
) {
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const loadMessages = useCallback(async () => {
    if (!sdk || !conversationId) {
      setLoading(false)
      return
    }

    try {
      const msgs = await fetchDirectMessages(sdk, conversationId, publisher, 100)
      setMessages(msgs)
      setError(null)
    } catch (err: any) {
      console.error('❌ Failed to load direct messages:', err)
      setError(err.message || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [sdk, conversationId, publisher])

  useEffect(() => {
    if (!sdk || !conversationId) return

    setLoading(true)
    loadMessages()

    timerRef.current = setInterval(loadMessages, refreshMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [loadMessages, refreshMs, sdk, conversationId])

  return { messages, loading, error, reload: loadMessages }
}

/**
 * Hook untuk Group Messages
 */
export function useGroupMessages(
  sdk: SDK | null,
  groupId: `0x${string}` | null,
  publisher: `0x${string}`,
  refreshMs: number = 3000
) {
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const loadMessages = useCallback(async () => {
    if (!sdk || !groupId) {
      setLoading(false)
      return
    }

    try {
      const msgs = await fetchGroupMessages(sdk, groupId, publisher, 100)
      setMessages(msgs)
      setError(null)
    } catch (err: any) {
      console.error('❌ Failed to load group messages:', err)
      setError(err.message || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [sdk, groupId, publisher])

  useEffect(() => {
    if (!sdk || !groupId) return

    setLoading(true)
    loadMessages()

    timerRef.current = setInterval(loadMessages, refreshMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [loadMessages, refreshMs, sdk, groupId])

  return { messages, loading, error, reload: loadMessages }
}

/**
 * Hook untuk mengirim pesan
 */
export function useSendMessage(sdk: SDK | null, publicClient: any) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendDM = useCallback(async (
    recipient: `0x${string}`,
    content: string,
    messageType: MessageType = MessageType.TEXT,
    mediaUrl: string = '',
    replyToMessageId?: `0x${string}`
  ) => {
    if (!sdk) throw new Error('SDK not initialized')

    setSending(true)
    setError(null)

    try {
      const txHash = await sendDirectMessage(
        sdk,
        publicClient,
        recipient,
        content,
        messageType,
        mediaUrl,
        replyToMessageId
      )
      return txHash
    } catch (err: any) {
      console.error('❌ Failed to send DM:', err)
      setError(err.message || 'Failed to send message')
      throw err
    } finally {
      setSending(false)
    }
  }, [sdk, publicClient])

  const sendGroupMsg = useCallback(async (
    groupId: `0x${string}`,
    content: string,
    messageType: MessageType = MessageType.TEXT,
    mediaUrl: string = '',
    replyToMessageId?: `0x${string}`
  ) => {
    if (!sdk) throw new Error('SDK not initialized')

    setSending(true)
    setError(null)

    try {
      const txHash = await sendGroupMessage(
        sdk,
        publicClient,
        groupId,
        content,
        messageType,
        mediaUrl,
        replyToMessageId
      )
      return txHash
    } catch (err: any) {
      console.error('❌ Failed to send group message:', err)
      setError(err.message || 'Failed to send message')
      throw err
    } finally {
      setSending(false)
    }
  }, [sdk, publicClient])

  return { sendDM, sendGroupMsg, sending, error }
}

/**
 * Hook untuk typing indicator
 */
export function useTypingIndicator(
  sdk: SDK | null,
  conversationId: `0x${string}` | null
) {
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const setTyping = useCallback((isTyping: boolean) => {
    if (!sdk || !conversationId) return

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Update typing status
    updateTypingIndicator(sdk, conversationId, isTyping)

    // Auto-clear typing after 3 seconds
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingIndicator(sdk, conversationId, false)
      }, 3000)
    }
  }, [sdk, conversationId])

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  return { setTyping }
}

/**
 * Hook untuk message reactions
 */
export function useMessageReactions(sdk: SDK | null, publicClient: any) {
  const [adding, setAdding] = useState(false)

  const addReaction = useCallback(async (
    messageId: `0x${string}`,
    emoji: string
  ) => {
    if (!sdk) throw new Error('SDK not initialized')

    setAdding(true)
    try {
      const txHash = await addMessageReaction(sdk, publicClient, messageId, emoji)
      return txHash
    } catch (err: any) {
      console.error('❌ Failed to add reaction:', err)
      throw err
    } finally {
      setAdding(false)
    }
  }, [sdk, publicClient])

  return { addReaction, adding }
}

/**
 * Hook untuk user presence
 */
export function useUserPresence(sdk: SDK | null) {
  const [status, setStatus] = useState<UserStatus>(UserStatus.ONLINE)

  const updateStatus = useCallback(async (
    newStatus: UserStatus,
    statusMessage: string = ''
  ) => {
    if (!sdk) return

    try {
      await updateUserPresence(sdk, newStatus, statusMessage)
      setStatus(newStatus)
    } catch (err: any) {
      console.error('❌ Failed to update presence:', err)
    }
  }, [sdk])

  // Auto-update presence on mount and visibility change
  useEffect(() => {
    if (!sdk) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateStatus(UserStatus.AWAY)
      } else {
        updateStatus(UserStatus.ONLINE)
      }
    }

    // Set online on mount
    updateStatus(UserStatus.ONLINE)

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      // Set offline on unmount
      updateStatus(UserStatus.OFFLINE)
    }
  }, [sdk, updateStatus])

  return { status, updateStatus }
}

/**
 * Hook untuk group management
 */
export function useGroupManagement(sdk: SDK | null, publicClient: any) {
  const [creating, setCreating] = useState(false)

  const createNewGroup = useCallback(async (
    groupName: string,
    description: string = '',
    groupAvatar: string = ''
  ) => {
    if (!sdk) throw new Error('SDK not initialized')

    setCreating(true)
    try {
      const groupId = await createGroup(sdk, publicClient, groupName, description, groupAvatar)
      return groupId
    } catch (err: any) {
      console.error('❌ Failed to create group:', err)
      throw err
    } finally {
      setCreating(false)
    }
  }, [sdk, publicClient])

  const addMember = useCallback(async (
    groupId: `0x${string}`,
    member: `0x${string}`,
    role: GroupRole = GroupRole.MEMBER
  ) => {
    if (!sdk) throw new Error('SDK not initialized')

    try {
      const txHash = await addGroupMember(sdk, publicClient, groupId, member, role)
      return txHash
    } catch (err: any) {
      console.error('❌ Failed to add member:', err)
      throw err
    }
  }, [sdk, publicClient])

  return { createNewGroup, addMember, creating }
}

/**
 * Hook untuk initialize messaging system
 */
export function useInitializeMessaging(sdk: SDK | null) {
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sdk || initialized) return

    const init = async () => {
      try {
        await registerMessagingSchemas(sdk)
        setInitialized(true)
        console.log('✅ Messaging system initialized')
      } catch (err: any) {
        console.error('❌ Failed to initialize messaging:', err)
        setError(err.message || 'Failed to initialize')
      }
    }

    init()
  }, [sdk, initialized])

  return { initialized, error }
}
