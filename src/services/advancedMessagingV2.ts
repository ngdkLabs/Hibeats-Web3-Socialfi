/**
 * Advanced Messaging Features V2
 * - Message Reactions
 * - Typing Indicators
 * - User Presence (Online/Offline)
 * - Pinned Messages
 * - Message Mentions
 * - Message Threads
 */

import { SDK, SchemaEncoder } from '@somnia-chain/streams'
import { toHex } from 'viem'
import { waitForTransactionReceipt } from 'viem/actions'
import {
  messageReactionSchemaV2,
  typingIndicatorSchemaV2,
  userPresenceSchemaV2,
  pinnedMessageSchemaV2,
  messageMentionSchemaV2,
  messageThreadSchemaV2,
  UserStatus
} from '../lib/messagingSchemasV2'

const val = (f: any) => f?.value?.value ?? f?.value

// Cache schema IDs
let cachedReactionSchemaId: `0x${string}` | null = null
let cachedTypingSchemaId: `0x${string}` | null = null
let cachedPresenceSchemaId: `0x${string}` | null = null
let cachedPinnedSchemaId: `0x${string}` | null = null
let cachedMentionSchemaId: `0x${string}` | null = null
let cachedThreadSchemaId: `0x${string}` | null = null

// ============================================================================
// MESSAGE REACTIONS
// ============================================================================

export async function addReactionV2(
  sdk: SDK,
  publicClient: any,
  messageId: `0x${string}`,
  reactorAddress: `0x${string}`,
  emoji: string
): Promise<string> {
  if (!cachedReactionSchemaId) {
    cachedReactionSchemaId = await sdk.streams.computeSchemaId(messageReactionSchemaV2)
  }

  const encoder = new SchemaEncoder(messageReactionSchemaV2)
  const timestamp = Date.now()
  const reactionId = toHex(`reaction-${messageId}-${reactorAddress}-${timestamp}`, { size: 32 })

  const encodedData = encoder.encodeData([
    { name: 'messageId', value: messageId, type: 'bytes32' },
    { name: 'reactor', value: reactorAddress, type: 'address' },
    { name: 'emoji', value: emoji, type: 'string' },
    { name: 'timestamp', value: timestamp.toString(), type: 'uint64' },
    { name: 'isRemoved', value: false, type: 'bool' }
  ])

  const txHash = await sdk.streams.set([{
    id: reactionId,
    schemaId: cachedReactionSchemaId!,
    data: encodedData
  }])

  if (!txHash) throw new Error('Failed to add reaction')

  // Background confirmation
  waitForTransactionReceipt(publicClient, { hash: txHash as `0x${string}` })
    .catch(err => console.warn('⚠️ Reaction receipt failed:', err.message))

  return txHash
}

export async function removeReactionV2(
  sdk: SDK,
  publicClient: any,
  messageId: `0x${string}`,
  reactorAddress: `0x${string}`,
  emoji: string
): Promise<string> {
  if (!cachedReactionSchemaId) {
    cachedReactionSchemaId = await sdk.streams.computeSchemaId(messageReactionSchemaV2)
  }

  const encoder = new SchemaEncoder(messageReactionSchemaV2)
  const timestamp = Date.now()
  const reactionId = toHex(`reaction-${messageId}-${reactorAddress}-${timestamp}`, { size: 32 })

  const encodedData = encoder.encodeData([
    { name: 'messageId', value: messageId, type: 'bytes32' },
    { name: 'reactor', value: reactorAddress, type: 'address' },
    { name: 'emoji', value: emoji, type: 'string' },
    { name: 'timestamp', value: timestamp.toString(), type: 'uint64' },
    { name: 'isRemoved', value: true, type: 'bool' }
  ])

  const txHash = await sdk.streams.set([{
    id: reactionId,
    schemaId: cachedReactionSchemaId!,
    data: encodedData
  }])

  if (!txHash) throw new Error('Failed to remove reaction')

  waitForTransactionReceipt(publicClient, { hash: txHash as `0x${string}` })
    .catch(err => console.warn('⚠️ Remove reaction receipt failed:', err.message))

  return txHash
}

export async function fetchReactionsV2(
  sdk: SDK,
  messageId: `0x${string}`,
  publisher: `0x${string}`
): Promise<Array<{ emoji: string; reactor: `0x${string}`; timestamp: number }>> {
  if (!cachedReactionSchemaId) {
    cachedReactionSchemaId = await sdk.streams.computeSchemaId(messageReactionSchemaV2)
  }

  const resp = await sdk.streams.getAllPublisherDataForSchema(cachedReactionSchemaId, publisher)
  const rows: any[][] = Array.isArray(resp) ? (resp as any[][]) : []

  const reactions: Array<{ emoji: string; reactor: `0x${string}`; timestamp: number }> = []

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 5) continue

    const msgId = String(val(row[0])) as `0x${string}`
    if (msgId.toLowerCase() !== messageId.toLowerCase()) continue

    const isRemoved = Boolean(val(row[4]))
    if (isRemoved) continue

    reactions.push({
      emoji: String(val(row[2])),
      reactor: String(val(row[1])) as `0x${string}`,
      timestamp: Number(val(row[3]))
    })
  }

  return reactions
}

