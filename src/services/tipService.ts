/**
 * Unified Tip Service
 * 
 * Service untuk handle tipping/support di berbagai target:
 * - Post (social media content)
 * - Track/Song (music content)
 * - Album (music collection)
 * - Artist (user profile)
 */

import { somniaDatastreamServiceV3 } from './somniaDatastreamService.v3';
import { InteractionType, TargetType, InteractionDataV3 } from '@/config/somniaDataStreams.v3';
import { parseEther, formatEther } from 'viem';

/**
 * Tip target types
 */
export enum TipTarget {
  POST = 'post',
  TRACK = 'track',
  ALBUM = 'album',
  ARTIST = 'artist',
}

/**
 * Tip data structure
 */
export interface TipData {
  targetType: TipTarget;
  targetId: number | string;
  amount: number; // in STT (wei)
  message?: string;
  fromUser: string;
  toUser: string; // recipient address
  timestamp?: number;
}

/**
 * Tip statistics
 */
export interface TipStats {
  totalAmount: number; // total tips received (in wei)
  tipCount: number; // number of tips
  topTippers: Array<{
    address: string;
    amount: number;
    tipCount: number;
  }>;
  recentTips: Array<{
    from: string;
    amount: number;
    message?: string;
    timestamp: number;
  }>;
}

class TipService {
  /**
   * Map TipTarget to TargetType enum
   */
  private mapTargetType(tipTarget: TipTarget): TargetType {
    switch (tipTarget) {
      case TipTarget.POST:
        return TargetType.POST;
      case TipTarget.TRACK:
        return TargetType.SONG;
      case TipTarget.ALBUM:
        return TargetType.ALBUM;
      case TipTarget.ARTIST:
        return TargetType.USER;
      default:
        return TargetType.POST;
    }
  }

  /**
   * Convert target ID to number
   */
  private normalizeTargetId(targetId: number | string, targetType: TipTarget): number {
    if (typeof targetId === 'number') return targetId;
    
    // For artist (address), convert to number
    if (targetType === TipTarget.ARTIST) {
      return parseInt(targetId.slice(2, 18), 16);
    }
    
    // For other string IDs, try to parse
    return parseInt(targetId) || 0;
  }

  /**
   * Send tip to target
   * 
   * @param tipData - Tip data
   * @param userWalletClient - User's wallet client for signing
   * @returns Transaction result
   */
  async sendTip(tipData: TipData, userWalletClient?: any): Promise<any> {
    console.log('💰 [Tip] Sending tip:', tipData);

    // Validate amount
    if (!tipData.amount || tipData.amount <= 0) {
      const error = new Error('Tip amount must be greater than 0');
      console.error('❌ [Tip] Validation failed:', error.message);
      throw error;
    }

    // Validate addresses
    if (!tipData.fromUser || !tipData.toUser) {
      const error = new Error('From and to addresses are required');
      console.error('❌ [Tip] Validation failed:', error.message);
      throw error;
    }

    // Validate wallet client
    if (!userWalletClient) {
      const error = new Error('Wallet client is required to send tips');
      console.error('❌ [Tip] Validation failed:', error.message);
      throw error;
    }

    const targetType = this.mapTargetType(tipData.targetType);
    const targetId = this.normalizeTargetId(tipData.targetId, tipData.targetType);
    const timestamp = tipData.timestamp || Date.now();

    try {
      // 🔥 STEP 1: Transfer STT to recipient wallet
      console.log('💸 [Tip] Transferring STT to recipient:', {
        to: tipData.toUser,
        amount: tipData.amount,
        amountFormatted: this.formatTipAmount(tipData.amount),
      });

      // Send STT transfer transaction
      const transferTxHash = await userWalletClient.sendTransaction({
        to: tipData.toUser as `0x${string}`,
        value: BigInt(tipData.amount),
      });

      console.log('✅ [Tip] STT transfer sent:', transferTxHash);

      // 🔄 Trigger balance refresh immediately after tx sent
      try {
        const { triggerBalanceRefresh } = await import('@/hooks/useBalanceRefresh');
        triggerBalanceRefresh();
        console.log('🔄 [Tip] Balance refresh triggered');
      } catch (e) {
        // Ignore if hook not available
      }

      // 🔥 STEP 2: Do background tasks (don't block the UI)
      // Record interaction and send notification in background
      this.processBackgroundTasks(
        transferTxHash,
        tipData,
        targetId,
        targetType,
        timestamp,
        userWalletClient
      );

      // Return immediately after transfer is sent
      return {
        success: true,
        transferTxHash,
      };
    } catch (error: any) {
      console.error('❌ [Tip] Failed to send tip:', error);
      
      // Provide more specific error messages
      if (error?.message?.includes('insufficient funds') || error?.message?.includes('Insufficient')) {
        throw new Error('Insufficient STT balance to send tip');
      } else if (error?.message?.includes('user rejected') || error?.message?.includes('User rejected')) {
        throw new Error('Transaction was rejected by user');
      } else if (error?.message?.includes('network')) {
        throw new Error('Network error. Please try again');
      } else if (error?.message?.includes('reverted')) {
        throw new Error('Transaction failed. Please try again');
      } else {
        throw new Error(error?.message || 'Failed to send tip. Please try again');
      }
    }
  }

