/**
 * React Hooks untuk Encrypted Messaging
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { SDK } from '@somnia-chain/streams'
import { type Hex } from 'viem'
import { isSDKWalletConnected, logSDKStatus } from '../lib/sdkUtils'
import {
  initializeUserEncryption,
  getUserPublicKey,
  sendEncryptedDirectMessage,
  fetchEncryptedDirectMessages,
  createEncryptedGroup,
  sendEncryptedGroupMessage,
  fetchEncryptedGroupMessages,
  shareGroupKeyWithMember,
  receiveGroupKey,
  exportKeysForBackup,
  importKeysFromBackup,
  deleteAllKeys
} from '../services/encryptedMessagingService'
import {
  MessageType,
  type DirectMessage,
  type GroupMessage
} from '../lib/messagingSchemas'

/**
 * Hook untuk initialize encryption
 */
export function useEncryptionInit(
  userAddress: `0x${string}` | null,
  sdk?: SDK | null,
  publicClient?: any
) {
  const [initialized, setInitialized] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userAddress) {
      setLoading(false)
      return
    }

    const init = async () => {
      try {
        const keys = await initializeUserEncryption(userAddress, sdk || undefined, publicClient)
        setPublicKey(keys.publicKey)
        setInitialized(true)
        setError(null)
      } catch (err: any) {
        console.error('Failed to initialize encryption:', err)
        setError(err.message || 'Failed to initialize encryption')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [userAddress, sdk, publicClient])

  return { initialized, publicKey, loading, error }
}

/**
 * Hook untuk encrypted direct messages
 */
