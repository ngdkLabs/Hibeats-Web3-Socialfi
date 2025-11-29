/**
 * SDK Utilities
 * Helper functions untuk Somnia SDK
 */

import { SDK } from '@somnia-chain/streams'

/**
 * Verify apakah SDK wallet terhubung dengan benar
 * 
 * @param sdk - SDK instance
 * @returns true jika wallet connected, false jika tidak
 */
export function isSDKWalletConnected(sdk: SDK | null): boolean {
  if (!sdk) {
    console.log('❌ [SDK CHECK] SDK is null')
    return false
  }

  const sdkAny = sdk as any
  
  if (!sdkAny.wallet) {
    console.log('❌ [SDK CHECK] SDK.wallet is undefined')
    return false
  }

  if (!sdkAny.wallet.account) {
    console.log('❌ [SDK CHECK] SDK.wallet.account is undefined')
    return false
  }

  if (!sdkAny.wallet.account.address) {
    console.log('❌ [SDK CHECK] SDK.wallet.account.address is undefined')
    return false
  }

  console.log('✅ [SDK CHECK] SDK wallet connected:', sdkAny.wallet.account.address)
  return true
}

/**
 * Get wallet address dari SDK
 * 
 * @param sdk - SDK instance
 * @returns wallet address atau null
 */
export function getSDKWalletAddress(sdk: SDK | null): string | null {
  if (!sdk) return null
  
  const sdkAny = sdk as any
  return sdkAny.wallet?.account?.address || null
}

/**
 * Verify SDK ready untuk transactions
 * 
 * @param sdk - SDK instance
 * @param publicClient - Public client
 * @throws Error jika SDK tidak ready
 */
export function verifySDKReady(sdk: SDK | null, publicClient: any): void {
  if (!sdk) {
    throw new Error('SDK not initialized')
  }

  if (!publicClient) {
    throw new Error('Public client not initialized')
  }

  if (!isSDKWalletConnected(sdk)) {
    throw new Error('SDK wallet not connected. Please reconnect your wallet.')
  }
}

/**
 * Log SDK status untuk debugging
 * 
 * @param sdk - SDK instance
 * @param label - Label untuk log
 */
export function logSDKStatus(sdk: SDK | null, label: string = 'SDK'): void {
  console.log(`🔍 [${label}] Status:`)
  console.log('   SDK:', sdk ? 'initialized' : 'null')
  
  if (sdk) {
    const sdkAny = sdk as any
    console.log('   Has wallet:', !!sdkAny.wallet)
    console.log('   Has account:', !!sdkAny.wallet?.account)
    console.log('   Wallet address:', sdkAny.wallet?.account?.address || 'none')
  }
}
