/**
 * Messaging Service V2 - Simplified & Fast
 * Following Twitter/Instagram best practices
 * 
 * NO ENCRYPTION - Messages stored in plaintext like Twitter DM
 * Focus on: Speed, Simplicity, User Experience
 */

import { SDK, SchemaEncoder } from '@somnia-chain/streams'
import { toHex } from 'viem'
import { waitForTransactionReceipt } from 'viem/actions'
import { generateConversationId, generateMessageId } from '../lib/conversationUtils'
import {
  directMessageSchemaV2,
  groupMessageSchemaV2,
  conversationSchemaV2,
  MessageType,
  type DirectMessageV2,
  type GroupMessageV2,
  type ConversationV2
} from '../lib/messagingSchemasV2'

// Helper untuk mendapatkan nilai dari field
const val = (f: any) => f?.value?.value ?? f?.value

// ============================================================================
// DIRECT MESSAGES
// ============================================================================

/**
 * Send Direct Message V2 - Optimized for Speed
 * No encryption, instant sending like Twitter DM
 * 
 * Performance optimizations:
 * 1. Cache schema ID (computed once)
 * 2. Minimal validation
 * 3. Don't wait for receipt (fire and forget)
 * 4. Batch-ready structure
 */

// Cache schema ID to avoid recomputation
let cachedSchemaId: `0x${string}` | null = null

export async function sendDirectMessageV2(
  sdk: SDK,
  publicClient: any,
  senderAddress: `0x${string}`,
  recipientAddress: `0x${string}`,
  content: string,
  messageType: MessageType = MessageType.TEXT,
  mediaUrl: string = '',
  replyToMessageId: `0x${string}` = '0x0000000000000000000000000000000000000000000000000000000000000000'
): Promise<string> {
  // Validate input (minimal for speed)
  if (!content || content.trim() === '') {
    throw new Error('Message content cannot be empty')
  }

  // Validate content length (prevent transaction bloat)
  if (content.length > 5000) {
    throw new Error('Message content too long. Maximum 5000 characters.')
  }

  // Prevent base64 images in text content
  if (content.includes('data:image') || content.includes('base64,')) {
    throw new Error('Please use media upload for images, not text content.')
  }

  // Get or compute schema ID (cached for performance)
  if (!cachedSchemaId) {
    cachedSchemaId = await sdk.streams.computeSchemaId(directMessageSchemaV2)
    if (!cachedSchemaId) {
      throw new Error('Failed to compute schema ID')
    }
  }

  // Generate IDs (fast operations)
  const timestamp = Date.now()
  const conversationId = generateConversationId(senderAddress, recipientAddress)
  const messageId = generateMessageId(senderAddress, timestamp, 'dm-v2')

  // Encode message data (single pass)
  const encoder = new SchemaEncoder(directMessageSchemaV2)
  const encodedData = encoder.encodeData([
    { name: 'messageId', value: messageId, type: 'bytes32' },
    { name: 'timestamp', value: timestamp.toString(), type: 'uint64' },
    { name: 'conversationId', value: conversationId, type: 'bytes32' },
    { name: 'content', value: content, type: 'string' },
    { name: 'sender', value: senderAddress, type: 'address' },
    { name: 'recipient', value: recipientAddress, type: 'address' },
    { name: 'messageType', value: messageType.toString(), type: 'uint8' },
    { name: 'mediaUrl', value: mediaUrl, type: 'string' },
    { name: 'replyToMessageId', value: replyToMessageId, type: 'bytes32' },
    { name: 'isRead', value: false, type: 'bool' },
    { name: 'isDeleted', value: false, type: 'bool' },
    { name: 'isEdited', value: false, type: 'bool' },
    { name: 'editedAt', value: '0', type: 'uint64' }
  ])

  // Send to blockchain with timeout handling
  let txHash: string | null = null
  
  try {
    // Add timeout wrapper (30 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Transaction timeout after 30 seconds')), 30000)
    })
    
    const sendPromise = sdk.streams.set([{
      id: messageId,
      schemaId: cachedSchemaId,
      data: encodedData
    }])
    
    txHash = await Promise.race([sendPromise, timeoutPromise])
  } catch (error: any) {
    console.error('❌ Transaction failed:', error)
    
    // Provide better error messages
    if (error.message?.includes('timeout') || error.message?.includes('deadline')) {
      throw new Error('Transaction timeout. The network might be congested. Please try again.')
    } else if (error.message?.includes('gas')) {
      throw new Error('Insufficient gas for transaction. Please try again.')
    } else if (error.message?.includes('rejected')) {
      throw new Error('Transaction rejected by user.')
    } else {
      throw new Error(`Failed to send message: ${error.message || 'Unknown error'}`)
    }
  }

  if (!txHash) {
    throw new Error('Failed to send message - no transaction hash')
  }

  // ⚡ OPTIMIZATION: Don't wait for receipt
  // Message will appear in next fetch cycle (3s polling)
  // This makes sending instant from user perspective
  
  // Optional: Wait in background without blocking
  waitForTransactionReceipt(publicClient, { hash: txHash as `0x${string}` })
    .then(() => console.log('✅ Message confirmed:', messageId.substring(0, 10)))
    .catch(err => console.warn('⚠️ Receipt failed:', err.message))

  return txHash
}

