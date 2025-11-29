/**
 * Custom hook for auto-refreshing wallet balance
 * 
 * Features:
 * - Auto-refresh every 5 seconds in background
 * - Manual refresh trigger
 * - Event-based refresh (after transactions)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useBalance, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';

interface UseBalanceRefreshOptions {
  /** Refresh interval in milliseconds (default: 5000ms = 5 seconds) */
  refreshInterval?: number;
  /** Whether to enable auto-refresh (default: true) */
  enabled?: boolean;
}

interface BalanceData {
  value: bigint;
  formatted: string;
  symbol: string;
  decimals: number;
}

export const useBalanceRefresh = (
  address: string | undefined | null,
  options: UseBalanceRefreshOptions = {}
) => {
  const { refreshInterval = 5000, enabled = true } = options;
  
  const publicClient = usePublicClient();
  const [manualBalance, setManualBalance] = useState<BalanceData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefreshRef = useRef<number>(0);
  
  // Use wagmi's useBalance as base
  const { 
    data: wagmiBalance, 
    isLoading: isWagmiLoading,
    refetch: wagmiRefetch 
  } = useBalance({
    address: address as `0x${string}`,
    query: {
      enabled: !!address && enabled,
      refetchInterval: refreshInterval,
      staleTime: 2000, // Consider data stale after 2 seconds
    }
  });

  // Manual balance fetch using publicClient (faster)
  const fetchBalance = useCallback(async () => {
    if (!address || !publicClient) return null;
    
    try {
      const balance = await publicClient.getBalance({
        address: address as `0x${string}`,
      });
      
      return {
        value: balance,
        formatted: formatEther(balance),
        symbol: 'STT',
        decimals: 18,
      };
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      return null;
    }
  }, [address, publicClient]);

  // Refresh balance manually
  const refresh = useCallback(async () => {
    if (!address) return;
    
    // Debounce: prevent refresh if last refresh was less than 1 second ago
    const now = Date.now();
    if (now - lastRefreshRef.current < 1000) {
      console.log('⏳ [Balance] Debounced refresh, too soon');
      return;
    }
    
    lastRefreshRef.current = now;
    setIsRefreshing(true);
    
    try {
      // Fetch fresh balance directly from RPC
      const freshBalance = await fetchBalance();
      if (freshBalance) {
        setManualBalance(freshBalance);
        // console.log('💰 [Balance] Refreshed:', freshBalance.formatted, freshBalance.symbol);
      }
      
      // Also trigger wagmi refetch
      await wagmiRefetch();
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [address, fetchBalance, wagmiRefetch]);

  // Auto-refresh in background
  useEffect(() => {
    if (!address || !enabled) return;
    
    // Initial fetch
    refresh();
    
    // Set up interval for background refresh
    const intervalId = setInterval(() => {
      refresh();
    }, refreshInterval);
    
    return () => clearInterval(intervalId);
  }, [address, enabled, refreshInterval, refresh]);

  // Listen for transaction events to trigger refresh
  useEffect(() => {
    if (!address) return;
    
    // Custom event listener for balance refresh
    const handleBalanceRefresh = () => {
      console.log('🔄 [Balance] Refresh triggered by event');
      // Small delay to allow blockchain to update
      setTimeout(refresh, 1000);
    };
    
    window.addEventListener('balance-refresh', handleBalanceRefresh);
    
    return () => {
      window.removeEventListener('balance-refresh', handleBalanceRefresh);
    };
  }, [address, refresh]);

  // Use manual balance if available and fresher, otherwise use wagmi balance
  const balance = manualBalance || wagmiBalance;
  const isLoading = isWagmiLoading && !manualBalance;

  return {
    balance,
    isLoading,
    isRefreshing,
    refresh,
    /** Trigger a balance refresh event (can be called from anywhere) */
    triggerRefresh: () => {
      window.dispatchEvent(new CustomEvent('balance-refresh'));
    },
  };
};

/**
 * Utility function to trigger balance refresh from anywhere in the app
 */
export const triggerBalanceRefresh = () => {
  window.dispatchEvent(new CustomEvent('balance-refresh'));
};

export default useBalanceRefresh;
