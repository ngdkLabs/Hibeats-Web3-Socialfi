/**
 * Somnia DataStream Schemas untuk Sistem Messaging
 * Mendukung fitur seperti Instagram, Twitter, Facebook, Farcaster
 */

// 1. Schema untuk Direct Messages (DM) - Pesan 1-on-1
export const directMessageSchema = 
  'uint64 timestamp, bytes32 conversationId, string content, address sender, address recipient, uint8 messageType, string mediaUrl, bytes32 replyToMessageId, bool isRead, bool isDeleted'

// 2. Schema untuk Group Messages - Pesan grup
export const groupMessageSchema = 
  'uint64 timestamp, bytes32 groupId, string content, address sender, uint8 messageType, string mediaUrl, bytes32 replyToMessageId, bool isDeleted'

// 3. Schema untuk Conversations - Metadata percakapan
export const conversationSchema = 
  'bytes32 conversationId, address participant1, address participant2, uint64 lastMessageTime, uint64 createdAt, bool isArchived, bool isMuted'

// 4. Schema untuk Group Metadata
export const groupMetadataSchema = 
  'bytes32 groupId, string groupName, string groupAvatar, address creator, uint64 createdAt, uint32 memberCount, string description'

// 5. Schema untuk Group Members
export const groupMemberSchema = 
  'bytes32 groupId, address member, uint64 joinedAt, uint8 role, bool isAdmin, bool isMuted'

// 6. Schema untuk Message Reactions - Reaksi emoji
export const messageReactionSchema = 
  'bytes32 messageId, address reactor, string emoji, uint64 timestamp, bool isRemoved'

// 7. Schema untuk Typing Indicators
export const typingIndicatorSchema = 
  'bytes32 conversationId, address user, bool isTyping, uint64 timestamp'

// 8. Schema untuk Message Status - Read receipts
export const messageStatusSchema = 
  'bytes32 messageId, address user, bool isDelivered, bool isRead, uint64 deliveredAt, uint64 readAt'

// 9. Schema untuk Message Threads - Thread/balasan
export const messageThreadSchema = 
  'bytes32 threadId, bytes32 parentMessageId, bytes32 conversationId, uint32 replyCount, uint64 lastReplyAt'

// 10. Schema untuk User Presence - Online/offline status
export const userPresenceSchema = 
  'address user, uint8 status, uint64 lastSeen, string statusMessage'

// Message Types Enum
export enum MessageType {
  TEXT = 0,
  IMAGE = 1,
  VIDEO = 2,
  AUDIO = 3,
  FILE = 4,
  LINK = 5,
  GIF = 6,
  STICKER = 7,
  LOCATION = 8,
  CONTACT = 9,
  POLL = 10,
  NFT = 11,
  TOKEN_TRANSFER = 12
}

// User Status Enum
export enum UserStatus {
  OFFLINE = 0,
  ONLINE = 1,
  AWAY = 2,
  BUSY = 3,
  INVISIBLE = 4
}

// Group Role Enum
export enum GroupRole {
  MEMBER = 0,
  ADMIN = 1,
  OWNER = 2
}

// Type definitions untuk TypeScript
export type DirectMessage = {
  timestamp: number
  conversationId: `0x${string}`
  content: string
  sender: `0x${string}`
  recipient: `0x${string}`
  messageType: MessageType
  mediaUrl: string
  replyToMessageId: `0x${string}`
  isRead: boolean
  isDeleted: boolean
}

export type GroupMessage = {
  timestamp: number
  groupId: `0x${string}`
  content: string
  sender: `0x${string}`
  messageType: MessageType
  mediaUrl: string
  replyToMessageId: `0x${string}`
  isDeleted: boolean
}

export type Conversation = {
  conversationId: `0x${string}`
  participant1: `0x${string}`
  participant2: `0x${string}`
  lastMessageTime: number
  createdAt: number
  isArchived: boolean
  isMuted: boolean
}

export type GroupMetadata = {
  groupId: `0x${string}`
  groupName: string
  groupAvatar: string
  creator: `0x${string}`
  createdAt: number
  memberCount: number
  description: string
}

export type GroupMember = {
  groupId: `0x${string}`
  member: `0x${string}`
  joinedAt: number
  role: GroupRole
  isAdmin: boolean
  isMuted: boolean
}

export type MessageReaction = {
  messageId: `0x${string}`
  reactor: `0x${string}`
  emoji: string
  timestamp: number
  isRemoved: boolean
}

export type TypingIndicator = {
  conversationId: `0x${string}`
  user: `0x${string}`
  isTyping: boolean
  timestamp: number
}

export type MessageStatus = {
  messageId: `0x${string}`
  user: `0x${string}`
  isDelivered: boolean
  isRead: boolean
  deliveredAt: number
  readAt: number
}

export type MessageThread = {
  threadId: `0x${string}`
  parentMessageId: `0x${string}`
  conversationId: `0x${string}`
  replyCount: number
  lastReplyAt: number
}

export type UserPresence = {
  user: `0x${string}`
  status: UserStatus
  lastSeen: number
  statusMessage: string
}

// 11. Schema untuk Public Key Registry - For E2EE
export const publicKeyRegistrySchema = 
  'address user, string publicKey, uint64 registeredAt, uint64 updatedAt'