/**
 * Fetch Direct Messages V2 - Optimized
 * 
 * Performance optimizations:
 * 1. Use cached schema ID
 * 2. Parallel fetch from both participants
 * 3. Early filtering for speed
 * 4. Minimal logging in production
 */
export async function fetchDirectMessagesV2(
  sdk: SDK,
  conversationId: `0x${string}`,
  participant1: `0x${string}`,
  participant2: `0x${string}`,
  limit: number = 50
): Promise<DirectMessageV2[]> {
  // Use cached schema ID for speed
  if (!cachedSchemaId) {
    cachedSchemaId = await sdk.streams.computeSchemaId(directMessageSchemaV2)
    if (!cachedSchemaId) {
      throw new Error('Failed to compute schema ID')
    }
  }

  // ⚡ OPTIMIZATION: Parallel fetch from both participants
  const [resp1, resp2] = await Promise.all([
    sdk.streams.getAllPublisherDataForSchema(cachedSchemaId, participant1).catch(() => []),
    sdk.streams.getAllPublisherDataForSchema(cachedSchemaId, participant2).catch(() => [])
  ])

  const rows1: any[][] = Array.isArray(resp1) ? (resp1 as any[][]) : []
  const rows2: any[][] = Array.isArray(resp2) ? (resp2 as any[][]) : []
  
  console.log('   Messages from participant 1:', rows1.length)
  console.log('   Messages from participant 2:', rows2.length)

  const allRows = [...rows1, ...rows2]
  if (!allRows.length) {
    console.log('   No messages found')
    return []
  }

  const messages: DirectMessageV2[] = []

  for (const row of allRows) {
    if (!Array.isArray(row) || row.length < 13) continue

    const msgConvId = String(val(row[2])) as `0x${string}`
    
    // Filter by conversation
    if (msgConvId.toLowerCase() !== conversationId.toLowerCase()) continue

    const isDeleted = Boolean(val(row[10]))
    
    // Skip deleted messages
    if (isDeleted) {
      console.log('   ⏭️ Skipping deleted message')
      continue
    }

    messages.push({
      messageId: String(val(row[0])) as `0x${string}`,
      timestamp: Number(val(row[1])),
      conversationId: msgConvId,
      content: String(val(row[3]) ?? ''),
      sender: String(val(row[4])) as `0x${string}`,
      recipient: String(val(row[5])) as `0x${string}`,
      messageType: Number(val(row[6])) as MessageType,
      mediaUrl: String(val(row[7]) ?? ''),
      replyToMessageId: String(val(row[8])) as `0x${string}`,
      isRead: Boolean(val(row[9])),
      isDeleted: isDeleted,
      isEdited: Boolean(val(row[11])),
      editedAt: Number(val(row[12]))
    })
  }

  // Sort by timestamp
  messages.sort((a, b) => a.timestamp - b.timestamp)
  
  console.log('   ✅ Found', messages.length, 'messages')
  
  return messages.slice(-limit)
}

