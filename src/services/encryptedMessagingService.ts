/**
 * Encrypted Messaging Service - Layanan messaging dengan E2EE
 */

import { SDK, SchemaEncoder } from '@somnia-chain/streams'
import { toHex, type Hex } from 'viem'
import { waitForTransactionReceipt } from 'viem/actions'
import { generateConversationId, generateGroupId, generateMessageId } from '../lib/conversationUtils'
import {
  directMessageSchema,
  groupMessageSchema,
  MessageType,
  type DirectMessage,
  type GroupMessage
} from '../lib/messagingSchemas'
import {
  generateKeyPair,
  exportKeyPair,
  importKeyPair,
  importPublicKey,
  encryptMessage,
  decryptMessage,
  encryptGroupMessage,
  decryptGroupMessage,
  generateGroupKey,
  exportGroupKey,
  importGroupKey,
  encryptGroupKeyForMember,
  decryptGroupKeyForMember,
  keyStorage,
  type KeyPair,
  type EncryptedMessage
} from '../lib/encryption'

// Helper untuk mendapatkan nilai dari field
const val = (f: any) => f?.value?.value ?? f?.value

/**
 * Initialize encryption untuk user
 * Generate key pair jika belum ada dan register public key on-chain
 */
export async function initializeUserEncryption(
  userAddress: `0x${string}`,
  sdk?: SDK,
  publicClient?: any
): Promise<{ publicKey: string; privateKey: string }> {
  await keyStorage.init()

  // Check if keys already exist
  let serializedKeys = await keyStorage.getKeyPair(userAddress)
  let isNewKey = false

  if (!serializedKeys) {
    // Generate new key pair
    const keyPair = await generateKeyPair()
    serializedKeys = await exportKeyPair(keyPair)
    
    // Save to storage
    await keyStorage.saveKeyPair(userAddress, serializedKeys)
    isNewKey = true
    
    console.log('✅ New encryption keys generated for', userAddress)
  } else {
    console.log('✅ Existing encryption keys loaded for', userAddress)
  }

  // Register public key on-chain if SDK available
  if (sdk && publicClient && isNewKey) {
    try {
      const { registerPublicKey } = await import('./publicKeyRegistry')
      await registerPublicKey(sdk, publicClient, userAddress, serializedKeys.publicKey)
      console.log('✅ Public key registered on-chain')
    } catch (error) {
      console.warn('⚠️ Failed to register public key on-chain:', error)
      // Don't throw - encryption still works locally
    }
  }

  return serializedKeys
}

/**
 * Get user's public key untuk sharing
 */
export async function getUserPublicKey(
  userAddress: `0x${string}`
): Promise<string | null> {
  await keyStorage.init()
  const keys = await keyStorage.getKeyPair(userAddress)
  return keys?.publicKey || null
}

/**
 * Store recipient's public key (dari on-chain atau off-chain registry)
 */
export async function storeRecipientPublicKey(
  recipientAddress: `0x${string}`,
  publicKey: string
): Promise<void> {
  // In production, verify this public key is authentic
  // Could be stored on-chain or verified via signatures
  await keyStorage.saveKeyPair(recipientAddress, {
    publicKey,
    privateKey: '' // We don't have their private key
  })
}

/**
 * Kirim Encrypted Direct Message
 */