// ============================================================================
// TYPING INDICATORS
// ============================================================================

export async function setTypingV2(
  sdk: SDK,
  conversationId: `0x${string}`,
  userAddress: `0x${string}`,
  isTyping: boolean
): Promise<string> {
  if (!cachedTypingSchemaId) {
    cachedTypingSchemaId = await sdk.streams.computeSchemaId(typingIndicatorSchemaV2)
  }

  console.log('⌨️ [TYPING] Setting typing status:', {
    user: userAddress.substring(0, 10),
    conversation: conversationId.substring(0, 10),
    isTyping
  })

  const encoder = new SchemaEncoder(typingIndicatorSchemaV2)
  const timestamp = Date.now()
  const typingId = toHex(`typing-${conversationId}-${userAddress}`, { size: 32 })

  const encodedData = encoder.encodeData([
    { name: 'conversationId', value: conversationId, type: 'bytes32' },
    { name: 'user', value: userAddress, type: 'address' },
    { name: 'isTyping', value: isTyping, type: 'bool' },
    { name: 'timestamp', value: timestamp.toString(), type: 'uint64' }
  ])

  const txHash = await sdk.streams.set([{
    id: typingId,
    schemaId: cachedTypingSchemaId!,
    data: encodedData
  }])

  console.log('✅ [TYPING] Published:', txHash ? 'success' : 'failed')

  return txHash || ''
}

export async function fetchTypingV2(
  sdk: SDK,
  conversationId: `0x${string}`,
  publisher: `0x${string}`
): Promise<{ isTyping: boolean; user: `0x${string}` } | null> {
  if (!cachedTypingSchemaId) {
    cachedTypingSchemaId = await sdk.streams.computeSchemaId(typingIndicatorSchemaV2)
  }

  const resp = await sdk.streams.getAllPublisherDataForSchema(cachedTypingSchemaId, publisher)
  const rows: any[][] = Array.isArray(resp) ? (resp as any[][]) : []

  console.log('🔍 [TYPING] Fetching from publisher:', publisher.substring(0, 10), 'rows:', rows.length)

  // Get the most recent typing status
  let latestTyping: { isTyping: boolean; user: `0x${string}`; timestamp: number } | null = null

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 4) continue

    const convId = String(val(row[0])) as `0x${string}`
    if (convId.toLowerCase() !== conversationId.toLowerCase()) continue

    const timestamp = Number(val(row[3]))
    const user = String(val(row[1])) as `0x${string}`
    const isTyping = Boolean(val(row[2]))

    // Keep track of latest typing status
    if (!latestTyping || timestamp > latestTyping.timestamp) {
      latestTyping = { user, isTyping, timestamp }
    }
  }

  if (!latestTyping) {
    console.log('   No typing data found')
    return null
  }

  const now = Date.now()
  const age = now - latestTyping.timestamp

  console.log('   Latest typing:', {
    user: latestTyping.user.substring(0, 10),
    isTyping: latestTyping.isTyping,
    age: `${age}ms`
  })

  // Typing indicator expires after 5 seconds
  if (age > 5000) {
    console.log('   ⏰ Typing expired (>5s)')
    return null
  }

  return {
    user: latestTyping.user,
    isTyping: latestTyping.isTyping
  }
}

// ============================================================================
// USER PRESENCE (Online/Offline)
// ============================================================================

export async function updatePresenceV2(
  sdk: SDK,
  userAddress: `0x${string}`,
  status: UserStatus,
  statusMessage: string = ''
): Promise<string> {
  if (!cachedPresenceSchemaId) {
    cachedPresenceSchemaId = await sdk.streams.computeSchemaId(userPresenceSchemaV2)
  }

  const encoder = new SchemaEncoder(userPresenceSchemaV2)
  const timestamp = Date.now()
  const presenceId = toHex(`presence-${userAddress}`, { size: 32 })

  const encodedData = encoder.encodeData([
    { name: 'user', value: userAddress, type: 'address' },
    { name: 'status', value: status.toString(), type: 'uint8' },
    { name: 'lastSeen', value: timestamp.toString(), type: 'uint64' },
    { name: 'statusMessage', value: statusMessage, type: 'string' },
    { name: 'isOnline', value: status === UserStatus.ONLINE, type: 'bool' }
  ])

  const txHash = await sdk.streams.set([{
    id: presenceId,
    schemaId: cachedPresenceSchemaId!,
    data: encodedData
  }])

  return txHash || ''
}