/**
 * Edit Message V2
 */
export async function editMessageV2(
  sdk: SDK,
  publicClient: any,
  messageId: `0x${string}`,
  newContent: string,
  originalMessage: DirectMessageV2
): Promise<string> {
  console.log('✏️ [EDIT MESSAGE V2] Editing message...')
  console.log('   Message ID:', messageId)
  console.log('   New content:', newContent.substring(0, 50))

  const encoder = new SchemaEncoder(directMessageSchemaV2)
  const schemaId = await sdk.streams.computeSchemaId(directMessageSchemaV2)

  if (!schemaId) {
    throw new Error('Failed to compute schema ID')
  }

  const editedAt = Date.now()

  // Update message with new content
  const encodedData = encoder.encodeData([
    { name: 'messageId', value: messageId, type: 'bytes32' },
    { name: 'timestamp', value: originalMessage.timestamp.toString(), type: 'uint64' },
    { name: 'conversationId', value: originalMessage.conversationId, type: 'bytes32' },
    { name: 'content', value: newContent, type: 'string' }, // ✅ New content
    { name: 'sender', value: originalMessage.sender, type: 'address' },
    { name: 'recipient', value: originalMessage.recipient, type: 'address' },
    { name: 'messageType', value: originalMessage.messageType.toString(), type: 'uint8' },
    { name: 'mediaUrl', value: originalMessage.mediaUrl, type: 'string' },
    { name: 'replyToMessageId', value: originalMessage.replyToMessageId, type: 'bytes32' },
    { name: 'isRead', value: originalMessage.isRead, type: 'bool' },
    { name: 'isDeleted', value: false, type: 'bool' },
    { name: 'isEdited', value: true, type: 'bool' }, // ✅ Mark as edited
    { name: 'editedAt', value: editedAt.toString(), type: 'uint64' } // ✅ Edit timestamp
  ])

  const txHash = await sdk.streams.set([{
    id: messageId,
    schemaId,
    data: encodedData
  }])

  if (!txHash) {
    throw new Error('Failed to edit message')
  }

  await waitForTransactionReceipt(publicClient, { hash: txHash as `0x${string}` })
  console.log('   ✅ Message edited successfully!')

  return txHash
}

/**
 * Delete Message V2
 */
export async function deleteMessageV2(
  sdk: SDK,
  publicClient: any,
  messageId: `0x${string}`,
  originalMessage: DirectMessageV2
): Promise<string> {
  console.log('🗑️ [DELETE MESSAGE V2] Deleting message...')
  console.log('   Message ID:', messageId)

  const encoder = new SchemaEncoder(directMessageSchemaV2)
  const schemaId = await sdk.streams.computeSchemaId(directMessageSchemaV2)

  if (!schemaId) {
    throw new Error('Failed to compute schema ID')
  }

  // Mark as deleted
  const encodedData = encoder.encodeData([
    { name: 'messageId', value: messageId, type: 'bytes32' },
    { name: 'timestamp', value: originalMessage.timestamp.toString(), type: 'uint64' },
    { name: 'conversationId', value: originalMessage.conversationId, type: 'bytes32' },
    { name: 'content', value: originalMessage.content, type: 'string' },
    { name: 'sender', value: originalMessage.sender, type: 'address' },
    { name: 'recipient', value: originalMessage.recipient, type: 'address' },
    { name: 'messageType', value: originalMessage.messageType.toString(), type: 'uint8' },
    { name: 'mediaUrl', value: originalMessage.mediaUrl, type: 'string' },
    { name: 'replyToMessageId', value: originalMessage.replyToMessageId, type: 'bytes32' },
    { name: 'isRead', value: originalMessage.isRead, type: 'bool' },
    { name: 'isDeleted', value: true, type: 'bool' }, // ✅ Mark as deleted
    { name: 'isEdited', value: originalMessage.isEdited, type: 'bool' },
    { name: 'editedAt', value: originalMessage.editedAt.toString(), type: 'uint64' }
  ])

  const txHash = await sdk.streams.set([{
    id: messageId,
    schemaId,
    data: encodedData
  }])

  if (!txHash) {
    throw new Error('Failed to delete message')
  }

  await waitForTransactionReceipt(publicClient, { hash: txHash as `0x${string}` })
  console.log('   ✅ Message deleted successfully!')

  return txHash
}

