/**
 * Conversation Utilities
 * Helper functions untuk messaging system
 */

import { keccak256, toBytes } from 'viem'

/**
 * Generate conversation ID yang konsisten untuk 2 addresses
 * Menggunakan keccak256 hash untuk menghasilkan 32-byte ID
 * 
 * @param address1 - First participant address
 * @param address2 - Second participant address
 * @returns 32-byte conversation ID (0x...)
 */
export function generateConversationId(
  address1: string,
  address2: string
): `0x${string}` {
  // Normalize addresses (lowercase) dan sort untuk konsistensi
  const [addr1, addr2] = [address1.toLowerCase(), address2.toLowerCase()].sort()
  
  // Buat string unik dari kedua addresses
  const conversationString = `${addr1}-${addr2}`
  
  // Hash dengan keccak256 untuk mendapatkan 32-byte ID
  const conversationId = keccak256(toBytes(conversationString)) as `0x${string}`
  
  return conversationId
}

/**
 * Generate group ID yang unik
 * 
 * @param creatorAddress - Creator's address
 * @param timestamp - Creation timestamp
 * @returns 32-byte group ID (0x...)
 */
export function generateGroupId(
  creatorAddress: string,
  timestamp: number = Date.now()
): `0x${string}` {
  const groupString = `group-${creatorAddress.toLowerCase()}-${timestamp}`
  const groupId = keccak256(toBytes(groupString)) as `0x${string}`
  
  return groupId
}

/**
 * Generate message ID yang unik
 * 
 * @param senderAddress - Sender's address
 * @param timestamp - Message timestamp
 * @param prefix - Optional prefix (default: 'msg')
 * @returns 32-byte message ID (0x...)
 */
export function generateMessageId(
  senderAddress: string,
  timestamp: number = Date.now(),
  prefix: string = 'msg'
): `0x${string}` {
  const messageString = `${prefix}-${senderAddress.toLowerCase()}-${timestamp}`
  const messageId = keccak256(toBytes(messageString)) as `0x${string}`
  
  return messageId
}