  /**
   * Process background tasks after tip transfer (non-blocking)
   * Records interaction in Datastream and sends notification
   */
  private async processBackgroundTasks(
    transferTxHash: string,
    tipData: TipData,
    targetId: number,
    targetType: TargetType,
    timestamp: number,
    userWalletClient: any
  ): Promise<void> {
    // Run in background - don't await
    (async () => {
      try {
        console.log('🔄 [Tip] Processing background tasks...');

        // Record tip interaction in Datastream
        const interactionData: Partial<InteractionDataV3> = {
          interactionType: InteractionType.TIP,
          targetId,
          targetType,
          fromUser: tipData.fromUser,
          content: JSON.stringify({
            message: tipData.message || '',
            recipient: tipData.toUser,
            targetType: tipData.targetType,
            transferTxHash,
          }),
          parentId: 0,
          tipAmount: tipData.amount,
          timestamp,
        };

        try {
          await somniaDatastreamServiceV3.createInteraction(
            interactionData,
            true,
            userWalletClient
          );
          console.log('✅ [Tip] Tip interaction recorded in background');
        } catch (datastreamError) {
          console.warn('⚠️ [Tip] Failed to record interaction:', datastreamError);
        }

        // Send notification to recipient
        try {
          const { notificationService } = await import('./notificationService');
          const formattedAmount = this.formatTipAmount(tipData.amount);
          
          await notificationService.notifyTip(
            tipData.fromUser,
            tipData.toUser,
            String(targetId),
            formattedAmount,
            {
              amount: formattedAmount,
              message: tipData.message || '',
            },
            userWalletClient
          );
          console.log('✅ [Tip] Notification sent in background');
        } catch (notifError) {
          console.warn('⚠️ [Tip] Failed to send notification:', notifError);
        }

        console.log('✅ [Tip] Background tasks completed');
      } catch (error) {
        console.error('❌ [Tip] Background tasks failed:', error);
      }
    })();
  }

