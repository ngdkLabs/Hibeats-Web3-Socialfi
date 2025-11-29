/**
 * Session Cookie Service
 * Integrates cookies with authentication and wallet management
 */

import { cookieService } from './cookieService';

class SessionCookieService {
  /**
   * Initialize session when user connects wallet
   */
  initializeSession(walletAddress: string, provider: string): void {
    // Generate session ID
    const sessionId = this.generateSessionId();
    
    // Set essential cookies
    cookieService.setSession(sessionId);
    cookieService.setWallet(walletAddress);
    cookieService.setWalletProvider(provider);
    
    // Set network (Somnia Testnet)
    cookieService.setNetwork('50312'); // Somnia testnet chain ID
    
    console.log('✅ Session cookies initialized for:', walletAddress);
  }

  /**
   * Update session with auth token
   */
  setAuthToken(token: string): void {
    cookieService.setAuthToken(token);
  }

  /**
   * Set CSRF token for security
   */
  setCsrfToken(token: string): void {
    cookieService.setCsrfToken(token);
  }

  /**
   * Store session key for gasless transactions
   */
  setSessionKey(key: string): void {
    cookieService.setSessionKey(key);
  }

  /**
   * Store last transaction
   */
  recordTransaction(txHash: string): void {
    cookieService.setLastTransaction(txHash);
  }

  /**
   * Get current session info
   */
  getSessionInfo(): {
    sessionId: string | null;
    walletAddress: string | null;
    provider: string | null;
    network: string | null;
    authToken: string | null;
  } {
    return {
      sessionId: cookieService.getSession(),
      walletAddress: cookieService.getWallet(),
      provider: cookieService.getWalletProvider(),
      network: cookieService.getNetwork(),
      authToken: cookieService.getAuthToken(),
    };
  }

  /**
   * Check if session is valid
   */
  isSessionValid(): boolean {
    const session = cookieService.getSession();
    const wallet = cookieService.getWallet();
    return !!(session && wallet);
  }

  /**
   * Clear session on logout
   */
  clearSession(): void {
    cookieService.clearSession();
    console.log('✅ Session cookies cleared');
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate CSRF token
   */
  generateCsrfToken(): string {
    const token = `csrf_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    this.setCsrfToken(token);
    return token;
  }
}

export const sessionCookieService = new SessionCookieService();