export async function sendEncryptedDirectMessage(
  sdk: SDK,
  publicClient: any,
  senderAddress: `0x${string}`,
  recipientAddress: `0x${string}`,
  plaintext: string,
  recipientPublicKey: string,
  messageType: MessageType = MessageType.TEXT,
  mediaUrl: string = ''
): Promise<string> {
  console.log('🔐 [ENCRYPTED MESSAGE] Preparing encrypted message...')
  console.log('   From:', senderAddress)
  console.log('   To:', recipientAddress)
  console.log('   Plaintext length:', plaintext.length)
  
  // Get sender's keys
  const senderKeys = await keyStorage.getKeyPair(senderAddress)
  if (!senderKeys) {
    console.error('❌ Sender keys not found')
    throw new Error('Sender keys not found. Initialize encryption first.')
  }

  const recipientPubKey = await importPublicKey(recipientPublicKey)

  // Encrypt message
  console.log('🔒 [ENCRYPTED MESSAGE] Encrypting message...')
  const encrypted = await encryptMessage(
    plaintext,
    recipientPubKey
  )

  // Store encrypted data as JSON string
  const encryptedContent = JSON.stringify(encrypted)
  console.log('✅ [ENCRYPTED MESSAGE] Message encrypted, length:', encryptedContent.length)

  // Send to blockchain
  const encoder = new SchemaEncoder(directMessageSchema)
  const schemaId = await sdk.streams.computeSchemaId(directMessageSchema)

  // Create conversation ID and message ID using helper functions
  const conversationId = generateConversationId(senderAddress, recipientAddress)

  const timestamp = Date.now()
  const messageId = generateMessageId(senderAddress, timestamp, 'dm')

  const encodedData = encoder.encodeData([
    { name: 'timestamp', value: timestamp.toString(), type: 'uint64' },
    { name: 'conversationId', value: conversationId, type: 'bytes32' },
    { name: 'content', value: encryptedContent, type: 'string' }, // Encrypted!
    { name: 'sender', value: senderAddress, type: 'address' },
    { name: 'recipient', value: recipientAddress, type: 'address' },
    { name: 'messageType', value: messageType.toString(), type: 'uint8' },
    { name: 'mediaUrl', value: mediaUrl, type: 'string' },
    { name: 'replyToMessageId', value: '0x0000000000000000000000000000000000000000000000000000000000000000', type: 'bytes32' },
    { name: 'isRead', value: false, type: 'bool' },
    { name: 'isDeleted', value: false, type: 'bool' }
  ])

  console.log('📤 [ENCRYPTED MESSAGE] Sending to blockchain...')
  
  try {
    console.log('   Calling sdk.streams.set...')
    
    // Send message encrypted for recipient
    const txHash = await sdk.streams.set([{
      id: messageId,
      schemaId,
      data: encodedData
    }])

    if (!txHash) {
      console.error('❌ No transaction hash returned')
      throw new Error('Failed to send encrypted message - no transaction hash')
    }
    
    console.log('⏳ [ENCRYPTED MESSAGE] Transaction sent:', txHash)
    await waitForTransactionReceipt(publicClient, { hash: txHash })
    
    // DUAL ENCRYPTION: Also encrypt for sender so they can see their own message
    try {
      console.log('🔐 [DUAL ENCRYPTION] Encrypting copy for sender...')
      
      // Encrypt with sender's own public key
      const senderPubKey = await importPublicKey(senderKeys.publicKey)
      const encryptedForSender = await encryptMessage(
        plaintext,
        senderPubKey
      )
      
      const encryptedForSenderContent = JSON.stringify(encryptedForSender)
      
      // Create sender copy message ID
      const senderMessageId = generateMessageId(senderAddress, timestamp, 'dm-sender')
      
      const senderEncodedData = encoder.encodeData([
        { name: 'timestamp', value: timestamp.toString(), type: 'uint64' },
        { name: 'conversationId', value: conversationId, type: 'bytes32' },
        { name: 'content', value: encryptedForSenderContent, type: 'string' },
        { name: 'sender', value: senderAddress, type: 'address' },
        { name: 'recipient', value: recipientAddress, type: 'address' },
        { name: 'messageType', value: messageType.toString(), type: 'uint8' },
        { name: 'mediaUrl', value: mediaUrl, type: 'string' },
        { name: 'replyToMessageId', value: '0x0000000000000000000000000000000000000000000000000000000000000000', type: 'bytes32' },
        { name: 'isRead', value: false, type: 'bool' },
        { name: 'isDeleted', value: false, type: 'bool' }
      ])
      
      // Send sender's copy (don't wait for confirmation)
      sdk.streams.set([{
        id: senderMessageId,
        schemaId,
        data: senderEncodedData
      }]).then(() => {
        console.log('✅ [DUAL ENCRYPTION] Sender copy saved')
      }).catch((e) => {
        console.warn('⚠️ [DUAL ENCRYPTION] Failed to save sender copy:', e)
      })
      
    } catch (dualEncError) {
      console.warn('⚠️ [DUAL ENCRYPTION] Failed, but main message sent:', dualEncError)
      // Don't throw - main message was sent successfully
    }
    
    console.log('✅ [ENCRYPTED MESSAGE] Message sent successfully!')
    return txHash
  } catch (error: any) {
    console.error('❌ [ENCRYPTED MESSAGE] Failed:', error)
    throw new Error(`Failed to send encrypted message: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Decrypt received direct message
 * Mendukung format baru (ephemeral key) dan format lama (sender public key)
 * 
 * Format baru: WhatsApp/Signal style dengan ephemeral keys
 * Format lama: Backward compatibility untuk pesan yang sudah ada
 */
export async function decryptDirectMessage(
  encryptedContent: string,
  recipientAddress: `0x${string}`,
  senderAddress?: `0x${string}`,
  sdk?: SDK
): Promise<string> {
  console.log('🔓 [DECRYPT] Attempting to decrypt message...')
  console.log('   Recipient:', recipientAddress)
  console.log('   Sender:', senderAddress || 'unknown')
  console.log('   Encrypted content length:', encryptedContent.length)
  
  try {
    // Parse encrypted data
    const encrypted: EncryptedMessage = JSON.parse(encryptedContent)
    console.log('   ✅ Parsed encrypted data')

    // Get recipient's keys
    const recipientKeys = await keyStorage.getKeyPair(recipientAddress)
    if (!recipientKeys || !recipientKeys.privateKey) {
      console.error('   ❌ Recipient keys not found in storage')
      throw new Error('Recipient keys not found')
    }
    console.log('   ✅ Found recipient keys')

    const recipientKeyPair = await importKeyPair(recipientKeys)
    console.log('   ✅ Imported recipient key pair')

    // NEW FORMAT: Menggunakan ephemeral key (preferred)
    if (encrypted.ephemeralPublicKey) {
      console.log('   ✅ Found ephemeral public key - using NEW format')
      const plaintext = await decryptMessage(encrypted, recipientKeyPair.privateKey)
      console.log('   ✅ Decryption successful!')
      console.log('   Plaintext:', plaintext.substring(0, 50))
      return plaintext
    }
    
    // OLD FORMAT: Fallback ke sender's public key (backward compatibility)
    else if (senderAddress && sdk) {
      console.log('   ⚠️ No ephemeral key - trying OLD format with sender public key')
      
      try {
        // Fetch sender's public key from on-chain
        const { fetchPublicKey } = await import('./publicKeyRegistry')
        const senderPublicKeyBase64 = await fetchPublicKey(sdk, senderAddress)
        
        if (senderPublicKeyBase64) {
          console.log('   ✅ Found sender public key from registry')
          const senderPublicKey = await importPublicKey(senderPublicKeyBase64)
          const plaintext = await decryptMessage(encrypted, recipientKeyPair.privateKey, senderPublicKey)
          console.log('   ✅ Decryption successful with OLD format!')
          return plaintext
        } else {
          console.error('   ❌ Sender public key not found in registry')
          throw new Error('Sender public key not found')
        }
      } catch (oldFormatError) {
        console.error('   ❌ OLD format decryption failed:', oldFormatError)
        throw oldFormatError
      }
    }
    
    // NO FORMAT: Error
    else {
      console.error('   ❌ No ephemeral key and no sender info for fallback')
      throw new Error('Invalid encrypted message format - no ephemeral key or sender info')
    }
  } catch (error: any) {
    console.error('   ❌ Decryption failed:', error.message)
    console.error('   Error details:', error)
    return '[Encrypted Message - Unable to Decrypt]'
  }
}

/**
 * Fetch dan decrypt direct messages from BOTH participants
 */
export async function fetchEncryptedDirectMessages(
  sdk: SDK,
  conversationId: `0x${string}`,
  participant1: `0x${string}`,
  participant2: `0x${string}`,
  currentUserAddress: `0x${string}`,
  limit: number = 50
): Promise<Array<DirectMessage & { decrypted: boolean; plaintext?: string }>> {
  const schemaId = await sdk.streams.computeSchemaId(directMessageSchema)
  
  console.log('📬 [FETCH MESSAGES] Fetching from both participants...')
  console.log('   Participant 1:', participant1)
  console.log('   Participant 2:', participant2)
  console.log('   Conversation ID:', conversationId)
  
  // Fetch messages from BOTH participants
  const [resp1, resp2] = await Promise.all([
    sdk.streams.getAllPublisherDataForSchema(schemaId, participant1).catch(() => []),
    sdk.streams.getAllPublisherDataForSchema(schemaId, participant2).catch(() => [])
  ])

  const rows1: any[][] = Array.isArray(resp1) ? (resp1 as any[][]) : []
  const rows2: any[][] = Array.isArray(resp2) ? (resp2 as any[][]) : []
  
  console.log('   Messages from participant 1:', rows1.length)
  console.log('   Messages from participant 2:', rows2.length)
  
  // Combine all rows
  const allRows = [...rows1, ...rows2]
  if (!allRows.length) {
    console.log('   No messages found')
    return []
  }

  const messages: Array<DirectMessage & { decrypted: boolean; plaintext?: string }> = []

  for (const row of allRows) {
    if (!Array.isArray(row) || row.length < 10) continue

    const msgConvId = String(val(row[1])) as `0x${string}`
    if (msgConvId.toLowerCase() !== conversationId.toLowerCase()) continue

    const encryptedContent = String(val(row[2]) ?? '')
    const sender = String(val(row[3])) as `0x${string}`
    const recipient = String(val(row[4])) as `0x${string}`
    const timestamp = Number(val(row[0]))
    const isDeleted = Boolean(val(row[9]))

    // Skip deleted messages
    if (isDeleted) {
      console.log(`   ⏭️ Skipping DELETED message from ${sender.substring(0, 10)}... at ${timestamp}`)
      continue
    }

    // Try to decrypt message
    let plaintext: string | undefined
    let decrypted = false

    console.log('📨 [FETCH] Processing message...')
    console.log('   Sender:', sender)
    console.log('   Recipient:', recipient)
    console.log('   Current user:', currentUserAddress)

    if (recipient.toLowerCase() === currentUserAddress.toLowerCase()) {
      // We're the recipient - decrypt with our private key
      console.log('   → We are the RECIPIENT, attempting decrypt...')
      try {
        plaintext = await decryptDirectMessage(encryptedContent, currentUserAddress, sender, sdk)
        if (plaintext !== '[Encrypted Message - Unable to Decrypt]') {
          decrypted = true
          console.log('   ✅ Decrypted as recipient')
        } else {
          console.log('   ❌ Failed to decrypt as recipient')
        }
      } catch (error) {
        console.error('   ❌ Decryption failed for message:', error)
        plaintext = '[Unable to decrypt this message]'
      }
    } else if (sender.toLowerCase() === currentUserAddress.toLowerCase()) {
      // We're the sender - try to decrypt with our own key
      console.log('   → We are the SENDER, attempting decrypt...')
      try {
        plaintext = await decryptDirectMessage(encryptedContent, currentUserAddress, sender, sdk)
        if (plaintext !== '[Encrypted Message - Unable to Decrypt]') {
          decrypted = true
          console.log('   ✅ Decrypted as sender (dual encryption worked!)')
        } else {
          console.log('   ⚠️ Cannot decrypt own message (no dual encryption copy)')
          plaintext = '[Your encrypted message - visible to recipient only]'
          decrypted = false
        }
      } catch (error) {
        console.log('   ⚠️ Cannot decrypt own message (encrypted for recipient)')
        plaintext = '[Your encrypted message - visible to recipient only]'
        decrypted = false
      }
    }

    messages.push({
      timestamp: Number(val(row[0])),
      conversationId: msgConvId,
      content: encryptedContent,
      sender,
      recipient,
      messageType: Number(val(row[5])) as MessageType,
      mediaUrl: String(val(row[6]) ?? ''),
      replyToMessageId: String(val(row[7])) as `0x${string}`,
      isRead: Boolean(val(row[8])),
      isDeleted: Boolean(val(row[9])),
      decrypted,
      plaintext
    })
  }

  messages.sort((a, b) => a.timestamp - b.timestamp)
  return messages.slice(-limit)
}

/**
 * Create encrypted group dengan shared key
 */
export async function createEncryptedGroup(
  sdk: SDK,
  publicClient: any,
  groupName: string,
  creatorAddress: `0x${string}`,
  description: string = ''
): Promise<{ groupId: `0x${string}`; groupKey: string }> {
  // Generate group key
  const groupKey = await generateGroupKey()
  const groupKeyBase64 = await exportGroupKey(groupKey)

  // Create group (same as before)
  const timestamp = Date.now()
  const groupId = toHex(`group-${creatorAddress}-${timestamp}`, { size: 32 })

  // Store group key locally
  await keyStorage.saveGroupKey(groupId, groupKeyBase64)

  console.log('✅ Encrypted group created with ID:', groupId)

  return { groupId, groupKey: groupKeyBase64 }
}

/**
 * Share group key dengan member baru
 */
export async function shareGroupKeyWithMember(
  groupId: `0x${string}`,
  memberAddress: `0x${string}`,
  memberPublicKey: string,
  senderAddress: `0x${string}`
): Promise<EncryptedMessage> {
  // Get group key
  const groupKeyBase64 = await keyStorage.getGroupKey(groupId)
  if (!groupKeyBase64) {
    throw new Error('Group key not found')
  }

  const groupKey = await importGroupKey(groupKeyBase64)

  // Get sender's keys
  const senderKeys = await keyStorage.getKeyPair(senderAddress)
  if (!senderKeys) {
    throw new Error('Sender keys not found')
  }

  const memberPubKey = await importPublicKey(memberPublicKey)

  // Encrypt group key for member
  const encryptedGroupKey = await encryptGroupKeyForMember(
    groupKey,
    memberPubKey
  )

  return encryptedGroupKey
}

/**
 * Receive dan simpan group key
 */
export async function receiveGroupKey(
  groupId: `0x${string}`,
  encryptedGroupKey: EncryptedMessage,
  recipientAddress: `0x${string}`
): Promise<void> {
  // Get recipient's keys
  const recipientKeys = await keyStorage.getKeyPair(recipientAddress)
  if (!recipientKeys) {
    throw new Error('Recipient keys not found')
  }

  const recipientKeyPair = await importKeyPair(recipientKeys)

  // Decrypt group key menggunakan ephemeral key dari pesan
  const groupKey = await decryptGroupKeyForMember(
    encryptedGroupKey,
    recipientKeyPair.privateKey
  )

  // Store group key
  const groupKeyBase64 = await exportGroupKey(groupKey)
  await keyStorage.saveGroupKey(groupId, groupKeyBase64)

  console.log('✅ Group key received and stored for group:', groupId)
}

/**
 * Send encrypted group message
 */
export async function sendEncryptedGroupMessage(
  sdk: SDK,
  publicClient: any,
  groupId: `0x${string}`,
  senderAddress: `0x${string}`,
  plaintext: string,
  messageType: MessageType = MessageType.TEXT,
  mediaUrl: string = ''
): Promise<string> {
  // Get group key
  const groupKeyBase64 = await keyStorage.getGroupKey(groupId)
  if (!groupKeyBase64) {
    throw new Error('Group key not found. You may not be a member of this group.')
  }

  const groupKey = await importGroupKey(groupKeyBase64)

  // Encrypt message
  const encrypted = await encryptGroupMessage(plaintext, groupKey)
  const encryptedContent = JSON.stringify(encrypted)

  // Send to blockchain
  const encoder = new SchemaEncoder(groupMessageSchema)
  const schemaId = await sdk.streams.computeSchemaId(groupMessageSchema)

  const timestamp = Date.now()
  const messageId = toHex(`group-${groupId}-${timestamp}`, { size: 32 })

  const encodedData = encoder.encodeData([
    { name: 'timestamp', value: timestamp.toString(), type: 'uint64' },
    { name: 'groupId', value: groupId, type: 'bytes32' },
    { name: 'content', value: encryptedContent, type: 'string' }, // Encrypted!
    { name: 'sender', value: senderAddress, type: 'address' },
    { name: 'messageType', value: messageType.toString(), type: 'uint8' },
    { name: 'mediaUrl', value: mediaUrl, type: 'string' },
    { name: 'replyToMessageId', value: '0x0000000000000000000000000000000000000000000000000000000000000000', type: 'bytes32' },
    { name: 'isDeleted', value: false, type: 'bool' }
  ])

  const txHash = await sdk.streams.set([{
    id: messageId,
    schemaId,
    data: encodedData
  }])

  if (!txHash) throw new Error('Failed to send encrypted group message')
  await waitForTransactionReceipt(publicClient, { hash: txHash })

  return txHash
}

/**
 * Decrypt group message
 */
export async function decryptGroupMessageContent(
  encryptedContent: string,
  groupId: `0x${string}`
): Promise<string> {
  try {
    // Parse encrypted data
    const encrypted: { ciphertext: string; iv: string } = JSON.parse(encryptedContent)

    // Get group key
    const groupKeyBase64 = await keyStorage.getGroupKey(groupId)
    if (!groupKeyBase64) {
      throw new Error('Group key not found')
    }

    const groupKey = await importGroupKey(groupKeyBase64)

    // Decrypt
    const plaintext = await decryptGroupMessage(
      encrypted.ciphertext,
      encrypted.iv,
      groupKey
    )
    return plaintext
  } catch (error) {
    console.error('Failed to decrypt group message:', error)
    return '[Encrypted Message - Unable to Decrypt]'
  }
}

/**
 * Fetch dan decrypt group messages
 */
export async function fetchEncryptedGroupMessages(
  sdk: SDK,
  groupId: `0x${string}`,
  publisher: `0x${string}`,
  limit: number = 50
): Promise<Array<GroupMessage & { decrypted: boolean; plaintext?: string }>> {
  const schemaId = await sdk.streams.computeSchemaId(groupMessageSchema)
  const resp = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisher)

  const rows: any[][] = Array.isArray(resp) ? (resp as any[][]) : []
  if (!rows.length) return []

  const messages: Array<GroupMessage & { decrypted: boolean; plaintext?: string }> = []

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 8) continue

    const msgGroupId = String(val(row[1])) as `0x${string}`
    if (msgGroupId.toLowerCase() !== groupId.toLowerCase()) continue

    const encryptedContent = String(val(row[2]) ?? '')

    // Try to decrypt
    let plaintext: string | undefined
    let decrypted = false

    try {
      plaintext = await decryptGroupMessageContent(encryptedContent, groupId)
      decrypted = true
    } catch (error) {
      console.error('Decryption failed for group message:', error)
    }

    messages.push({
      timestamp: Number(val(row[0])),
      groupId: msgGroupId,
      content: encryptedContent,
      sender: String(val(row[3])) as `0x${string}`,
      messageType: Number(val(row[4])) as MessageType,
      mediaUrl: String(val(row[5]) ?? ''),
      replyToMessageId: String(val(row[6])) as `0x${string}`,
      isDeleted: Boolean(val(row[7])),
      decrypted,
      plaintext
    })
  }

  messages.sort((a, b) => a.timestamp - b.timestamp)
  return messages.slice(-limit)
}

/**
 * Export keys untuk backup
 */
export async function exportKeysForBackup(
  userAddress: `0x${string}`,
  password: string
): Promise<string> {
  const keys = await keyStorage.getKeyPair(userAddress)
  if (!keys) {
    throw new Error('No keys found to backup')
  }

  // In production, encrypt this with password before exporting
  // For now, just return as JSON
  const backup = {
    address: userAddress,
    keys,
    timestamp: Date.now()
  }

  return JSON.stringify(backup)
}

/**
 * Import keys dari backup
 */
export async function importKeysFromBackup(
  backupData: string,
  password: string
): Promise<void> {
  // In production, decrypt with password first
  const backup = JSON.parse(backupData)

  await keyStorage.saveKeyPair(backup.address, backup.keys)
  console.log('✅ Keys restored from backup')
}

/**
 * Delete all encryption keys (logout/reset)
 */
export async function deleteAllKeys(userAddress: `0x${string}`): Promise<void> {
  await keyStorage.deleteKeyPair(userAddress)
  console.log('✅ All encryption keys deleted')
}

/**
 * Clear chat - Mark all messages as deleted in a conversation
 * Note: Ini hanya soft delete (set isDeleted = true), data tetap di blockchain
 */
export async function clearDirectMessageChat(
  sdk: SDK,
  publicClient: any,
  conversationId: `0x${string}`,
  participant1: `0x${string}`,
  participant2: `0x${string}`,
  currentUserAddress: `0x${string}`
): Promise<string[]> {
  console.log('🗑️ [CLEAR CHAT] Clearing conversation...')
  console.log('   Conversation ID:', conversationId)
  console.log('   Current user:', currentUserAddress)

  const schemaId = await sdk.streams.computeSchemaId(directMessageSchema)
  if (!schemaId) {
    throw new Error('Failed to compute schema ID')
  }
  console.log('   Schema ID:', schemaId)
  
  // Fetch all messages from both participants
  const [resp1, resp2] = await Promise.all([
    sdk.streams.getAllPublisherDataForSchema(schemaId, participant1).catch(() => []),
    sdk.streams.getAllPublisherDataForSchema(schemaId, participant2).catch(() => [])
  ])

  const rows1: any[][] = Array.isArray(resp1) ? (resp1 as any[][]) : []
  const rows2: any[][] = Array.isArray(resp2) ? (resp2 as any[][]) : []
  
  const allRows = [...rows1, ...rows2]
  
  if (!allRows.length) {
    console.log('   No messages to clear')
    return []
  }

  const encoder = new SchemaEncoder(directMessageSchema)
  const txHashes: string[] = []
  const messagesToDelete: any[] = []

  // Collect messages to delete
  console.log(`   Processing ${allRows.length} total rows...`)
  
  for (const row of allRows) {
    if (!Array.isArray(row) || row.length < 10) {
      console.log('   ⏭️ Skipping invalid row (length:', row?.length, ')')
      continue
    }

    const msgConvId = String(val(row[1])) as `0x${string}`
    const sender = String(val(row[3])) as `0x${string}`
    const isDeleted = Boolean(val(row[9]))

    console.log(`   📨 Message: convId=${msgConvId.substring(0, 10)}..., sender=${sender.substring(0, 10)}..., deleted=${isDeleted}`)

    // Check conversation ID
    if (msgConvId.toLowerCase() !== conversationId.toLowerCase()) {
      console.log('   ⏭️ Skipping - different conversation')
      continue
    }

    // Check if already deleted
    if (isDeleted) {
      console.log('   ⏭️ Skipping - already deleted')
      continue
    }

    // Check if sender is current user
    if (sender.toLowerCase() !== currentUserAddress.toLowerCase()) {
      console.log('   ⏭️ Skipping - not sent by current user')
      continue
    }

    // Add to delete list
    console.log('   ✅ Adding to delete list')
    messagesToDelete.push({
      timestamp: Number(val(row[0])),
      conversationId: msgConvId,
      content: String(val(row[2]) ?? ''),
      sender,
      recipient: String(val(row[4])) as `0x${string}`,
      messageType: Number(val(row[5])) as MessageType,
      mediaUrl: String(val(row[6]) ?? ''),
      replyToMessageId: String(val(row[7])) as `0x${string}`,
      isRead: Boolean(val(row[8]))
    })
  }

  console.log(`   ✅ Found ${messagesToDelete.length} messages to delete`)

  // Mark each message as deleted
  if (messagesToDelete.length === 0) {
    console.log('   ℹ️ No messages to delete')
    return []
  }

  console.log(`\n   🗑️ Deleting ${messagesToDelete.length} messages...`)
  
  for (let i = 0; i < messagesToDelete.length; i++) {
    const msg = messagesToDelete[i]
    try {
      console.log(`\n   [${i + 1}/${messagesToDelete.length}] Processing message...`)
      console.log(`      Timestamp: ${msg.timestamp}`)
      console.log(`      Sender: ${msg.sender}`)
      
      const messageId = generateMessageId(msg.sender, msg.timestamp, 'dm')
      console.log(`      Message ID: ${messageId}`)
      
      const encodedData = encoder.encodeData([
        { name: 'timestamp', value: msg.timestamp.toString(), type: 'uint64' },
        { name: 'conversationId', value: msg.conversationId, type: 'bytes32' },
        { name: 'content', value: msg.content, type: 'string' },
        { name: 'sender', value: msg.sender, type: 'address' },
        { name: 'recipient', value: msg.recipient, type: 'address' },
        { name: 'messageType', value: msg.messageType.toString(), type: 'uint8' },
        { name: 'mediaUrl', value: msg.mediaUrl, type: 'string' },
        { name: 'replyToMessageId', value: msg.replyToMessageId, type: 'bytes32' },
        { name: 'isRead', value: msg.isRead, type: 'bool' },
        { name: 'isDeleted', value: true, type: 'bool' } // ✅ Mark as deleted
      ])

      console.log(`      Sending transaction...`)
      const txHash = await sdk.streams.set([{
        id: messageId,
        schemaId,
        data: encodedData
      }])

      if (txHash) {
        txHashes.push(txHash)
        console.log(`      ✅ Transaction sent: ${txHash}`)
      } else {
        console.log(`      ⚠️ No transaction hash returned`)
      }
    } catch (error: any) {
      console.error(`      ❌ Failed to delete message:`, error.message)
      console.error(`      Error details:`, error)
    }
  }

  // Wait for all transactions
  if (txHashes.length > 0) {
    console.log(`   ⏳ Waiting for ${txHashes.length} transactions...`)
    await Promise.all(
      txHashes.map(hash => 
        waitForTransactionReceipt(publicClient, { hash: hash as `0x${string}` }).catch(e => {
          console.warn('   ⚠️ Transaction receipt failed:', e)
        })
      )
    )
    console.log('   ✅ All messages marked as deleted')
  }

  return txHashes
}
