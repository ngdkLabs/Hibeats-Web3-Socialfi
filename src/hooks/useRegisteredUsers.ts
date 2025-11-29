/**
 * Hook to fetch registered users from blockchain
 * Uses profileService (same as PostCard) for consistency
 */

import { useState, useEffect } from 'react'
import { SDK } from '@somnia-chain/streams'
import { profileService } from '@/services/profileService'

export interface RegisteredUser {
  address: string
  username: string
  displayName: string
  avatarHash?: string
  bio?: string
  isArtist?: boolean
  isVerified?: boolean
  isOnline?: boolean
  source?: 'subgraph' | 'datastream'
}

export function useRegisteredUsers(sdk: SDK | null) {
  const [users, setUsers] = useState<RegisteredUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sdk) {
      setLoading(false)
      return
    }

    const fetchUsers = async () => {
      try {
        setLoading(true)
        console.log('🔍 [MESSAGES] Fetching users from Subgraph + DataStream...')
        
        // Strategy 1: Fetch from Subgraph (primary source - indexed and fast)
        let subgraphUsers: RegisteredUser[] = []
        try {
          const { apolloClient } = await import('@/lib/apollo-client')
          const { GET_ALL_USERS } = await import('@/graphql/queries')

          console.log('📡 [MESSAGES] Querying Subgraph...')
          const result = await apolloClient.query({
            query: GET_ALL_USERS,
            variables: {
              first: 100,
              skip: 0,
              orderBy: 'createdAt',
              orderDirection: 'desc'
            },
            fetchPolicy: 'network-only'
          })

          if ((result.data as any)?.userProfiles && (result.data as any).userProfiles.length > 0) {
            subgraphUsers = (result.data as any).userProfiles
              .filter((p: any) => p.username) // Only users with username
              .map((p: any) => ({
                address: p.id,
                username: p.username,
                displayName: p.displayName || p.username,
                avatarHash: p.avatarHash || '',
                bio: p.bio || '',
                isArtist: p.isArtist || false,
                isVerified: p.isVerified || false,
                isOnline: false,
                source: 'subgraph' as const
              }))
            
            console.log(`✅ [MESSAGES] Loaded ${subgraphUsers.length} users from Subgraph`)
          } else {
            console.log('📭 [MESSAGES] No users in Subgraph result')
          }
        } catch (error) {
          console.error('❌ [MESSAGES] Subgraph fetch failed:', error)
        }

        // Strategy 2: DataStream is not needed for user list
        // We already have users from Subgraph which is sufficient
        let datastreamUsers: RegisteredUser[] = []
        console.log('ℹ️ [MESSAGES] Skipping DataStream for user list (using Subgraph only)')

        // Merge and deduplicate users (Subgraph + DataStream)
        const userMap = new Map<string, RegisteredUser>()
        
        // Add Subgraph users first (they have more metadata)
        subgraphUsers.forEach(user => {
          const key = user.address.toLowerCase()
          userMap.set(key, user)
        })
        
        // Add DataStream users (only if not already in map)
        datastreamUsers.forEach(user => {
          const key = user.address.toLowerCase()
          if (!userMap.has(key)) {
            userMap.set(key, user)
          }
        })

        // Sort by priority: verified > artist > username
        const mergedUsers = Array.from(userMap.values())
          .sort((a, b) => {
            if (a.isVerified && !b.isVerified) return -1
            if (!a.isVerified && b.isVerified) return 1
            if (a.isArtist && !b.isArtist) return -1
            if (!a.isArtist && b.isArtist) return 1
            return a.username.localeCompare(b.username)
          })

        setUsers(mergedUsers)
        setError(null)
        
        console.log(`✅ [MESSAGES] Total users loaded: ${mergedUsers.length} (Subgraph: ${subgraphUsers.length}, DataStream: ${datastreamUsers.length})`)
        
        // Log sample users
        if (mergedUsers.length > 0) {
          console.log('📋 [MESSAGES] Sample users:', mergedUsers.slice(0, 3).map(u => ({
            username: u.username,
            displayName: u.displayName,
            source: u.source,
            isArtist: u.isArtist,
            isVerified: u.isVerified
          })))
        } else {
          console.warn('⚠️ [MESSAGES] No users loaded! Check Subgraph and DataStream')
        }
      } catch (err: any) {
        console.error('❌ [MESSAGES] Failed to fetch users:', err)
        setError(err.message || 'Failed to fetch users')
        setUsers([])
      } finally {
        setLoading(false)
      }
    }

    // Fetch immediately
    fetchUsers()
    
    // Refresh user list every 10 seconds for real-time updates
    const intervalId = setInterval(fetchUsers, 10000)
    
    return () => clearInterval(intervalId)
  }, [sdk])

  return { users, loading, error }
}

export function useUserProfile(address: string | null) {
  const [profile, setProfile] = useState<RegisteredUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) {
      setLoading(false)
      return
    }

    const fetchProfile = async () => {
      try {
        setLoading(true)
        console.log(`🔍 [MESSAGES] Fetching profile for ${address}...`)
        
        // Use profileService (same as PostCard) for consistency
        const p = await profileService.getProfile(address)
        
        if (p) {
          const userProfile: RegisteredUser = {
            address: p.userAddress,
            username: p.username,
            displayName: p.displayName,
            avatarHash: p.avatarHash,
            bio: p.bio,
            isArtist: p.isArtist,
            isVerified: p.isVerified,
            isOnline: false,
            source: 'subgraph'
          }
          
          console.log(`✅ [MESSAGES] Profile loaded:`, {
            displayName: userProfile.displayName,
            username: userProfile.username,
            avatarHash: userProfile.avatarHash,
            isVerified: userProfile.isVerified
          })
          
          setProfile(userProfile)
        } else {
          // Fallback: Create basic profile from address
          const fallbackProfile: RegisteredUser = {
            address,
            username: address.substring(0, 10),
            displayName: address.substring(0, 10),
            avatarHash: '',
            bio: '',
            isArtist: false,
            isVerified: false,
            isOnline: false,
            source: 'datastream'
          }
          console.log(`⚠️ [MESSAGES] Using fallback profile for ${address}`)
          setProfile(fallbackProfile)
        }
      } catch (err) {
        console.error('❌ [MESSAGES] Failed to fetch user profile:', err)
        // Set fallback profile
        setProfile({
          address: address!,
          username: address!.substring(0, 10),
          displayName: address!.substring(0, 10),
          avatarHash: '',
          bio: '',
          isArtist: false,
          isVerified: false,
          isOnline: false,
          source: 'datastream'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [address])

  return { profile, loading }
}
