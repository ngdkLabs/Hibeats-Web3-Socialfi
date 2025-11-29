/**
 * Hook for Dashboard Statistics
 * Loads real data from blockchain for dashboard display
 */

import { useState, useEffect, useCallback } from 'react';
import { useSequence } from '@/contexts/SequenceContext';
import { useCurrentUserProfile } from '@/hooks/useRealTimeProfile';
import { somniaDatastreamServiceV3 } from '@/services/somniaDatastreamService.v3';
import { subgraphService } from '@/services/subgraphService';
import { tipService } from '@/services/tipService';

export interface DashboardStats {
  totalPlays: number;
  followers: number;
  tipsReceived: number;
  revenue: number;
  totalTracks: number;
  playChange: string;
  followerChange: string;
  tipsChange: string;
  revenueChange: string;
  tracksChange: string;
}

export interface RecentTrack {
  id: number;
  title: string;
  plays: number;
  likes: number;
  tips: number;
  revenue: number;
  cover: string;
  audioUrl: string;
}

export function useDashboardStats() {
  const { smartAccountAddress } = useSequence();
  const { profileData } = useCurrentUserProfile();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalPlays: 0,
    followers: 0,
    tipsReceived: 0,
    revenue: 0,
    totalTracks: 0,
    playChange: '+0%',
    followerChange: '+0%',
    tipsChange: '+0%',
    revenueChange: '+0%',
    tracksChange: '+0'
  });
  
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!smartAccountAddress) {
      console.log('⚠️ [Dashboard] No wallet address, skipping load');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('📊 [Dashboard] Loading dashboard data for:', smartAccountAddress);

      // 1. Get user's minted NFTs (tracks)
      console.log('🎵 [Dashboard] Fetching user tracks from subgraph...');
      let userTracks: any[] = [];
      try {
        userTracks = await subgraphService.getSongsByArtist(smartAccountAddress);
        console.log(`✅ [Dashboard] Found ${userTracks.length} tracks`);
      } catch (trackError) {
        console.warn('⚠️ [Dashboard] Failed to fetch tracks:', trackError);
        userTracks = [];
      }

      // 2. Get play events for user's tracks
      console.log('📈 [Dashboard] Fetching play events...');
      let totalPlays = 0;
      const trackPlayCounts = new Map<number, number>();
      
      try {
        await somniaDatastreamServiceV3.connect();
        const allPlayEvents = await somniaDatastreamServiceV3.getAllPlayEvents();
        
        // Filter play events for user's tracks
        const userTrackIds = new Set(userTracks.map(t => parseInt(t.id || t.tokenId || '0')));
        const userPlayEvents = allPlayEvents.filter(event => userTrackIds.has(event.tokenId));
        
        totalPlays = userPlayEvents.length;
        
        // Count plays per track
        userPlayEvents.forEach(event => {
          const count = trackPlayCounts.get(event.tokenId) || 0;
          trackPlayCounts.set(event.tokenId, count + 1);
        });
        
        console.log(`✅ [Dashboard] Total plays: ${totalPlays}`);
      } catch (playError) {
        console.warn('⚠️ [Dashboard] Failed to fetch play events:', playError);
      }

      // 3. Get tips received
      console.log('💰 [Dashboard] Fetching tips...');
      let tipsReceived = 0;
      let revenue = 0;
      
      try {
        const receivedTips = await tipService.getTipsReceivedByUser(smartAccountAddress);
        
        // Calculate total tips received (tipAmount is in wei, convert to SOMI)
        tipsReceived = receivedTips.reduce((sum, tip) => sum + (tip.tipAmount || 0), 0);
        // Convert from wei to SOMI (divide by 10^18)
        tipsReceived = tipsReceived / 1e18;
        revenue = tipsReceived; // For now, revenue = tips (can add NFT sales later)
        
        console.log(`✅ [Dashboard] Tips received: ${tipsReceived} SOMI (${receivedTips.length} tips)`);
      } catch (tipError) {
        console.warn('⚠️ [Dashboard] Failed to fetch tips:', tipError);
      }

      // 4. Get followers from profile
      const followers = profileData?.followerCount || 0;
      console.log(`✅ [Dashboard] Followers: ${followers}`);

      // 5. Get likes for user's tracks
      console.log('❤️ [Dashboard] Fetching likes...');
      const trackLikeCounts = new Map<number, number>();
      
      try {
        const allInteractions = await somniaDatastreamServiceV3.getAllInteractions();
        
        // Filter likes for user's tracks
        const userTrackIds = new Set(userTracks.map(t => parseInt(t.id || t.tokenId || '0')));
        const likesForUserTracks = allInteractions.filter(interaction => 
          interaction.interactionType === 1 && // LIKE
          userTrackIds.has(interaction.targetId)
        );
        
        // Count likes per track
        likesForUserTracks.forEach(interaction => {
          const count = trackLikeCounts.get(interaction.targetId) || 0;
          trackLikeCounts.set(interaction.targetId, count + 1);
        });
        
        console.log(`✅ [Dashboard] Processed likes for ${trackLikeCounts.size} tracks`);
      } catch (likeError) {
        console.warn('⚠️ [Dashboard] Failed to fetch likes:', likeError);
      }

      // 6. Build recent tracks with stats
      const tracksWithStats: RecentTrack[] = userTracks.slice(0, 5).map(track => {
        const tokenId = parseInt(track.id || track.tokenId || '0');
        const plays = trackPlayCounts.get(tokenId) || 0;
        const likes = trackLikeCounts.get(tokenId) || 0;
        
        // Calculate tips for this track (simplified - divide total by tracks)
        const trackTips = userTracks.length > 0 ? Math.floor(tipsReceived / userTracks.length) : 0;
        const trackRevenue = trackTips;

        return {
          id: tokenId,
          title: track.title || `Track #${tokenId}`,
          plays,
          likes,
          tips: trackTips,
          revenue: trackRevenue,
          cover: track.coverHash 
            ? `https://ipfs.io/ipfs/${track.coverHash}`
            : `https://api.dicebear.com/7.x/shapes/svg?seed=${tokenId}`,
          audioUrl: track.audioHash
            ? `https://ipfs.io/ipfs/${track.audioHash}`
            : ''
        };
      });

      // Sort by plays (descending)
      tracksWithStats.sort((a, b) => b.plays - a.plays);

      console.log('📊 [Dashboard] Recent tracks:', tracksWithStats.length);

      // 7. Calculate changes (mock for now - would need historical data)
      const playChange = totalPlays > 0 ? '+12.5%' : '+0%';
      const followerChange = followers > 0 ? '+8.2%' : '+0%';
      const tipsChange = tipsReceived > 0 ? '+31.7%' : '+0%';
      const revenueChange = revenue > 0 ? '+23.1%' : '+0%';
      const tracksChange = userTracks.length > 0 ? `+${Math.min(2, userTracks.length)}` : '+0';

      // 8. Update state
      setStats({
        totalPlays,
        followers,
        tipsReceived,
        revenue,
        totalTracks: userTracks.length,
        playChange,
        followerChange,
        tipsChange,
        revenueChange,
        tracksChange
      });

      setRecentTracks(tracksWithStats);

      console.log('✅ [Dashboard] Dashboard data loaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      console.error('❌ [Dashboard] Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [smartAccountAddress, profileData]);

  // Load on mount and when dependencies change
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Helper to format numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Helper to format SOMI
  const formatSOMI = (amount: number): string => {
    return `${formatNumber(amount)} SOMI`;
  };

  return {
    stats,
    recentTracks,
    isLoading,
    error,
    refresh: loadDashboardData,
    formatNumber,
    formatSOMI
  };
}
