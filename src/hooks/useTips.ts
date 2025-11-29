/**
 * Custom hook for tip functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { useWalletClient } from 'wagmi';
import { tipService, TipTarget, TipData, TipStats } from '@/services/tipService';
import { useSequence } from '@/contexts/SequenceContext';
import { toast } from 'sonner';

export const useTips = (targetType: TipTarget, targetId: number | string) => {
  const { smartAccountAddress } = useSequence();
  const { data: walletClient } = useWalletClient();
  
  const [stats, setStats] = useState<TipStats>({
    totalAmount: 0,
    tipCount: 0,
    topTippers: [],
    recentTips: [],
  });
  const [hasTipped, setHasTipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  /**
   * Load tip statistics
   */
  const loadStats = useCallback(async () => {
    if (!targetId) return;
    
    setIsLoading(true);
    try {
      const tipStats = await tipService.getTipStats(targetType, targetId);
      setStats(tipStats);

      // Check if current user has tipped
      if (smartAccountAddress) {
        const tipped = await tipService.hasTipped(targetType, targetId, smartAccountAddress);
        setHasTipped(tipped);
      }
    } catch (error) {
      console.error('Failed to load tip stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetType, targetId, smartAccountAddress]);

  /**
   * Send tip
   */
  const sendTip = useCallback(async (
    amount: number,
    recipientAddress: string,
    message?: string
  ) => {
    if (!smartAccountAddress) {
      toast.error('Please connect your wallet');
      return false;
    }

    if (!walletClient) {
      toast.error('Wallet client not available');
      return false;
    }

    if (amount <= 0) {
      toast.error('Amount must be greater than 0');
      return false;
    }

    setIsSending(true);
    
    // Show loading toast
    toast.loading('Sending tip...', { id: 'tip-tx' });
    
    try {
      const tipData: TipData = {
        targetType,
        targetId,
        amount,
        message,
        fromUser: smartAccountAddress,
        toUser: recipientAddress,
      };

      await tipService.sendTip(tipData, walletClient);
      
      // Show success message (replaces loading toast with same ID)
      const formattedAmount = tipService.formatTipAmount(amount);
      toast.success(`Tip sent successfully! 💰`, {
        id: 'tip-tx', // Use same ID to replace loading toast
        description: `${formattedAmount} sent to ${recipientAddress.slice(0, 8)}...`,
        duration: 5000,
      });
      
      // Reload stats after a delay
      setTimeout(() => {
        loadStats();
      }, 2000);

      return true;
    } catch (error: any) {
      console.error('Failed to send tip:', error);
      
      // Show error message (replaces loading toast with same ID)
      const errorMessage = error?.message || 'Failed to send tip';
      toast.error('Tip Failed', {
        id: 'tip-tx', // Use same ID to replace loading toast
        description: errorMessage,
        duration: 5000,
      });
      
      return false;
    } finally {
      setIsSending(false);
    }
  }, [targetType, targetId, smartAccountAddress, walletClient, loadStats]);

  /**
   * Format amount for display
   */
  const formatAmount = useCallback((amountInWei: number) => {
    return tipService.formatTipAmount(amountInWei);
  }, []);

  /**
   * Parse amount from STT to wei
   */
  const parseAmount = useCallback((amountInSTT: string) => {
    return tipService.parseTipAmount(amountInSTT);
  }, []);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    hasTipped,
    isLoading,
    isSending,
    sendTip,
    formatAmount,
    parseAmount,
    reload: loadStats,
  };
};

/**
 * Hook for user's tip history
 */
export const useUserTips = () => {
  const { smartAccountAddress } = useSequence();
  const [sentTips, setSentTips] = useState<any[]>([]);
  const [receivedTips, setReceivedTips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTips = useCallback(async () => {
    if (!smartAccountAddress) return;

    setIsLoading(true);
    try {
      const [sent, received] = await Promise.all([
        tipService.getTipsSentByUser(smartAccountAddress),
        tipService.getTipsReceivedByUser(smartAccountAddress),
      ]);

      setSentTips(sent);
      setReceivedTips(received);
    } catch (error) {
      console.error('Failed to load user tips:', error);
    } finally {
      setIsLoading(false);
    }
  }, [smartAccountAddress]);

  useEffect(() => {
    loadTips();
  }, [loadTips]);

  return {
    sentTips,
    receivedTips,
    isLoading,
    reload: loadTips,
  };
};
