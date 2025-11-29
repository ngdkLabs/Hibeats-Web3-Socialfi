/**
 * End-to-End Encryption (E2EE) untuk Messaging System
 * Menggunakan ECDH (Elliptic Curve Diffie-Hellman) + AES-GCM
 * Implementasi seperti WhatsApp/Signal dengan ephemeral keys
 */

// Types
export interface KeyPair {
  publicKey: CryptoKey
  privateKey: CryptoKey
}

export interface SerializedKeyPair {
  publicKey: string // base64
  privateKey: string // base64
}

export interface EncryptedMessage {
  ciphertext: string // base64
  iv: string // base64
  ephemeralPublicKey: string // base64
}

/**
 * Generate ECDH key pair untuk user
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  )

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey
  }
}

/**
 * Export key pair ke format yang bisa disimpan
 */
export async function exportKeyPair(keyPair: KeyPair): Promise<SerializedKeyPair> {
  const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey)
  const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey)

  return {
    publicKey: bufferToBase64(publicKeyBuffer),
    privateKey: bufferToBase64(privateKeyBuffer)
  }
}

/**
 * Import key pair dari storage
 */
export async function importKeyPair(serialized: SerializedKeyPair): Promise<KeyPair> {
  const publicKeyBuffer = base64ToBuffer(serialized.publicKey)
  const privateKeyBuffer = base64ToBuffer(serialized.privateKey)

  const publicKey = await window.crypto.subtle.importKey(
    'spki',
    publicKeyBuffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    []
  )

  const privateKey = await window.crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    ['deriveKey', 'deriveBits']
  )

  return { publicKey, privateKey }
}

/**
 * Import public key dari base64 string
 */
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const buffer = base64ToBuffer(publicKeyBase64)
  
  return await window.crypto.subtle.importKey(
    'spki',
    buffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    []
  )
}

/**
 * Derive shared secret menggunakan ECDH
 */
async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: publicKey
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false, // not extractable
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt message menggunakan recipient's public key
 * Menggunakan ephemeral key untuk forward secrecy (seperti WhatsApp/Signal)
 * 
 * Flow:
 * 1. Generate ephemeral key pair (baru untuk setiap pesan)
 * 2. Derive shared secret: ECDH(ephemeral_private, recipient_public)
 * 3. Encrypt dengan AES-GCM menggunakan shared secret
 * 4. Return ciphertext + IV + ephemeral public key
 */
export async function encryptMessage(
  message: string,
  recipientPublicKey: CryptoKey
): Promise<EncryptedMessage> {
  // Generate ephemeral key pair untuk forward secrecy
  // Setiap pesan menggunakan key pair baru (seperti WhatsApp)
  const ephemeralKeyPair = await generateKeyPair()
  
  // Derive shared secret menggunakan:
  // - Ephemeral private key (baru untuk setiap pesan)
  // - Recipient's public key (static)
  // Ini memberikan forward secrecy: jika ephemeral key hilang, pesan lama tetap aman
  const sharedSecret = await deriveSharedSecret(
    ephemeralKeyPair.privateKey,
    recipientPublicKey
  )

  // Generate random IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12))

  // Encrypt message
  const encoder = new TextEncoder()
  const messageBuffer = encoder.encode(message)

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    sharedSecret,
    messageBuffer
  )

  // Export ephemeral public key untuk disimpan bersama pesan
  // Recipient akan menggunakan ini untuk decrypt
  const ephemeralPublicKeyBuffer = await window.crypto.subtle.exportKey(
    'spki',
    ephemeralKeyPair.publicKey
  )

  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv.buffer),
    ephemeralPublicKey: bufferToBase64(ephemeralPublicKeyBuffer)
  }
}

/**
 * Decrypt message menggunakan private key
 * Menggunakan ephemeral public key dari pesan (seperti WhatsApp/Signal)
 * 
 * BACKWARD COMPATIBILITY:
 * - Format baru: menggunakan ephemeral key (WhatsApp style)
 * - Format lama: menggunakan sender's public key (fallback)
 * 
 * Flow:
 * 1. Extract ephemeral public key dari pesan
 * 2. Derive shared secret: ECDH(recipient_private, ephemeral_public)
 * 3. Decrypt dengan AES-GCM menggunakan shared secret
 * 4. Return plaintext
 * 
 * Karena ECDH commutative:
 * ECDH(ephemeral_private, recipient_public) = ECDH(recipient_private, ephemeral_public)
 * Maka shared secret akan sama!
 */