export function useEncryptedDirectMessages(
  sdk: SDK | null,
  conversationId: `0x${string}` | null,
  participant1: `0x${string}`,
  participant2: `0x${string}`,
  currentUserAddress: `0x${string}` | null,
  refreshMs: number = 3000
) {
  const [messages, setMessages] = useState<Array<DirectMessage & { decrypted: boolean; plaintext?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const loadMessages = useCallback(async () => {
    if (!sdk || !conversationId || !currentUserAddress) {
      setLoading(false)
      return
    }

    try {
      const msgs = await fetchEncryptedDirectMessages(
        sdk,
        conversationId,
        participant1,
        participant2,
        currentUserAddress,
        100
      )
      setMessages(msgs)
      setError(null)
    } catch (err: any) {
      console.error('❌ Failed to load encrypted messages:', err)
      setError(err.message || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [sdk, conversationId, participant1, participant2, currentUserAddress])

  useEffect(() => {
    if (!sdk || !conversationId || !currentUserAddress) return

    setLoading(true)
    loadMessages()

    timerRef.current = setInterval(loadMessages, refreshMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [loadMessages, refreshMs, sdk, conversationId, currentUserAddress])

  return { messages, loading, error, reload: loadMessages }
}

/**
 * Hook untuk encrypted group messages
 */
export function useEncryptedGroupMessages(
  sdk: SDK | null,
  groupId: `0x${string}` | null,
  publisher: `0x${string}`,
  refreshMs: number = 3000
) {
  const [messages, setMessages] = useState<Array<GroupMessage & { decrypted: boolean; plaintext?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const loadMessages = useCallback(async () => {
    if (!sdk || !groupId) {
      setLoading(false)
      return
    }

    try {
      const msgs = await fetchEncryptedGroupMessages(sdk, groupId, publisher, 100)
      setMessages(msgs)
      setError(null)
    } catch (err: any) {
      console.error('❌ Failed to load encrypted group messages:', err)
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
 * Hook untuk send encrypted messages
 */
export function useSendEncryptedMessage(
  sdk: SDK | null,
  publicClient: any,
  senderAddress: `0x${string}` | null
) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendEncryptedDM = useCallback(async (
    recipientAddress: `0x${string}`,
    recipientPublicKey: string,
    plaintext: string,
    messageType: MessageType = MessageType.TEXT,
    mediaUrl: string = ''
  ) => {
    console.log('📨 [HOOK] sendEncryptedDM called')
    console.log('   Sender:', senderAddress)
    console.log('   Recipient:', recipientAddress)
    
    // Log SDK status for debugging
    logSDKStatus(sdk, 'SEND MESSAGE')
    
    if (!sdk) {
      const error = 'SDK not initialized'
      console.error('❌ [HOOK]', error)
      throw new Error(error)
    }
    
    if (!senderAddress) {
      const error = 'Sender address not initialized'
      console.error('❌ [HOOK]', error)
      throw new Error(error)
    }
    
    // Check SDK wallet connection - TEMPORARILY DISABLED FOR DEBUGGING
    const walletConnected = isSDKWalletConnected(sdk)
    console.log('🔍 [HOOK] Wallet connected check:', walletConnected)
    
    if (!walletConnected) {
      console.warn('⚠️ [HOOK] SDK wallet check failed, but attempting to send anyway...')
      console.warn('   This is for debugging - will try to send message')
      // Don't throw error, just warn and continue
    } else {
      console.log('✅ [HOOK] Wallet check passed')
    }
    
    console.log('✅ [HOOK] Proceeding to send message...')

    setSending(true)
    setError(null)

    try {
      console.log('🚀 [HOOK] Calling sendEncryptedDirectMessage...')
      const txHash = await sendEncryptedDirectMessage(
        sdk,
        publicClient,
        senderAddress,
        recipientAddress,
        plaintext,
        recipientPublicKey,
        messageType,
        mediaUrl
      )
      console.log('✅ [HOOK] Message sent, txHash:', txHash)
      return txHash
    } catch (err: any) {
      console.error('❌ [HOOK] Failed to send encrypted DM:', err)
      const errorMessage = err.message || 'Failed to send message'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setSending(false)
    }
  }, [sdk, publicClient, senderAddress])

  const sendEncryptedGroupMsg = useCallback(async (
    groupId: `0x${string}`,
    plaintext: string,
    messageType: MessageType = MessageType.TEXT,
    mediaUrl: string = ''
  ) => {
    if (!sdk || !senderAddress) throw new Error('SDK or sender not initialized')

    setSending(true)
    setError(null)

    try {
      const txHash = await sendEncryptedGroupMessage(
        sdk,
        publicClient,
        groupId,
        senderAddress,
        plaintext,
        messageType,
        mediaUrl
      )
      return txHash
    } catch (err: any) {
      console.error('❌ Failed to send encrypted group message:', err)
      setError(err.message || 'Failed to send message')
      throw err
    } finally {
      setSending(false)
    }
  }, [sdk, publicClient, senderAddress])

  return { sendEncryptedDM, sendEncryptedGroupMsg, sending, error }
}

/**
 * Hook untuk create encrypted group
 */
export function useCreateEncryptedGroup(
  sdk: SDK | null,
  publicClient: any,
  creatorAddress: `0x${string}` | null
) {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createGroup = useCallback(async (
    groupName: string,
    description: string = ''
  ) => {
    if (!sdk || !creatorAddress) throw new Error('SDK or creator not initialized')

    setCreating(true)
    setError(null)

    try {
      const result = await createEncryptedGroup(
        sdk,
        publicClient,
        groupName,
        creatorAddress,
        description
      )
      return result
    } catch (err: any) {
      console.error('❌ Failed to create encrypted group:', err)
      setError(err.message || 'Failed to create group')
      throw err
    } finally {
      setCreating(false)
    }
  }, [sdk, publicClient, creatorAddress])

  return { createGroup, creating, error }
}

/**
 * Hook untuk share group key
 */
export function useShareGroupKey(senderAddress: `0x${string}` | null) {
  const [sharing, setSharing] = useState(false)

  const shareKey = useCallback(async (
    groupId: `0x${string}`,
    memberAddress: `0x${string}`,
    memberPublicKey: string
  ) => {
    if (!senderAddress) throw new Error('Sender not initialized')

    setSharing(true)
    try {
      const encryptedKey = await shareGroupKeyWithMember(
        groupId,
        memberAddress,
        memberPublicKey,
        senderAddress
      )
      return encryptedKey
    } catch (err: any) {
      console.error('❌ Failed to share group key:', err)
      throw err
    } finally {
      setSharing(false)
    }
  }, [senderAddress])

  return { shareKey, sharing }
}

/**
 * Hook untuk receive group key
 */
export function useReceiveGroupKey(recipientAddress: `0x${string}` | null) {
  const [receiving, setReceiving] = useState(false)

  const receiveKey = useCallback(async (
    groupId: `0x${string}`,
    encryptedGroupKey: any
  ) => {
    if (!recipientAddress) throw new Error('Recipient not initialized')

    setReceiving(true)
    try {
      await receiveGroupKey(groupId, encryptedGroupKey, recipientAddress)
    } catch (err: any) {
      console.error('❌ Failed to receive group key:', err)
      throw err
    } finally {
      setReceiving(false)
    }
  }, [recipientAddress])

  return { receiveKey, receiving }
}

/**
 * Hook untuk key management (backup/restore)
 */
export function useKeyManagement(userAddress: `0x${string}` | null) {
  const [processing, setProcessing] = useState(false)

  const backupKeys = useCallback(async (password: string) => {
    if (!userAddress) throw new Error('User not initialized')

    setProcessing(true)
    try {
      const backup = await exportKeysForBackup(userAddress, password)
      
      // Download as file
      const blob = new Blob([backup], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `encryption-keys-${userAddress}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      return backup
    } catch (err: any) {
      console.error('❌ Failed to backup keys:', err)
      throw err
    } finally {
      setProcessing(false)
    }
  }, [userAddress])

  const restoreKeys = useCallback(async (backupData: string, password: string) => {
    setProcessing(true)
    try {
      await importKeysFromBackup(backupData, password)
    } catch (err: any) {
      console.error('❌ Failed to restore keys:', err)
      throw err
    } finally {
      setProcessing(false)
    }
  }, [])

  const deleteKeys = useCallback(async () => {
    if (!userAddress) throw new Error('User not initialized')

    setProcessing(true)
    try {
      await deleteAllKeys(userAddress)
    } catch (err: any) {
      console.error('❌ Failed to delete keys:', err)
      throw err
    } finally {
      setProcessing(false)
    }
  }, [userAddress])

  return { backupKeys, restoreKeys, deleteKeys, processing }
}

/**
 * Hook untuk get user's public key
 */
export function usePublicKey(userAddress: `0x${string}` | null) {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userAddress) {
      setLoading(false)
      return
    }

    const loadKey = async () => {
      try {
        const key = await getUserPublicKey(userAddress)
        setPublicKey(key)
      } catch (err) {
        console.error('Failed to load public key:', err)
      } finally {
        setLoading(false)
      }
    }

    loadKey()
  }, [userAddress])

  return { publicKey, loading }
}

/**
 * Hook untuk encryption status indicator
 */
export function useEncryptionStatus(userAddress: `0x${string}` | null) {
  const { initialized, publicKey, loading } = useEncryptionInit(userAddress)

  const status = {
    enabled: initialized && !!publicKey,
    loading,
    publicKey,
    icon: initialized ? '🔒' : '🔓',
    text: initialized ? 'End-to-End Encrypted' : 'Not Encrypted'
  }

  return status
}

/**
 * Hook untuk clear chat
 */
export function useClearChat(
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
      const { clearDirectMessageChat } = await import('@/services/encryptedMessagingService')
      const txHashes = await clearDirectMessageChat(
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
