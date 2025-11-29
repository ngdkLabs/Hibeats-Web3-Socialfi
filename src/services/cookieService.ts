/**
 * Enhanced Cookie Service for HiBeats
 * Manages cookie consent and all application cookies
 * Implements all cookies mentioned in Cookie Policy
 */

export type CookieCategory = 'essential' | 'functional' | 'analytics' | 'performance';

export interface CookieConsent {
  essential: boolean; // Always true, cannot be disabled
  functional: boolean;
  analytics: boolean;
  performance: boolean;
  timestamp: number;
}

// Cookie name constants
export const COOKIE_NAMES = {
  // Essential
  SESSION: 'session',
  WALLET: 'wallet',
  AUTH_TOKEN: 'auth_token',
  CSRF: 'csrf',
  CONSENT: 'cookie_consent',
  
  // Functional
  THEME: 'theme',
  LANGUAGE: 'language',
  AUDIO_SETTINGS: 'audio_settings',
  VOLUME: 'volume',
  PLAYLIST_VIEW: 'playlist_view',
  
  // Performance
  ANALYTICS: 'analytics',
  PAGE_VIEWS: 'page_views',
  SESSION_DURATION: 'session_duration',
  
  // Web3
  WALLET_PROVIDER: 'wallet_provider',
  NETWORK: 'network',
  SESSION_KEY: 'session_key',
  LAST_TX: 'last_tx',
} as const;

const COOKIE_CONSENT_KEY = 'hibeats_cookie_consent';
const COOKIE_PREFIX = 'hibeats_';

class CookieService {
  private consent: CookieConsent | null = null;
  private sessionStartTime: number = Date.now();

  constructor() {
    this.loadConsent();
    this.initializeSessionTracking();
  }

  /**
   * Load cookie consent from localStorage
   */
  private loadConsent(): void {
    try {
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (stored) {
        this.consent = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load cookie consent:', error);
    }
  }

  /**
   * Save cookie consent to localStorage
   */
  saveConsent(consent: Omit<CookieConsent, 'timestamp'>): void {
    this.consent = {
      ...consent,
      essential: true, // Always true
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(this.consent));
      this.applyCookiePreferences();
    } catch (error) {
      console.error('Failed to save cookie consent:', error);
    }
  }

  /**
   * Get current cookie consent
   */
  getConsent(): CookieConsent | null {
    return this.consent;
  }

  /**
   * Check if user has given consent
   */
  hasConsent(): boolean {
    return this.consent !== null;
  }

  /**
   * Check if a specific cookie category is allowed
   */
  isCategoryAllowed(category: CookieCategory): boolean {
    if (!this.consent) return false;
    if (category === 'essential') return true; // Essential cookies always allowed
    return this.consent[category];
  }

  /**
   * Apply cookie preferences by removing disallowed cookies
   */
  private applyCookiePreferences(): void {
    if (!this.consent) return;

    // Remove functional cookies if not allowed
    if (!this.consent.functional) {
      this.removeCookie('theme');
      this.removeCookie('volume');
      this.removeCookie('playback');
      this.removeCookie('language');
    }

    // Remove analytics cookies if not allowed
    if (!this.consent.analytics) {
      this.removeCookie('analytics');
      this.removeCookie('user_id');
    }

    // Remove performance cookies if not allowed
    if (!this.consent.performance) {
      this.removeCookie('performance');
      this.removeCookie('cache');
    }
  }

  /**
   * Set a cookie with category check
   */
  setCookie(name: string, value: string, category: CookieCategory, days: number = 365): void {
    if (!this.isCategoryAllowed(category)) {
      console.warn(`Cookie ${name} not set: ${category} cookies not allowed`);
      return;
    }

    try {
      const fullName = `${COOKIE_PREFIX}${name}`;
      const expires = new Date();
      expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
      
      document.cookie = `${fullName}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax;Secure`;
    } catch (error) {
      console.error(`Failed to set cookie ${name}:`, error);
    }
  }