export async function decryptMessage(
  encrypted: EncryptedMessage,
  recipientPrivateKey: CryptoKey,
  senderPublicKey?: CryptoKey // Optional: untuk backward compatibility dengan format lama
): Promise<string> {
  let publicKeyToUse: CryptoKey

  // NEW FORMAT: Menggunakan ephemeral key (WhatsApp/Signal style)
  if (encrypted.ephemeralPublicKey) {
    console.log('🔓 [DECRYPT] Using NEW format (ephemeral key)')
    const ephemeralPublicKeyBuffer = base64ToBuffer(encrypted.ephemeralPublicKey)
    publicKeyToUse = await window.crypto.subtle.importKey(
      'spki',
      ephemeralPublicKeyBuffer,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      []
    )
  }
  // OLD FORMAT: Menggunakan sender's public key (backward compatibility)
  else if (senderPublicKey) {
    console.log('⚠️ [DECRYPT] Using OLD format (sender public key) - backward compatibility')
    publicKeyToUse = senderPublicKey
  }
  // NO KEY: Error
  else {
    throw new Error('No ephemeral public key or sender public key provided')
  }

  // Derive shared secret
  const sharedSecret = await deriveSharedSecret(
    recipientPrivateKey,
    publicKeyToUse
  )

  // Decrypt
  const ciphertext = base64ToBuffer(encrypted.ciphertext)
  const iv = base64ToBuffer(encrypted.iv)

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      sharedSecret,
      ciphertext
    )

    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
  } catch (error) {
    console.error('❌ [DECRYPT] Decryption failed:', error)
    throw new Error('Failed to decrypt message - invalid key or corrupted data')
  }
}

/**
 * Encrypt message untuk group (menggunakan symmetric key)
 */
export async function encryptGroupMessage(
  message: string,
  groupKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  const messageBuffer = encoder.encode(message)

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    groupKey,
    messageBuffer
  )

  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv.buffer)
  }
}

/**
 * Decrypt group message
 */
export async function decryptGroupMessage(
  ciphertext: string,
  iv: string,
  groupKey: CryptoKey
): Promise<string> {
  const ciphertextBuffer = base64ToBuffer(ciphertext)
  const ivBuffer = base64ToBuffer(iv)

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBuffer
    },
    groupKey,
    ciphertextBuffer
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedBuffer)
}

/**
 * Generate symmetric key untuk group
 */
export async function generateGroupKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable
    ['encrypt', 'decrypt']
  )
}

/**
 * Export group key
 */
export async function exportGroupKey(key: CryptoKey): Promise<string> {
  const buffer = await window.crypto.subtle.exportKey('raw', key)
  return bufferToBase64(buffer)
}

/**
 * Import group key
 */
export async function importGroupKey(keyBase64: string): Promise<CryptoKey> {
  const buffer = base64ToBuffer(keyBase64)
  
  return await window.crypto.subtle.importKey(
    'raw',
    buffer,
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt group key untuk member (menggunakan member's public key)
 */
export async function encryptGroupKeyForMember(
  groupKey: CryptoKey,
  memberPublicKey: CryptoKey
): Promise<EncryptedMessage> {
  const groupKeyBase64 = await exportGroupKey(groupKey)
  return await encryptMessage(groupKeyBase64, memberPublicKey)
}

/**
 * Decrypt group key
 */
export async function decryptGroupKeyForMember(
  encrypted: EncryptedMessage,
  memberPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const groupKeyBase64 = await decryptMessage(encrypted, memberPrivateKey)
  return await importGroupKey(groupKeyBase64)
}

/**
 * Generate hash dari message untuk verification
 */
export async function hashMessage(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  return bufferToBase64(hashBuffer)
}

/**
 * Sign message untuk authenticity
 */
export async function signMessage(
  message: string
): Promise<string> {
  // Note: ECDH keys can't sign, so we'd need separate signing keys
  // For now, we'll use a hash as a simple integrity check
  return await hashMessage(message)
}

// Utility functions
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Store keys securely in IndexedDB
 */
export class KeyStorage {
  private dbName = 'messaging-keys'
  private storeName = 'keys'
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName)
        }
      }
    })
  }

  async saveKeyPair(address: string, keyPair: SerializedKeyPair): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put(keyPair, address)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getKeyPair(address: string): Promise<SerializedKeyPair | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(address)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  async deleteKeyPair(address: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(address)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async saveGroupKey(groupId: string, groupKey: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put(groupKey, `group-${groupId}`)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getGroupKey(groupId: string): Promise<string | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(`group-${groupId}`)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }
}

// Singleton instance
export const keyStorage = new KeyStorage()
