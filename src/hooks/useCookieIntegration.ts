/**
 * Cookie Integration Hook
 * Integrates all cookie functionality with the app
 */

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { sessionCookieService } from '@/services/sessionCookieService';
import { analyticsService } from '@/services/analyticsService';
import { useLocation } from 'react-router-dom';

export const useCookieIntegration = () => {
  const { address, isConnected } = useAccount();
  const location = useLocation();

  // Initialize session cookies when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      // Detect wallet provider
      const provider = (window as any).ethereum?.isMetaMask ? 'MetaMask' : 'Sequence';
      
      // Initialize session
      sessionCookieService.initializeSession(address, provider);
      
      // Generate CSRF token
      sessionCookieService.generateCsrfToken();
    } else {
      // Clear session on disconnect
      sessionCookieService.clearSession();
    }
  }, [isConnected, address]);

  // Track page views
  useEffect(() => {
    analyticsService.trackPageView(location.pathname);
  }, [location.pathname]);

  return {
    sessionInfo: sessionCookieService.getSessionInfo(),
    analyticsInfo: analyticsService.getAnalyticsSummary(),
  };
};