  /**
   * Get tip statistics for a target
   * 
   * @param targetType - Target type
   * @param targetId - Target ID
   * @returns Tip statistics
   */
  async getTipStats(targetType: TipTarget, targetId: number | string): Promise<TipStats> {
    try {
      const interactions = await somniaDatastreamServiceV3.getAllInteractions();
      
      const mappedTargetType = this.mapTargetType(targetType);
      const normalizedTargetId = this.normalizeTargetId(targetId, targetType);

      // Filter tip interactions for this target
      const tips = interactions.filter(
        i => i.targetId === normalizedTargetId &&
             i.targetType === mappedTargetType &&
             i.interactionType === InteractionType.TIP
      );

      // Calculate total amount
      const totalAmount = tips.reduce((sum, tip) => sum + (tip.tipAmount || 0), 0);

      // Group by tipper
      const tipperMap = new Map<string, { amount: number; count: number }>();
      for (const tip of tips) {
        const tipper = tip.fromUser.toLowerCase();
        const current = tipperMap.get(tipper) || { amount: 0, count: 0 };
        tipperMap.set(tipper, {
          amount: current.amount + (tip.tipAmount || 0),
          count: current.count + 1,
        });
      }

      // Get top tippers
      const topTippers = Array.from(tipperMap.entries())
        .map(([address, data]) => ({
          address,
          amount: data.amount,
          tipCount: data.count,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      // Get recent tips
      const recentTips = tips
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20)
        .map(tip => {
          let message = '';
          try {
            const content = JSON.parse(tip.content);
            message = content.message || '';
          } catch (e) {
            // Ignore parse errors
          }

          return {
            from: tip.fromUser,
            amount: tip.tipAmount || 0,
            message,
            timestamp: tip.timestamp,
          };
        });

      return {
        totalAmount,
        tipCount: tips.length,
        topTippers,
        recentTips,
      };
    } catch (error: any) {
      // Silently handle NoData error
      if (error?.message?.includes('NoData')) {
        return {
          totalAmount: 0,
          tipCount: 0,
          topTippers: [],
          recentTips: [],
        };
      }
      console.error('❌ [Tip] Failed to get tip stats:', error);
      throw error;
    }
  }

  /**
   * Get tips sent by a user
   * 
   * @param userAddress - User address
   * @returns List of tips sent
   */
  async getTipsSentByUser(userAddress: string): Promise<InteractionDataV3[]> {
    try {
      const interactions = await somniaDatastreamServiceV3.getAllInteractions();
      
      return interactions
        .filter(
          i => i.fromUser.toLowerCase() === userAddress.toLowerCase() &&
               i.interactionType === InteractionType.TIP
        )
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error: any) {
      if (error?.message?.includes('NoData')) {
        return [];
      }
      console.error('❌ [Tip] Failed to get tips sent by user:', error);
      return [];
    }
  }

  /**
   * Get all recent tips (global) - for Recently Supported section
   * 
   * @param limit - Maximum number of tips to return
   * @returns List of recent tips with metadata
   */
  async getRecentTips(limit: number = 10): Promise<Array<{
    id: number;
    from: string;
    to: string;
    amount: number;
    message: string;
    targetType: TipTarget;
    targetId: number;
    timestamp: number;
  }>> {
    try {
      const interactions = await somniaDatastreamServiceV3.getAllInteractions();
      
      // Filter tip interactions
      const tips = interactions
        .filter(i => i.interactionType === InteractionType.TIP)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      return tips.map(tip => {
        let message = '';
        let recipient = '';
        let targetTypeStr = TipTarget.POST;
        
        try {
          const content = JSON.parse(tip.content);
          message = content.message || '';
          recipient = content.recipient || '';
          targetTypeStr = content.targetType || TipTarget.POST;
        } catch (e) {
          // Ignore parse errors
        }

        return {
          id: tip.id,
          from: tip.fromUser,
          to: recipient,
          amount: tip.tipAmount || 0,
          message,
          targetType: targetTypeStr,
          targetId: tip.targetId,
          timestamp: tip.timestamp,
        };
      });
    } catch (error: any) {
      if (error?.message?.includes('NoData')) {
        return [];
      }
      console.error('❌ [Tip] Failed to get recent tips:', error);
      return [];
    }
  }

  /**
   * Get tips received by a user
   * 
   * @param userAddress - User address
   * @returns List of tips received
   */
  async getTipsReceivedByUser(userAddress: string): Promise<InteractionDataV3[]> {
    try {
      const interactions = await somniaDatastreamServiceV3.getAllInteractions();
      
      return interactions
        .filter(i => {
          if (i.interactionType !== InteractionType.TIP) return false;
          
          try {
            const content = JSON.parse(i.content);
            return content.recipient?.toLowerCase() === userAddress.toLowerCase();
          } catch (e) {
            return false;
          }
        })
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error: any) {
      if (error?.message?.includes('NoData')) {
        return [];
      }
      console.error('❌ [Tip] Failed to get tips received by user:', error);
      return [];
    }
  }

  /**
   * Check if user has tipped a target
   * 
   * @param targetType - Target type
   * @param targetId - Target ID
   * @param userAddress - User address
   * @returns true if user has tipped
   */
  async hasTipped(
    targetType: TipTarget,
    targetId: number | string,
    userAddress: string
  ): Promise<boolean> {
    try {
      const interactions = await somniaDatastreamServiceV3.getAllInteractions();
      
      const mappedTargetType = this.mapTargetType(targetType);
      const normalizedTargetId = this.normalizeTargetId(targetId, targetType);

      return interactions.some(
        i => i.targetId === normalizedTargetId &&
             i.targetType === mappedTargetType &&
             i.interactionType === InteractionType.TIP &&
             i.fromUser.toLowerCase() === userAddress.toLowerCase()
      );
    } catch (error: any) {
      if (error?.message?.includes('NoData')) {
        return false;
      }
      console.error('❌ [Tip] Failed to check if user has tipped:', error);
      return false;
    }
  }

  /**
   * Format tip amount for display
   * 
   * @param amountInWei - Amount in wei
   * @returns Formatted string (e.g., "0.01 STT")
   */
  formatTipAmount(amountInWei: number): string {
    if (amountInWei === 0) return '0 STT';
    
    const stt = Number(formatEther(BigInt(amountInWei)));
    
    if (stt < 0.001) {
      return `${(amountInWei / 1e9).toFixed(2)} Gwei`;
    }
    
    return `${stt.toFixed(4)} STT`;
  }

  /**
   * Parse tip amount from STT to wei
   * 
   * @param amountInSTT - Amount in STT (e.g., "0.01")
   * @returns Amount in wei
   */
  parseTipAmount(amountInSTT: string): number {
    try {
      const wei = parseEther(amountInSTT);
      return Number(wei);
    } catch (error) {
      console.error('❌ [Tip] Failed to parse tip amount:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const tipService = new TipService();
export default tipService;
