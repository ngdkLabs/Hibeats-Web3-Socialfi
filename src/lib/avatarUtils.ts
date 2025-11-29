/**
 * Avatar Utilities
 * Helper functions for handling avatar URLs and IPFS hashes
 * Matches PostCard implementation exactly
 */

/**
 * Convert avatar hash to IPFS URL
 * Same logic as PostCard for consistency
 */
export function getAvatarUrl(avatarHash: string | undefined): string | undefined {
  if (!avatarHash) return undefined;
  
  // If it's already a full URL, return as is
  if (avatarHash.startsWith('http')) {
    return avatarHash;
  }
  
  // Remove ipfs:// prefix if present
  const cleanHash = avatarHash.replace('ipfs://', '');
  
  // Return IPFS URL (same as PostCard: `https://ipfs.io/ipfs/${avatarHash}`)
  return `https://ipfs.io/ipfs/${cleanHash}`;
}

/**
 * Get fallback avatar URL using Dicebear
 */
export function getFallbackAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

/**
 * Get avatar URL with fallback
 * Returns IPFS URL if available, otherwise Dicebear
 */
export function getAvatarUrlWithFallback(avatarHash: string | undefined, fallbackSeed: string): string {
  const url = getAvatarUrl(avatarHash);
  return url || getFallbackAvatarUrl(fallbackSeed);
}