/**
 * Clear Chat V2 - Delete all messages from current user
 */
export async function clearChatV2(
  sdk: SDK,
  publicClient: any,
  conversationId: `0x${string}`,
  participant1: `0x${string}`,
  participant2: `0x${string}`,
  currentUserAddress: `0x${string}`
): Promise<string[]> {
  console.log('🗑️ [CLEAR CHAT V2] Clearing conversation...')
  console.log('   Conversation ID:', conversationId)
  console.log('   Current user:', currentUserAddress)

  // Fetch all messages
  const messages = await fetchDirectMessagesV2(sdk, conversationId, participant1, participant2, 1000)
  
  // Filter messages from current user that are not deleted
  const messagesToDelete = messages.filter(msg => 
    msg.sender.toLowerCase() === currentUserAddress.toLowerCase() && 
    !msg.isDeleted
  )

  console.log(`   Found ${messagesToDelete.length} messages to delete`)

  if (messagesToDelete.length === 0) {
    console.log('   ℹ️ No messages to delete')
    return []
  }

  // Delete each message
  const txHashes: string[] = []
  
  for (const msg of messagesToDelete) {
    try {
      const txHash = await deleteMessageV2(sdk, publicClient, msg.messageId, msg)
      txHashes.push(txHash)
      console.log(`   ✅ Deleted message: ${msg.messageId.substring(0, 10)}...`)
    } catch (error: any) {
      console.error(`   ❌ Failed to delete message:`, error.message)
    }
  }

  console.log(`   ✅ Cleared ${txHashes.length} messages`)
  return txHashes
}

/**
 * Mark Message as Read V2
 */
export async function markAsReadV2(
  sdk: SDK,
  publicClient: any,
  messageId: `0x${string}`,
  originalMessage: DirectMessageV2
): Promise<string> {
  const encoder = new SchemaEncoder(directMessageSchemaV2)
  const schemaId = await sdk.streams.computeSchemaId(directMessageSchemaV2)

  if (!schemaId) {
    throw new Error('Failed to compute schema ID')
  }

  const encodedData = encoder.encodeData([
    { name: 'messageId', value: messageId, type: 'bytes32' },
    { name: 'timestamp', value: originalMessage.timestamp.toString(), type: 'uint64' },
    { name: 'conversationId', value: originalMessage.conversationId, type: 'bytes32' },
    { name: 'content', value: originalMessage.content, type: 'string' },
    { name: 'sender', value: originalMessage.sender, type: 'address' },
    { name: 'recipient', value: originalMessage.recipient, type: 'address' },
    { name: 'messageType', value: originalMessage.messageType.toString(), type: 'uint8' },
    { name: 'mediaUrl', value: originalMessage.mediaUrl, type: 'string' },
    { name: 'replyToMessageId', value: originalMessage.replyToMessageId, type: 'bytes32' },
    { name: 'isRead', value: true, type: 'bool' }, // ✅ Mark as read
    { name: 'isDeleted', value: originalMessage.isDeleted, type: 'bool' },
    { name: 'isEdited', value: originalMessage.isEdited, type: 'bool' },
    { name: 'editedAt', value: originalMessage.editedAt.toString(), type: 'uint64' }
  ])

  const txHash = await sdk.streams.set([{
    id: messageId,
    schemaId,
    data: encodedData
  }])

  if (!txHash) {
    throw new Error('Failed to mark as read')
  }

  await waitForTransactionReceipt(publicClient, { hash: txHash as `0x${string}` })
  return txHash
}

