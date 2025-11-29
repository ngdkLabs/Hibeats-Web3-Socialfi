/**
 * Messaging Service - Layanan untuk mengelola pesan menggunakan Somnia DataStream
 */

import { SDK, SchemaEncoder, zeroBytes32 } from '@somnia-chain/streams'
import { toHex, type Hex } from 'viem'
import { waitForTransactionReceipt } from 'viem/actions'
import { generateConversationId, generateGroupId, generateMessageId } from '../lib/conversationUtils'
import {
  directMessageSchema,
  groupMessageSchema,
  conversationSchema,
  groupMetadataSchema,
  groupMemberSchema,
  messageReactionSchema,
  typingIndicatorSchema,
  messageStatusSchema,
  messageThreadSchema,
  userPresenceSchema,
  MessageType,
  UserStatus,
  GroupRole,
  type DirectMessage,
  type GroupMessage,
  type Conversation,
  type GroupMetadata
} from '../lib/messagingSchemas'

// Helper untuk mendapatkan nilai dari field
const val = (f: any) => f?.value?.value ?? f?.value

/**
 * Register semua schemas untuk messaging system
 */
export async function registerMessagingSchemas(sdk: SDK): Promise<void> {
  const schemas = [
    { id: 'directMessage', schema: directMessageSchema, parentSchemaId: zeroBytes32 },
    { id: 'groupMessage', schema: groupMessageSchema, parentSchemaId: zeroBytes32 },
    { id: 'conversation', schema: conversationSchema, parentSchemaId: zeroBytes32 },
    { id: 'groupMetadata', schema: groupMetadataSchema, parentSchemaId: zeroBytes32 },
    { id: 'groupMember', schema: groupMemberSchema, parentSchemaId: zeroBytes32 },
    { id: 'messageReaction', schema: messageReactionSchema, parentSchemaId: zeroBytes32 },
    { id: 'typingIndicator', schema: typingIndicatorSchema, parentSchemaId: zeroBytes32 },
    { id: 'messageStatus', schema: messageStatusSchema, parentSchemaId: zeroBytes32 },
    { id: 'messageThread', schema: messageThreadSchema, parentSchemaId: zeroBytes32 },
    { id: 'userPresence', schema: userPresenceSchema, parentSchemaId: zeroBytes32 }
  ]

  const ignoreExisting = true
  const txHash = await sdk.streams.registerDataSchemas(schemas, ignoreExisting)
  
  if (txHash) {
    console.log('✅ Messaging schemas registered:', txHash)
  }
}

/**
 * Kirim Direct Message (DM)
 */
