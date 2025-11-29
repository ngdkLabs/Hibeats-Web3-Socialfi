/**
 * Public Key Registry Service
 * On-chain registry untuk store dan fetch public keys
 */

import { SDK, SchemaEncoder } from '@somnia-chain/streams'
import { toHex } from 'viem'
import { waitForTransactionReceipt } from 'viem/actions'
import { publicKeyRegistrySchema } from '../lib/messagingSchemas'

// Helper untuk mendapatkan nilai dari field
const val = (f: any) => f?.value?.value ?? f?.value

/**
 * Register public key on-chain
 */
export async function registerPublicKey(
  sdk: SDK,
  publicClient: any,
  userAddress: `0x${string}`,
  publicKey: string
): Promise<string> {
  const encoder = new SchemaEncoder(publicKeyRegistrySchema)
  const schemaId = await sdk.streams.computeSchemaId(publicKeyRegistrySchema)
  
  const timestamp = Date.now()
  const keyId = toHex(userAddress, { size: 32 })
  
  console.log('📝 [PUBLIC KEY REGISTRY] Registering public key...')
  console.log('   User:', userAddress)
  console.log('   Key length:', publicKey.length)
  
  const encodedData = encoder.encodeData([
    { name: 'user', value: userAddress, type: 'address' },
    { name: 'publicKey', value: publicKey, type: 'string' },
    { name: 'registeredAt', value: timestamp.toString(), type: 'uint64' },
    { name: 'updatedAt', value: timestamp.toString(), type: 'uint64' }
  ])
  
  const txHash = await sdk.streams.set([{
    id: keyId,
    schemaId,
    data: encodedData
  }])
  
  if (!txHash) throw new Error('Failed to register public key')
  await waitForTransactionReceipt(publicClient, { hash: txHash })
  
  console.log('✅ [PUBLIC KEY REGISTRY] Public key registered')
  return txHash
}

/**
 * Fetch public key from on-chain registry
 */
export async function fetchPublicKey(
  sdk: SDK,
  userAddress: `0x${string}`
): Promise<string | null> {
  try {
    const schemaId = await sdk.streams.computeSchemaId(publicKeyRegistrySchema)
    const keyId = toHex(userAddress, { size: 32 })
    
    console.log('🔍 [PUBLIC KEY REGISTRY] Fetching public key...')
    console.log('   User:', userAddress)
    
    // Try to get by key first (faster)
    try {
      const data = await sdk.streams.getByKey(schemaId, userAddress, keyId)
      
      if (data && Array.isArray(data) && data.length >= 2) {
        const publicKey = String(val(data[1]) ?? '')
        if (publicKey) {
          console.log('✅ [PUBLIC KEY REGISTRY] Found public key (by key)')
          return publicKey
        }
      }
    } catch (e) {
      console.log('   Key not found by ID, trying getAllPublisherDataForSchema...')
    }
    
    // Fallback: get all data from this publisher
    const resp = await sdk.streams.getAllPublisherDataForSchema(schemaId, userAddress)
    const rows: any[][] = Array.isArray(resp) ? (resp as any[][]) : []
    
    if (rows.length > 0) {
      const row = rows[0] // Get latest
      if (Array.isArray(row) && row.length >= 2) {
        const publicKey = String(val(row[1]) ?? '')
        if (publicKey) {
          console.log('✅ [PUBLIC KEY REGISTRY] Found public key (from all data)')
          return publicKey
        }
      }
    }
    
    console.log('❌ [PUBLIC KEY REGISTRY] Public key not found')
    return null
  } catch (error) {
    console.error('❌ [PUBLIC KEY REGISTRY] Error fetching public key:', error)
    return null
  }
}

/**
 * Update public key on-chain
 */
export async function updatePublicKey(
  sdk: SDK,
  publicClient: any,
  userAddress: `0x${string}`,
  newPublicKey: string
): Promise<string> {
  const encoder = new SchemaEncoder(publicKeyRegistrySchema)
  const schemaId = await sdk.streams.computeSchemaId(publicKeyRegistrySchema)
  
  // Get existing registration time
  let registeredAt = Date.now()
  try {
    const existing = await fetchPublicKey(sdk, userAddress)
    if (existing) {
      // Keep original registration time
      const resp = await sdk.streams.getAllPublisherDataForSchema(schemaId, userAddress)
      const rows: any[][] = Array.isArray(resp) ? (resp as any[][]) : []
      if (rows.length > 0 && Array.isArray(rows[0]) && rows[0].length >= 3) {
        registeredAt = Number(val(rows[0][2]))
      }
    }
  } catch (e) {
    // Use current time if can't fetch
  }
  
  const timestamp = Date.now()
  const keyId = toHex(userAddress, { size: 32 })
  
  console.log('🔄 [PUBLIC KEY REGISTRY] Updating public key...')
  
  const encodedData = encoder.encodeData([
    { name: 'user', value: userAddress, type: 'address' },
    { name: 'publicKey', value: newPublicKey, type: 'string' },
    { name: 'registeredAt', value: registeredAt.toString(), type: 'uint64' },
    { name: 'updatedAt', value: timestamp.toString(), type: 'uint64' }
  ])
  
  const txHash = await sdk.streams.set([{
    id: keyId,
    schemaId,
    data: encodedData
  }])
  
  if (!txHash) throw new Error('Failed to update public key')
  await waitForTransactionReceipt(publicClient, { hash: txHash })
  
  console.log('✅ [PUBLIC KEY REGISTRY] Public key updated')
  return txHash
}

/**
 * Check if user has registered public key
 */
export async function hasPublicKey(
  sdk: SDK,
  userAddress: `0x${string}`
): Promise<boolean> {
  const publicKey = await fetchPublicKey(sdk, userAddress)
  return publicKey !== null && publicKey.length > 0
}