/**
 * Batch Send Messages V2 - Send multiple messages in one transaction
 * ⚡ ULTRA FAST: Leverage Somnia's 1M+ TPS
 * 
 * Use case: Send message to multiple recipients at once
 */
export async function batchSendMessagesV2(
  sdk: SDK,
  publicClient: any,
  senderAddress: `0x${string}`,
  messages: Array<{
    recipientAddress: `0x${string}`
    content: string
    messageType?: MessageType
    mediaUrl?: string
  }>
): Promise<string> {
  if (!messages || messages.length === 0) {
    throw new Error('No messages to send')
  }

  // Get or compute schema ID (cached)
  if (!cachedSchemaId) {
    cachedSchemaId = await sdk.streams.computeSchemaId(directMessageSchemaV2)
    if (!cachedSchemaId) {
      throw new Error('Failed to compute schema ID')
    }
  }

  const encoder = new SchemaEncoder(directMessageSchemaV2)
  const timestamp = Date.now()
  
  // Prepare all messages in parallel
  const dataStreams = messages.map((msg, index) => {
    const conversationId = generateConversationId(senderAddress, msg.recipientAddress)
    const messageId = generateMessageId(senderAddress, timestamp + index, 'dm-v2-batch')
    
    const encodedData = encoder.encodeData([
      { name: 'messageId', value: messageId, type: 'bytes32' },
      { name: 'timestamp', value: (timestamp + index).toString(), type: 'uint64' },
      { name: 'conversationId', value: conversationId, type: 'bytes32' },
      { name: 'content', value: msg.content, type: 'string' },
      { name: 'sender', value: senderAddress, type: 'address' },
      { name: 'recipient', value: msg.recipientAddress, type: 'address' },
      { name: 'messageType', value: (msg.messageType || MessageType.TEXT).toString(), type: 'uint8' },
      { name: 'mediaUrl', value: msg.mediaUrl || '', type: 'string' },
      { name: 'replyToMessageId', value: '0x0000000000000000000000000000000000000000000000000000000000000000', type: 'bytes32' },
      { name: 'isRead', value: false, type: 'bool' },
      { name: 'isDeleted', value: false, type: 'bool' },
      { name: 'isEdited', value: false, type: 'bool' },
      { name: 'editedAt', value: '0', type: 'uint64' }
    ])

    return {
      id: messageId,
      schemaId: cachedSchemaId!,
      data: encodedData
    }
  })

  // ⚡ Send all messages in ONE transaction
  const txHash = await sdk.streams.set(dataStreams)

  if (!txHash) {
    throw new Error('Failed to send batch messages')
  }

  // Background confirmation
  waitForTransactionReceipt(publicClient, { hash: txHash as `0x${string}` })
    .then(() => console.log(`✅ Batch confirmed: ${messages.length} messages`))
    .catch(err => console.warn('⚠️ Batch receipt failed:', err.message))

  return txHash
}

/**
 * Fetch all conversations for a user
 * Scans all messages to build conversation list
 * 
 * FIXED: Now fetches messages from ALL participants in each conversation
 * to show the actual last message (not just from current user)
 */