export async function fetchPresenceV2(
  sdk: SDK,
  userAddress: `0x${string}`
): Promise<{ isOnline: boolean; lastSeen: number; statusMessage: string } | null> {
  if (!cachedPresenceSchemaId) {
    cachedPresenceSchemaId = await sdk.streams.computeSchemaId(userPresenceSchemaV2)
  }

  const resp = await sdk.streams.getAllPublisherDataForSchema(cachedPresenceSchemaId, userAddress)
  const rows: any[][] = Array.isArray(resp) ? (resp as any[][]) : []

  if (rows.length === 0) return null

  // Get latest presence
  const row = rows[rows.length - 1]
  if (!Array.isArray(row) || row.length < 5) return null

  const lastSeen = Number(val(row[2]))
  const now = Date.now()
  
  // User is online if last seen within 2 minutes
  const isOnline = Boolean(val(row[4])) && (now - lastSeen < 120000)

  return {
    isOnline,
    lastSeen,
    statusMessage: String(val(row[3]) || '')
  }
}

// ============================================================================
// PINNED MESSAGES
// ============================================================================

export async function pinMessageV2(
  sdk: SDK,
  publicClient: any,
  conversationId: `0x${string}`,
  messageId: `0x${string}`,
  pinnedBy: `0x${string}`
): Promise<string> {
  if (!cachedPinnedSchemaId) {
    cachedPinnedSchemaId = await sdk.streams.computeSchemaId(pinnedMessageSchemaV2)
  }

  const encoder = new SchemaEncoder(pinnedMessageSchemaV2)
  const timestamp = Date.now()
  const pinId = toHex(`pin-${conversationId}-${messageId}`, { size: 32 })

  const encodedData = encoder.encodeData([
    { name: 'conversationId', value: conversationId, type: 'bytes32' },
    { name: 'messageId', value: messageId, type: 'bytes32' },
    { name: 'pinnedBy', value: pinnedBy, type: 'address' },
    { name: 'pinnedAt', value: timestamp.toString(), type: 'uint64' },
    { name: 'isUnpinned', value: false, type: 'bool' }
  ])

  const txHash = await sdk.streams.set([{
    id: pinId,
    schemaId: cachedPinnedSchemaId!,
    data: encodedData
  }])

  if (!txHash) throw new Error('Failed to pin message')

  waitForTransactionReceipt(publicClient, { hash: txHash as `0x${string}` })
    .catch(err => console.warn('⚠️ Pin receipt failed:', err.message))

  return txHash
}

export async function unpinMessageV2(
  sdk: SDK,
  publicClient: any,
  conversationId: `0x${string}`,
  messageId: `0x${string}`,
  pinnedBy: `0x${string}`
): Promise<string> {
  if (!cachedPinnedSchemaId) {
    cachedPinnedSchemaId = await sdk.streams.computeSchemaId(pinnedMessageSchemaV2)
  }

  const encoder = new SchemaEncoder(pinnedMessageSchemaV2)
  const timestamp = Date.now()
  const pinId = toHex(`pin-${conversationId}-${messageId}`, { size: 32 })

  const encodedData = encoder.encodeData([
    { name: 'conversationId', value: conversationId, type: 'bytes32' },
    { name: 'messageId', value: messageId, type: 'bytes32' },
    { name: 'pinnedBy', value: pinnedBy, type: 'address' },
    { name: 'pinnedAt', value: timestamp.toString(), type: 'uint64' },
    { name: 'isUnpinned', value: true, type: 'bool' }
  ])

  const txHash = await sdk.streams.set([{
    id: pinId,
    schemaId: cachedPinnedSchemaId!,
    data: encodedData
  }])

  if (!txHash) throw new Error('Failed to unpin message')

  waitForTransactionReceipt(publicClient, { hash: txHash as `0x${string}` })
    .catch(err => console.warn('⚠️ Unpin receipt failed:', err.message))

  return txHash
}

export async function fetchPinnedMessagesV2(
  sdk: SDK,
  conversationId: `0x${string}`,
  publisher: `0x${string}`
): Promise<Array<{ messageId: `0x${string}`; pinnedBy: `0x${string}`; pinnedAt: number }>> {
  if (!cachedPinnedSchemaId) {
    cachedPinnedSchemaId = await sdk.streams.computeSchemaId(pinnedMessageSchemaV2)
  }

  const resp = await sdk.streams.getAllPublisherDataForSchema(cachedPinnedSchemaId, publisher)
  const rows: any[][] = Array.isArray(resp) ? (resp as any[][]) : []

  const pinned: Array<{ messageId: `0x${string}`; pinnedBy: `0x${string}`; pinnedAt: number }> = []

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 5) continue

    const convId = String(val(row[0])) as `0x${string}`
    if (convId.toLowerCase() !== conversationId.toLowerCase()) continue

    const isUnpinned = Boolean(val(row[4]))
    if (isUnpinned) continue

    pinned.push({
      messageId: String(val(row[1])) as `0x${string}`,
      pinnedBy: String(val(row[2])) as `0x${string}`,
      pinnedAt: Number(val(row[3]))
    })
  }

  return pinned
}