  /**
   * Get a cookie value
   */
  getCookie(name: string): string | null {
    try {
      const fullName = `${COOKIE_PREFIX}${name}`;
      const nameEQ = fullName + "=";
      const ca = document.cookie.split(';');
      
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        if (!c) continue;
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
      }
      return null;
    } catch (error) {
      console.error(`Failed to get cookie ${name}:`, error);
      return null;
    }
  }

  /**
   * Remove a cookie
   */
  removeCookie(name: string): void {
    try {
      const fullName = `${COOKIE_PREFIX}${name}`;
      document.cookie = `${fullName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    } catch (error) {
      console.error(`Failed to remove cookie ${name}:`, error);
    }
  }

  /**
   * Remove all HiBeats cookies
   */
  removeAllCookies(): void {
    try {
      const cookies = document.cookie.split(';');
      
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        if (!cookie) continue;
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        
        if (name.startsWith(COOKIE_PREFIX)) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
        }
      }
    } catch (error) {
      console.error('Failed to remove all cookies:', error);
    }
  }

  /**
   * Reset cookie consent (for testing or user request)
   */
  resetConsent(): void {
    this.consent = null;
    try {
      localStorage.removeItem(COOKIE_CONSENT_KEY);
    } catch (error) {
      console.error('Failed to reset consent:', error);
    }
  }

  /**
   * Accept all cookies
   */
  acceptAll(): void {
    this.saveConsent({
      essential: true,
      functional: true,
      analytics: true,
      performance: true,
    });
  }

  /**
   * Accept only essential cookies
   */
  acceptEssentialOnly(): void {
    this.saveConsent({
      essential: true,
      functional: false,
      analytics: false,
      performance: false,
    });
  }

  // ============================================
  // ESSENTIAL COOKIES
  // ============================================

  /**
   * Set session cookie
   */
  setSession(sessionId: string): void {
    this.setCookie(COOKIE_NAMES.SESSION, sessionId, 'essential', 0); // Session cookie
  }

  /**
   * Get session cookie
   */
  getSession(): string | null {
    return this.getCookie(COOKIE_NAMES.SESSION);
  }

  /**
   * Set wallet address cookie
   */
  setWallet(address: string): void {
    this.setCookie(COOKIE_NAMES.WALLET, address, 'essential', 30);
  }

  /**
   * Get wallet address cookie
   */
  getWallet(): string | null {
    return this.getCookie(COOKIE_NAMES.WALLET);
  }

  /**
   * Set auth token cookie
   */
  setAuthToken(token: string): void {
    this.setCookie(COOKIE_NAMES.AUTH_TOKEN, token, 'essential', 7);
  }

  /**
   * Get auth token cookie
   */
  getAuthToken(): string | null {
    return this.getCookie(COOKIE_NAMES.AUTH_TOKEN);
  }

  /**
   * Set CSRF token cookie
   */
  setCsrfToken(token: string): void {
    this.setCookie(COOKIE_NAMES.CSRF, token, 'essential', 0); // Session cookie
  }

  /**
   * Get CSRF token cookie
   */
  getCsrfToken(): string | null {
    return this.getCookie(COOKIE_NAMES.CSRF);
  }

  // ============================================
  // FUNCTIONAL COOKIES
  // ============================================

  /**
   * Set theme preference
   */
  setTheme(theme: 'light' | 'dark'): void {
    this.setCookie(COOKIE_NAMES.THEME, theme, 'functional', 365);
  }

  /**
   * Get theme preference
   */
  getTheme(): string | null {
    return this.getCookie(COOKIE_NAMES.THEME);
  }

  /**
   * Set language preference
   */
  setLanguage(language: string): void {
    this.setCookie(COOKIE_NAMES.LANGUAGE, language, 'functional', 365);
  }

  /**
   * Get language preference
   */
  getLanguage(): string | null {
    return this.getCookie(COOKIE_NAMES.LANGUAGE);
  }

  /**
   * Set audio settings
   */
  setAudioSettings(settings: object): void {
    this.setCookie(COOKIE_NAMES.AUDIO_SETTINGS, JSON.stringify(settings), 'functional', 365);
  }

  /**
   * Get audio settings
   */
  getAudioSettings(): object | null {
    const settings = this.getCookie(COOKIE_NAMES.AUDIO_SETTINGS);
    if (settings) {
      try {
        return JSON.parse(settings);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Set volume (already implemented, keeping for consistency)
   */
  setVolume(volume: number): void {
    this.setCookie(COOKIE_NAMES.VOLUME, volume.toString(), 'functional', 365);
  }

  /**
   * Get volume (already implemented, keeping for consistency)
   */
  getVolume(): number | null {
    const volume = this.getCookie(COOKIE_NAMES.VOLUME);
    if (volume) {
      const parsed = parseFloat(volume);
      return !isNaN(parsed) ? parsed : null;
    }
    return null;
  }

  /**
   * Set playlist view preference
   */
  setPlaylistView(view: 'grid' | 'list'): void {
    this.setCookie(COOKIE_NAMES.PLAYLIST_VIEW, view, 'functional', 90);
  }

  /**
   * Get playlist view preference
   */
  getPlaylistView(): string | null {
    return this.getCookie(COOKIE_NAMES.PLAYLIST_VIEW);
  }

  // ============================================
  // PERFORMANCE COOKIES
  // ============================================

  /**
   * Set analytics ID
   */
  setAnalyticsId(id: string): void {
    this.setCookie(COOKIE_NAMES.ANALYTICS, id, 'analytics', 730); // 2 years
  }

  /**
   * Get analytics ID
   */
  getAnalyticsId(): string | null {
    return this.getCookie(COOKIE_NAMES.ANALYTICS);
  }

  /**
   * Increment page views
   */
  incrementPageViews(): void {
    const current = this.getPageViews();
    this.setCookie(COOKIE_NAMES.PAGE_VIEWS, (current + 1).toString(), 'analytics', 30);
  }

  /**
   * Get page views count
   */
  getPageViews(): number {
    const views = this.getCookie(COOKIE_NAMES.PAGE_VIEWS);
    return views ? parseInt(views) || 0 : 0;
  }

  /**
   * Initialize session tracking
   */
  private initializeSessionTracking(): void {
    if (this.isCategoryAllowed('analytics')) {
      this.sessionStartTime = Date.now();
      
      // Update session duration every minute
      setInterval(() => {
        this.updateSessionDuration();
      }, 60000);

      // Update on page unload
      window.addEventListener('beforeunload', () => {
        this.updateSessionDuration();
      });
    }
  }

  /**
   * Update session duration
   */
  private updateSessionDuration(): void {
    const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000); // in seconds
    this.setCookie(COOKIE_NAMES.SESSION_DURATION, duration.toString(), 'analytics', 0); // Session cookie
  }

  /**
   * Get session duration in seconds
   */
  getSessionDuration(): number {
    const duration = this.getCookie(COOKIE_NAMES.SESSION_DURATION);
    return duration ? parseInt(duration) || 0 : 0;
  }

  // ============================================
  // WEB3 & BLOCKCHAIN COOKIES
  // ============================================

  /**
   * Set wallet provider
   */
  setWalletProvider(provider: string): void {
    this.setCookie(COOKIE_NAMES.WALLET_PROVIDER, provider, 'essential', 30);
  }

  /**
   * Get wallet provider
   */
  getWalletProvider(): string | null {
    return this.getCookie(COOKIE_NAMES.WALLET_PROVIDER);
  }

  /**
   * Set network
   */
  setNetwork(network: string): void {
    this.setCookie(COOKIE_NAMES.NETWORK, network, 'essential', 30);
  }

  /**
   * Get network
   */
  getNetwork(): string | null {
    return this.getCookie(COOKIE_NAMES.NETWORK);
  }

  /**
   * Set session key for gasless transactions
   */
  setSessionKey(key: string): void {
    this.setCookie(COOKIE_NAMES.SESSION_KEY, key, 'essential', 1); // 24 hours
  }

  /**
   * Get session key
   */
  getSessionKey(): string | null {
    return this.getCookie(COOKIE_NAMES.SESSION_KEY);
  }

  /**
   * Set last transaction hash
   */
  setLastTransaction(txHash: string): void {
    this.setCookie(COOKIE_NAMES.LAST_TX, txHash, 'essential', 7);
  }

  /**
   * Get last transaction hash
   */
  getLastTransaction(): string | null {
    return this.getCookie(COOKIE_NAMES.LAST_TX);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Clear all user session data
   */
  clearSession(): void {
    this.removeCookie(COOKIE_NAMES.SESSION);
    this.removeCookie(COOKIE_NAMES.WALLET);
    this.removeCookie(COOKIE_NAMES.AUTH_TOKEN);
    this.removeCookie(COOKIE_NAMES.CSRF);
    this.removeCookie(COOKIE_NAMES.SESSION_KEY);
    this.removeCookie(COOKIE_NAMES.LAST_TX);
  }

  /**
   * Get all cookies as object
   */
  getAllCookies(): Record<string, string> {
    const cookies: Record<string, string> = {};
    Object.values(COOKIE_NAMES).forEach(name => {
      const value = this.getCookie(name);
      if (value) {
        cookies[name] = value;
      }
    });
    return cookies;
  }
}

export const cookieService = new CookieService();
