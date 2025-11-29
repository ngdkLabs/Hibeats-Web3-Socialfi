/**
 * Messaging Schemas V2 - Simplified & Optimized
 * Following Twitter/Instagram best practices
 * 
 * Changes from V1:
 * - Removed encryption complexity
 * - Added message editing support
 * - Added pinned messages
 * - Better indexing with messageId as primary key
 * - Cleaner schema structure
 */

// ============================================================================
// CORE MESSAGING SCHEMAS
// ============================================================================

/**
 * Direct Messages V2 - Simplified
 * Like Twitter DM - plaintext, simple, fast
 */
export const directMessageSchemaV2 = 
  'bytes32 messageId, uint64 timestamp, bytes32 conversationId, string content, address sender, address recipient, uint8 messageType, string mediaUrl, bytes32 replyToMessageId, bool isRead, bool isDeleted, bool isEdited, uint64 editedAt'

/**
 * Group Messages V2
 */
export const groupMessageSchemaV2 = 
  'bytes32 messageId, uint64 timestamp, bytes32 groupId, string content, address sender, uint8 messageType, string mediaUrl, bytes32 replyToMessageId, bool isDeleted, bool isEdited, uint64 editedAt'

/**
 * Conversations V2 - Enhanced metadata
 */
export const conversationSchemaV2 = 
  'bytes32 conversationId, address participant1, address participant2, uint64 lastMessageTime, uint64 createdAt, bool isArchived, bool isMuted, bool isPinned, uint32 unreadCount'

/**
 * Group Metadata V2
 */
export const groupMetadataSchemaV2 = 
  'bytes32 groupId, string groupName, string groupAvatar, address creator, uint64 createdAt, uint32 memberCount, string description, bool isPrivate'

/**
 * Group Members V2
 */
export const groupMemberSchemaV2 = 
  'bytes32 groupId, address member, uint64 joinedAt, uint8 role, bool isAdmin, bool isMuted, bool isBanned'

// ============================================================================
// ENGAGEMENT SCHEMAS
// ============================================================================

/**
 * Message Reactions V2 - Like Twitter reactions
 */
export const messageReactionSchemaV2 = 
  'bytes32 messageId, address reactor, string emoji, uint64 timestamp, bool isRemoved'

/**
 * Message Status V2 - Read receipts
 */
export const messageStatusSchemaV2 = 
  'bytes32 messageId, address user, bool isDelivered, bool isRead, uint64 deliveredAt, uint64 readAt'

// ============================================================================
// REAL-TIME FEATURES
// ============================================================================

/**
 * Typing Indicators V2
 */
export const typingIndicatorSchemaV2 = 
  'bytes32 conversationId, address user, bool isTyping, uint64 timestamp'

/**
 * User Presence V2 - Online/offline status
 */
export const userPresenceSchemaV2 = 
  'address user, uint8 status, uint64 lastSeen, string statusMessage, bool isOnline'

// ============================================================================
// ADVANCED FEATURES
// ============================================================================

/**
 * Pinned Messages V2 - Like Telegram
 */
export const pinnedMessageSchemaV2 = 
  'bytes32 conversationId, bytes32 messageId, address pinnedBy, uint64 pinnedAt, bool isUnpinned'

/**
 * Message Threads V2 - Like Twitter threads
 */
export const messageThreadSchemaV2 = 
  'bytes32 threadId, bytes32 parentMessageId, bytes32 conversationId, uint32 replyCount, uint64 lastReplyAt'

/**
 * Message Mentions V2 - @mentions
 */
export const messageMentionSchemaV2 = 
  'bytes32 messageId, address mentionedUser, address mentionedBy, uint64 timestamp, bool isRead'

// ============================================================================
// ENUMS
// ============================================================================

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
  TOKEN_TRANSFER = 12,
  VOICE_NOTE = 13,
  STORY_REPLY = 14,
  MUSIC_TRACK = 15
}

export enum UserStatus {
  OFFLINE = 0,
  ONLINE = 1,
  AWAY = 2,
  BUSY = 3,
  INVISIBLE = 4
}

export enum GroupRole {
  MEMBER = 0,
  ADMIN = 1,
  OWNER = 2,
  MODERATOR = 3
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type DirectMessageV2 = {
  messageId: `0x${string}`
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
  isEdited: boolean
  editedAt: number
}

export type GroupMessageV2 = {
  messageId: `0x${string}`
  timestamp: number
  groupId: `0x${string}`
  content: string
  sender: `0x${string}`
  messageType: MessageType
  mediaUrl: string
  replyToMessageId: `0x${string}`
  isDeleted: boolean
  isEdited: boolean
  editedAt: number
}

export type ConversationV2 = {
  conversationId: `0x${string}`
  participant1: `0x${string}`
  participant2: `0x${string}`
  lastMessageTime: number
  createdAt: number
  isArchived: boolean
  isMuted: boolean
  isPinned: boolean
  unreadCount: number
}

export type GroupMetadataV2 = {
  groupId: `0x${string}`
  groupName: string
  groupAvatar: string
  creator: `0x${string}`
  createdAt: number
  memberCount: number
  description: string
  isPrivate: boolean
}

export type GroupMemberV2 = {
  groupId: `0x${string}`
  member: `0x${string}`
  joinedAt: number
  role: GroupRole
  isAdmin: boolean
  isMuted: boolean
  isBanned: boolean
}

export type MessageReactionV2 = {
  messageId: `0x${string}`
  reactor: `0x${string}`
  emoji: string
  timestamp: number
  isRemoved: boolean
}

export type MessageStatusV2 = {
  messageId: `0x${string}`
  user: `0x${string}`
  isDelivered: boolean
  isRead: boolean
  deliveredAt: number
  readAt: number
}

export type TypingIndicatorV2 = {
  conversationId: `0x${string}`
  user: `0x${string}`
  isTyping: boolean
  timestamp: number
}

export type UserPresenceV2 = {
  user: `0x${string}`
  status: UserStatus
  lastSeen: number
  statusMessage: string
  isOnline: boolean
}

export type PinnedMessageV2 = {
  conversationId: `0x${string}`
  messageId: `0x${string}`
  pinnedBy: `0x${string}`
  pinnedAt: number
  isUnpinned: boolean
}

export type MessageThreadV2 = {
  threadId: `0x${string}`
  parentMessageId: `0x${string}`
  conversationId: `0x${string}`
  replyCount: number
  lastReplyAt: number
}

export type MessageMentionV2 = {
  messageId: `0x${string}`
  mentionedUser: `0x${string}`
  mentionedBy: `0x${string}`
  timestamp: number
  isRead: boolean
}

// ============================================================================
// SCHEMA METADATA
// ============================================================================

export const schemaMetadataV2 = {
  version: '2.0.0',
  description: 'Simplified messaging system following Twitter/Instagram best practices',
  features: [
    'Plaintext messages (like Twitter DM)',
    'Message editing',
    'Pinned messages',
    'Better indexing',
    'Cleaner structure',
    'No encryption complexity'
  ],
  breaking_changes: [
    'messageId moved to first field for better indexing',
    'Added isEdited and editedAt fields',
    'Added isPinned to conversations',
    'Added unreadCount to conversations',
    'Removed encryption fields'
  ]
}
