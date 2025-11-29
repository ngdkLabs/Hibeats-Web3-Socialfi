// Background Job for Music Milestone Detection
// Runs periodically to check and send milestone notifications

import { musicMilestoneService } from './musicMilestoneService';
import { somniaDatastreamServiceV3 } from './somniaDatastreamService.v3';

interface TrackStats {
  tokenId: string;
  artist: string;
  playCount: number;
  uniqueListeners: number;
  likes: number;
  shares: number;
  comments: number;
  plays24h?: number;
  likes24h?: number;
  shares24h?: number;
  comments24h?: number;
}

class MusicMilestoneBackgroundJob {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private checkInterval = 60 * 60 * 1000; // 1 hour

  /**
   * Start the background job
   */
  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.warn('⚠️ Milestone job already running');
      return;
    }

    if (intervalMs) {
      this.checkInterval = intervalMs;
    }

    console.log(`🚀 Starting milestone detection job (interval: ${this.checkInterval / 1000}s)`);
    
    // Run immediately on start
    this.checkAllMilestones();
    
    // Then run periodically
    this.intervalId = setInterval(() => {
      this.checkAllMilestones();
    }, this.checkInterval);
    
    this.isRunning = true;
  }

  /**
   * Stop the background job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Milestone detection job stopped');
  }

  /**
   * Check milestones for all tracks
   */
  private async checkAllMilestones(): Promise<void> {
    try {
      console.log('🔍 [MILESTONE] Checking milestones for all tracks...');
      
      // Get all generated music from datastream
      const allMusic = await this.getAllGeneratedMusic();
      
      if (!allMusic || allMusic.length === 0) {
        console.log('📭 [MILESTONE] No music found');
        return;
      }

      console.log(`📊 [MILESTONE] Found ${allMusic.length} tracks to check`);
      
      // Check milestones for each track
      for (const music of allMusic) {
        try {
          await this.checkTrackMilestones(music);
        } catch (error) {
          console.error(`❌ [MILESTONE] Error checking track ${music.tokenId}:`, error);
        }
      }
      
      console.log('✅ [MILESTONE] Milestone check complete');
    } catch (error) {
      console.error('❌ [MILESTONE] Error in milestone job:', error);
    }
  }

  /**
   * Get all generated music from datastream
   */
  private async getAllGeneratedMusic(): Promise<any[]> {
    try {
      const allMusic = await somniaDatastreamServiceV3.getAllGeneratedMusic();
      return allMusic || [];
    } catch (error) {
      console.error('❌ Failed to get generated music:', error);
      return [];
    }
  }

  /**
   * Check milestones for a specific track
   */
  private async checkTrackMilestones(music: any): Promise<void> {
    try {
      // Get track stats (you need to implement this based on your data structure)
      const stats: TrackStats = await this.getTrackStats(music);
      
      // Get chart rank if available
      const chartRank = await this.getChartRank(music.tokenId);
      
      // Get trending rank if available
      const trendingRank = await this.getTrendingRank(music.tokenId);
      
      // Process all milestones
      await musicMilestoneService.processAllMilestones(
        stats,
        chartRank,
        trendingRank
      );
    } catch (error) {
      console.error(`❌ Error checking milestones for ${music.tokenId}:`, error);
    }
  }

  /**
   * Get track statistics
   */
  private async getTrackStats(music: any): Promise<TrackStats> {
    const tokenId = music.tokenId || music.id;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    try {
      // Get play events for this track
      const allPlayEvents = await somniaDatastreamServiceV3.getAllPlayEvents();
      const trackPlayEvents = allPlayEvents.filter(e => e.tokenId === tokenId);
      
      // Get interactions for this track
      const allInteractions = await somniaDatastreamServiceV3.getAllInteractions();
      const trackInteractions = allInteractions.filter(
        i => i.targetId === tokenId && i.targetType === 1 // TargetType.SONG = 1
      );
      
      // Calculate play stats
      const playCount = trackPlayEvents.length;
      const uniqueListeners = new Set(trackPlayEvents.map(e => e.listener.toLowerCase())).size;
      const plays24h = trackPlayEvents.filter(e => e.timestamp > oneDayAgo).length;
      
      // Calculate interaction stats (likes, shares, comments)
      const likeInteractions = trackInteractions.filter(i => i.interactionType === 0); // LIKE = 0
      const unlikeInteractions = trackInteractions.filter(i => i.interactionType === 1); // UNLIKE = 1
      const shareInteractions = trackInteractions.filter(i => i.interactionType === 2); // SHARE = 2
      const commentInteractions = trackInteractions.filter(i => i.interactionType === 3); // COMMENT = 3
      
      // Calculate net likes (likes - unlikes per user)
      const likeState = new Map<string, boolean>();
      [...likeInteractions, ...unlikeInteractions]
        .sort((a, b) => a.timestamp - b.timestamp)
        .forEach(i => {
          likeState.set(i.fromUser.toLowerCase(), i.interactionType === 0);
        });
      const likes = Array.from(likeState.values()).filter(v => v).length;
      
      const shares = shareInteractions.length;
      const comments = commentInteractions.length;
      
      // Calculate 24h stats
      const likes24h = likeInteractions.filter(i => i.timestamp > oneDayAgo).length;
      const shares24h = shareInteractions.filter(i => i.timestamp > oneDayAgo).length;
      const comments24h = commentInteractions.filter(i => i.timestamp > oneDayAgo).length;
      
      return {
        tokenId: String(tokenId),
        artist: music.owner || music.creator || '',
        playCount,
        uniqueListeners,
        likes,
        shares,
        comments,
        plays24h,
        likes24h,
        shares24h,
        comments24h,
      };
    } catch (error) {
      console.error(`❌ [MILESTONE] Error getting track stats for ${tokenId}:`, error);
      return {
        tokenId: String(tokenId),
        artist: music.owner || music.creator || '',
        playCount: 0,
        uniqueListeners: 0,
        likes: 0,
        shares: 0,
        comments: 0,
        plays24h: 0,
        likes24h: 0,
        shares24h: 0,
        comments24h: 0,
      };
    }
  }

  /**
   * Get chart rank for a track (based on total play count)
   */
  private async getChartRank(tokenId: string): Promise<number | undefined> {
    try {
      // Get all play events
      const allPlayEvents = await somniaDatastreamServiceV3.getAllPlayEvents();
      
      // Aggregate play counts per token
      const playCountMap = new Map<number, number>();
      for (const event of allPlayEvents) {
        const count = playCountMap.get(event.tokenId) || 0;
        playCountMap.set(event.tokenId, count + 1);
      }
      
      // Sort by play count (descending)
      const sortedTokens = Array.from(playCountMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);
      
      // Find rank (1-indexed)
      const tokenIdNum = parseInt(tokenId);
      const rank = sortedTokens.indexOf(tokenIdNum);
      
      return rank >= 0 ? rank + 1 : undefined;
    } catch (error) {
      console.error(`❌ [MILESTONE] Error getting chart rank for ${tokenId}:`, error);
      return undefined;
    }
  }

  /**
   * Get trending rank for a track (based on recent engagement in last 24h)
   */
  private async getTrendingRank(tokenId: string): Promise<number | undefined> {
    try {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      
      // Get recent play events
      const allPlayEvents = await somniaDatastreamServiceV3.getAllPlayEvents();
      const recentPlayEvents = allPlayEvents.filter(e => e.timestamp > oneDayAgo);
      
      // Get recent interactions
      const allInteractions = await somniaDatastreamServiceV3.getAllInteractions();
      const recentInteractions = allInteractions.filter(
        i => i.timestamp > oneDayAgo && i.targetType === 1 // TargetType.SONG = 1
      );
      
      // Calculate trending score per token
      // Score = plays * 1 + likes * 2 + shares * 3 + comments * 2
      const trendingScoreMap = new Map<number, number>();
      
      // Add play scores
      for (const event of recentPlayEvents) {
        const score = trendingScoreMap.get(event.tokenId) || 0;
        trendingScoreMap.set(event.tokenId, score + 1);
      }
      
      // Add interaction scores
      for (const interaction of recentInteractions) {
        const currentScore = trendingScoreMap.get(interaction.targetId) || 0;
        let addScore = 0;
        switch (interaction.interactionType) {
          case 0: addScore = 2; break; // LIKE
          case 2: addScore = 3; break; // SHARE
          case 3: addScore = 2; break; // COMMENT
        }
        trendingScoreMap.set(interaction.targetId, currentScore + addScore);
      }
      
      // Sort by trending score (descending)
      const sortedTokens = Array.from(trendingScoreMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);
      
      // Find rank (1-indexed)
      const tokenIdNum = parseInt(tokenId);
      const rank = sortedTokens.indexOf(tokenIdNum);
      
      return rank >= 0 ? rank + 1 : undefined;
    } catch (error) {
      console.error(`❌ [MILESTONE] Error getting trending rank for ${tokenId}:`, error);
      return undefined;
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualCheck(): Promise<void> {
    console.log('🔧 [MILESTONE] Manual check triggered');
    await this.checkAllMilestones();
  }

  /**
   * Get job status
   */
  getStatus(): { isRunning: boolean; interval: number } {
    return {
      isRunning: this.isRunning,
      interval: this.checkInterval,
    };
  }
}

// Export singleton instance
export const musicMilestoneBackgroundJob = new MusicMilestoneBackgroundJob();
export default musicMilestoneBackgroundJob;