export async function fetchUserConversationsV2(
  sdk: SDK,
  userAddress: `0x${string}`
): Promise<Array<{
  conversationId: `0x${string}`
  otherParticipant: `0x${string}`
  lastMessage: string
  lastMessageTime: number
  unreadCount: number
}>> {
  // Use cached schema ID
  if (!cachedSchemaId) {
    cachedSchemaId = await sdk.streams.computeSchemaId(directMessageSchemaV2)
    if (!cachedSchemaId) {
      throw new Error('Failed to compute schema ID')
    }
  }

  console.log('📋 [CONVERSATIONS] Fetching for user:', userAddress.substring(0, 10))

  // Fetch all messages where user is publisher
  const resp = await sdk.streams.getAllPublisherDataForSchema(cachedSchemaId, userAddress)
  const rows: any[][] = Array.isArray(resp) ? (resp as any[][]) : []

  console.log('   Found', rows.length, 'messages published by user')

  // Build conversation map with other participants
  const conversationMap = new Map<string, {
    conversationId: `0x${string}`
    otherParticipant: `0x${string}`
    lastMessage: string
    lastMessageTime: number
    unreadCount: number
  }>()

  const otherParticipants = new Set<string>()

  // First pass: identify all conversations and other participants
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 13) continue

    const timestamp = Number(val(row[1]))
    const conversationId = String(val(row[2])) as `0x${string}`
    const content = String(val(row[3]) ?? '')
    const sender = String(val(row[4])) as `0x${string}`
    const recipient = String(val(row[5])) as `0x${string}`
    const isDeleted = Boolean(val(row[10]))

    // Skip deleted messages
    if (isDeleted) continue

    // Determine other participant
    const otherParticipant = sender.toLowerCase() === userAddress.toLowerCase() 
      ? recipient 
      : sender

    otherParticipants.add(otherParticipant.toLowerCase())

    // Update conversation with user's messages
    const existing = conversationMap.get(conversationId.toLowerCase())
    if (!existing || timestamp > existing.lastMessageTime) {
      conversationMap.set(conversationId.toLowerCase(), {
        conversationId,
        otherParticipant,
        lastMessage: content.substring(0, 50),
        lastMessageTime: timestamp,
        unreadCount: 0
      })
    }
  }

  console.log('   Found', otherParticipants.size, 'other participants')

  // Second pass: fetch messages from all other participants to get true last message
  for (const participant of otherParticipants) {
    try {
      const otherResp = await sdk.streams.getAllPublisherDataForSchema(
        cachedSchemaId, 
        participant as `0x${string}`
      )
      const otherRows: any[][] = Array.isArray(otherResp) ? (otherResp as any[][]) : []

      console.log(`   Checking ${otherRows.length} messages from ${participant.substring(0, 10)}`)

      for (const row of otherRows) {
        if (!Array.isArray(row) || row.length < 13) continue

        const timestamp = Number(val(row[1]))
        const conversationId = String(val(row[2])) as `0x${string}`
        const content = String(val(row[3]) ?? '')
        const sender = String(val(row[4])) as `0x${string}`
        const recipient = String(val(row[5])) as `0x${string}`
        const isDeleted = Boolean(val(row[10]))

        // Skip deleted messages
        if (isDeleted) continue

        // Only process messages in conversations with current user
        const isRelevant = 
          sender.toLowerCase() === userAddress.toLowerCase() ||
          recipient.toLowerCase() === userAddress.toLowerCase()

        if (!isRelevant) continue

        // Update conversation if this message is newer
        const existing = conversationMap.get(conversationId.toLowerCase())
        if (!existing || timestamp > existing.lastMessageTime) {
          const otherParticipant = sender.toLowerCase() === userAddress.toLowerCase() 
            ? recipient 
            : sender

          conversationMap.set(conversationId.toLowerCase(), {
            conversationId,
            otherParticipant,
            lastMessage: content.substring(0, 50),
            lastMessageTime: timestamp,
            unreadCount: 0
          })
        }
      }
    } catch (error) {
      console.warn(`   Failed to fetch messages from ${participant}:`, error)
    }
  }

  // Convert to array and sort by last message time
  const conversations = Array.from(conversationMap.values())
  conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime)

  console.log('   ✅ Found', conversations.length, 'conversations with true last messages')

  return conversations
}