export async function sendDirectMessage(
  sdk: SDK,
  publicClient: any,
  recipient: `0x${string}`,
  content: string,
  messageType: MessageType = MessageType.TEXT,
  mediaUrl: string = '',
  replyToMessageId: `0x${string}` = '0x0000000000000000000000000000000000000000000000000000000000000000'
): Promise<string> {
  const encoder = new SchemaEncoder(directMessageSchema)
  const schemaId = await sdk.streams.computeSchemaId(directMessageSchema)
  
  // Buat conversation ID yang konsisten (sorted addresses)
  const sender = sdk.wallet?.account?.address
  if (!sender) {
    console.error('❌ No wallet connected to SDK')
    throw new Error('No wallet connected. Please connect your wallet first.')
  }
  
  console.log('📤 [SEND MESSAGE] Preparing to send message...')
  console.log('   From:', sender)
  console.log('   To:', recipient)
  console.log('   Content:', content.substring(0, 50) + '...')
  
  // Create conversation ID and message ID using helper functions
  const conversationId = generateConversationId(sender, recipient)
  
  const timestamp = Date.now()
  const messageId = generateMessageId(sender, timestamp, 'dm')
  
  const encodedData = encoder.encodeData([
    { name: 'timestamp', value: timestamp.toString(), type: 'uint64' },
    { name: 'conversationId', value: conversationId, type: 'bytes32' },
    { name: 'content', value: content, type: 'string' },
    { name: 'sender', value: sender, type: 'address' },
    { name: 'recipient', value: recipient, type: 'address' },
    { name: 'messageType', value: messageType.toString(), type: 'uint8' },
    { name: 'mediaUrl', value: mediaUrl, type: 'string' },
    { name: 'replyToMessageId', value: replyToMessageId, type: 'bytes32' },
    { name: 'isRead', value: false, type: 'bool' },
    { name: 'isDeleted', value: false, type: 'bool' }
  ])
  
  console.log('📝 [SEND MESSAGE] Data encoded, sending to blockchain...')
  
  try {
    const txHash = await sdk.streams.set([{
      id: messageId,
      schemaId,
      data: encodedData
    }])
    
    if (!txHash) {
      console.error('❌ [SEND MESSAGE] No transaction hash returned')
      throw new Error('Failed to send message - no transaction hash')
    }
    
    console.log('⏳ [SEND MESSAGE] Transaction sent:', txHash)
    console.log('   Waiting for confirmation...')
    
    await waitForTransactionReceipt(publicClient, { hash: txHash })
    
    console.log('✅ [SEND MESSAGE] Message sent successfully!')
    
    return txHash
  } catch (error: any) {
    console.error('❌ [SEND MESSAGE] Failed:', error)
    throw new Error(`Failed to send message: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Kirim Group Message
 */
export async function sendGroupMessage(
  sdk: SDK,
  publicClient: any,
  groupId: `0x${string}`,
  content: string,
  messageType: MessageType = MessageType.TEXT,
  mediaUrl: string = '',
  replyToMessageId: `0x${string}` = '0x0000000000000000000000000000000000000000000000000000000000000000'
): Promise<string> {
  const encoder = new SchemaEncoder(groupMessageSchema)
  const schemaId = await sdk.streams.computeSchemaId(groupMessageSchema)
  
  const sender = sdk.wallet?.account?.address
  if (!sender) throw new Error('No wallet connected')
  
  const timestamp = Date.now()
  const messageId = toHex(`group-${groupId}-${timestamp}`, { size: 32 })
  
  const encodedData = encoder.encodeData([
    { name: 'timestamp', value: timestamp.toString(), type: 'uint64' },
    { name: 'groupId', value: groupId, type: 'bytes32' },
    { name: 'content', value: content, type: 'string' },
    { name: 'sender', value: sender, type: 'address' },
    { name: 'messageType', value: messageType.toString(), type: 'uint8' },
    { name: 'mediaUrl', value: mediaUrl, type: 'string' },
    { name: 'replyToMessageId', value: replyToMessageId, type: 'bytes32' },
    { name: 'isDeleted', value: false, type: 'bool' }
  ])
  
  const txHash = await sdk.streams.set([{
    id: messageId,
    schemaId,
    data: encodedData
  }])
  
  if (!txHash) throw new Error('Failed to send group message')
  await waitForTransactionReceipt(publicClient, { hash: txHash })
  
  return txHash
}

/**
 * Buat Group baru
 */
export async function createGroup(
  sdk: SDK,
  publicClient: any,
  groupName: string,
  description: string = '',
  groupAvatar: string = ''
): Promise<string> {
  const encoder = new SchemaEncoder(groupMetadataSchema)
  const schemaId = await sdk.streams.computeSchemaId(groupMetadataSchema)
  
  const creator = sdk.wallet?.account?.address
  if (!creator) throw new Error('No wallet connected')
  
  const timestamp = Date.now()
  const groupId = toHex(`group-${creator}-${timestamp}`, { size: 32 })
  
  const encodedData = encoder.encodeData([
    { name: 'groupId', value: groupId, type: 'bytes32' },
    { name: 'groupName', value: groupName, type: 'string' },
    { name: 'groupAvatar', value: groupAvatar, type: 'string' },
    { name: 'creator', value: creator, type: 'address' },
    { name: 'createdAt', value: timestamp.toString(), type: 'uint64' },
    { name: 'memberCount', value: '1', type: 'uint32' },
    { name: 'description', value: description, type: 'string' }
  ])
  
  const txHash = await sdk.streams.set([{
    id: groupId,
    schemaId,
    data: encodedData
  }])
  
  if (!txHash) throw new Error('Failed to create group')
  await waitForTransactionReceipt(publicClient, { hash: txHash })
  
  // Tambahkan creator sebagai admin
  await addGroupMember(sdk, publicClient, groupId, creator, GroupRole.OWNER)
  
  return groupId
}

/**
 * Tambah member ke group
 */
export async function addGroupMember(
  sdk: SDK,
  publicClient: any,
  groupId: `0x${string}`,
  member: `0x${string}`,
  role: GroupRole = GroupRole.MEMBER
): Promise<string> {
  const encoder = new SchemaEncoder(groupMemberSchema)
  const schemaId = await sdk.streams.computeSchemaId(groupMemberSchema)
  
  const timestamp = Date.now()
  const memberId = toHex(`${groupId}-${member}`, { size: 32 })
  
  const encodedData = encoder.encodeData([
    { name: 'groupId', value: groupId, type: 'bytes32' },
    { name: 'member', value: member, type: 'address' },
    { name: 'joinedAt', value: timestamp.toString(), type: 'uint64' },
    { name: 'role', value: role.toString(), type: 'uint8' },
    { name: 'isAdmin', value: (role >= GroupRole.ADMIN), type: 'bool' },
    { name: 'isMuted', value: false, type: 'bool' }
  ])
  
  const txHash = await sdk.streams.set([{
    id: memberId,
    schemaId,
    data: encodedData
  }])
  
  if (!txHash) throw new Error('Failed to add group member')
  await waitForTransactionReceipt(publicClient, { hash: txHash })
  
  return txHash
}

/**
 * Tambah reaksi ke pesan
 */
export async function addMessageReaction(
  sdk: SDK,
  publicClient: any,
  messageId: `0x${string}`,
  emoji: string
): Promise<string> {
  const encoder = new SchemaEncoder(messageReactionSchema)
  const schemaId = await sdk.streams.computeSchemaId(messageReactionSchema)
  
  const reactor = sdk.wallet?.account?.address
  if (!reactor) throw new Error('No wallet connected')
  
  const timestamp = Date.now()
  const reactionId = toHex(`${messageId}-${reactor}-${emoji}`, { size: 32 })
  
  const encodedData = encoder.encodeData([
    { name: 'messageId', value: messageId, type: 'bytes32' },
    { name: 'reactor', value: reactor, type: 'address' },
    { name: 'emoji', value: emoji, type: 'string' },
    { name: 'timestamp', value: timestamp.toString(), type: 'uint64' },
    { name: 'isRemoved', value: false, type: 'bool' }
  ])
  
  const txHash = await sdk.streams.set([{
    id: reactionId,
    schemaId,
    data: encodedData
  }])
  
  if (!txHash) throw new Error('Failed to add reaction')
  await waitForTransactionReceipt(publicClient, { hash: txHash })
  
  return txHash
}

/**
 * Update typing indicator
 */
export async function updateTypingIndicator(
  sdk: SDK,
  conversationId: `0x${string}`,
  isTyping: boolean
): Promise<string> {
  const encoder = new SchemaEncoder(typingIndicatorSchema)
  const schemaId = await sdk.streams.computeSchemaId(typingIndicatorSchema)
  
  const user = sdk.wallet?.account?.address
  if (!user) throw new Error('No wallet connected')
  
  const timestamp = Date.now()
  const indicatorId = toHex(`${conversationId}-${user}`, { size: 32 })
  
  const encodedData = encoder.encodeData([
    { name: 'conversationId', value: conversationId, type: 'bytes32' },
    { name: 'user', value: user, type: 'address' },
    { name: 'isTyping', value: isTyping.toString(), type: 'bool' },
    { name: 'timestamp', value: timestamp.toString(), type: 'uint64' }
  ])
  
  const txHash = await sdk.streams.set([{
    id: indicatorId,
    schemaId,
    data: encodedData
  }])
  
  return txHash || ''
}

/**
 * Mark message as read
 */
export async function markMessageAsRead(
  sdk: SDK,
  publicClient: any,
  messageId: `0x${string}`
): Promise<string> {
  const encoder = new SchemaEncoder(messageStatusSchema)
  const schemaId = await sdk.streams.computeSchemaId(messageStatusSchema)
  
  const user = sdk.wallet?.account?.address
  if (!user) throw new Error('No wallet connected')
  
  const timestamp = Date.now()
  const statusId = toHex(`${messageId}-${user}`, { size: 32 })
  
  const encodedData = encoder.encodeData([
    { name: 'messageId', value: messageId, type: 'bytes32' },
    { name: 'user', value: user, type: 'address' },
    { name: 'isDelivered', value: 'true', type: 'bool' },
    { name: 'isRead', value: 'true', type: 'bool' },
    { name: 'deliveredAt', value: timestamp.toString(), type: 'uint64' },
    { name: 'readAt', value: timestamp.toString(), type: 'uint64' }
  ])
  
  const txHash = await sdk.streams.set([{
    id: statusId,
    schemaId,
    data: encodedData
  }])
  
  if (!txHash) throw new Error('Failed to mark as read')
  await waitForTransactionReceipt(publicClient, { hash: txHash })
  
  return txHash
}

/**
 * Update user presence/status
 */
export async function updateUserPresence(
  sdk: SDK,
  status: UserStatus,
  statusMessage: string = ''
): Promise<string> {
  const encoder = new SchemaEncoder(userPresenceSchema)
  const schemaId = await sdk.streams.computeSchemaId(userPresenceSchema)
  
  const user = sdk.wallet?.account?.address
  if (!user) throw new Error('No wallet connected')
  
  const timestamp = Date.now()
  
  const encodedData = encoder.encodeData([
    { name: 'user', value: user, type: 'address' },
    { name: 'status', value: status.toString(), type: 'uint8' },
    { name: 'lastSeen', value: timestamp.toString(), type: 'uint64' },
    { name: 'statusMessage', value: statusMessage, type: 'string' }
  ])
  
  const txHash = await sdk.streams.set([{
    id: toHex(user, { size: 32 }),
    schemaId,
    data: encodedData
  }])
  
  return txHash || ''
}

/**
 * Fetch direct messages untuk conversation
 */
export async function fetchDirectMessages(
  sdk: SDK,
  conversationId: `0x${string}`,
  publisher: `0x${string}`,
  limit: number = 50
): Promise<DirectMessage[]> {
  const schemaId = await sdk.streams.computeSchemaId(directMessageSchema)
  const resp = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisher)
  
  const rows: any[][] = Array.isArray(resp) ? (resp as any[][]) : []
  if (!rows.length) return []
  
  const messages: DirectMessage[] = []
  
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 10) continue
    
    const msgConvId = String(val(row[1])) as `0x${string}`
    if (msgConvId.toLowerCase() !== conversationId.toLowerCase()) continue
    
    messages.push({
      timestamp: Number(val(row[0])),
      conversationId: msgConvId,
      content: String(val(row[2]) ?? ''),
      sender: String(val(row[3])) as `0x${string}`,
      recipient: String(val(row[4])) as `0x${string}`,
      messageType: Number(val(row[5])) as MessageType,
      mediaUrl: String(val(row[6]) ?? ''),
      replyToMessageId: String(val(row[7])) as `0x${string}`,
      isRead: Boolean(val(row[8])),
      isDeleted: Boolean(val(row[9]))
    })
  }
  
  // Sort by timestamp
  messages.sort((a, b) => a.timestamp - b.timestamp)
  
  return messages.slice(-limit)
}

/**
 * Fetch group messages
 */
export async function fetchGroupMessages(
  sdk: SDK,
  groupId: `0x${string}`,
  publisher: `0x${string}`,
  limit: number = 50
): Promise<GroupMessage[]> {
  const schemaId = await sdk.streams.computeSchemaId(groupMessageSchema)
  const resp = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisher)
  
  const rows: any[][] = Array.isArray(resp) ? (resp as any[][]) : []
  if (!rows.length) return []
  
  const messages: GroupMessage[] = []
  
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 8) continue
    
    const msgGroupId = String(val(row[1])) as `0x${string}`
    if (msgGroupId.toLowerCase() !== groupId.toLowerCase()) continue
    
    messages.push({
      timestamp: Number(val(row[0])),
      groupId: msgGroupId,
      content: String(val(row[2]) ?? ''),
      sender: String(val(row[3])) as `0x${string}`,
      messageType: Number(val(row[4])) as MessageType,
      mediaUrl: String(val(row[5]) ?? ''),
      replyToMessageId: String(val(row[6])) as `0x${string}`,
      isDeleted: Boolean(val(row[7]))
    })
  }
  
  messages.sort((a, b) => a.timestamp - b.timestamp)
  
  return messages.slice(-limit)
}
