/**
 * Analytics Service
 * Handles analytics cookies and tracking (with consent)
 */

import { cookieService } from './cookieService';

class AnalyticsService {
  private analyticsId: string | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize analytics
   */
  private initialize(): void {
    if (cookieService.isCategoryAllowed('analytics')) {
      // Get or create analytics ID
      let id = cookieService.getAnalyticsId();
      if (!id) {
        id = this.generateAnalyticsId();
        cookieService.setAnalyticsId(id);
      }
      this.analyticsId = id;
    }
  }

  /**
   * Track page view
   */
  trackPageView(page: string): void {
    if (!cookieService.isCategoryAllowed('analytics')) {
      return;
    }

    cookieService.incrementPageViews();
    
    console.log('📊 [Analytics] Page view:', {
      page,
      totalViews: cookieService.getPageViews(),
      analyticsId: this.analyticsId,
      sessionDuration: cookieService.getSessionDuration(),
    });
  }

  /**
   * Track event
   */
  trackEvent(category: string, action: string, label?: string, value?: number): void {
    if (!cookieService.isCategoryAllowed('analytics')) {
      return;
    }

    console.log('📊 [Analytics] Event:', {
      category,
      action,
      label,
      value,
      analyticsId: this.analyticsId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track user interaction
   */
  trackInteraction(type: string, target: string, metadata?: object): void {
    if (!cookieService.isCategoryAllowed('analytics')) {
      return;
    }

    console.log('📊 [Analytics] Interaction:', {
      type,
      target,
      metadata,
      analyticsId: this.analyticsId,
    });
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary(): {
    analyticsId: string | null;
    pageViews: number;
    sessionDuration: number;
    enabled: boolean;
  } {
    return {
      analyticsId: this.analyticsId,
      pageViews: cookieService.getPageViews(),
      sessionDuration: cookieService.getSessionDuration(),
      enabled: cookieService.isCategoryAllowed('analytics'),
    };
  }

  /**
   * Generate unique analytics ID
   */
  private generateAnalyticsId(): string {
    return `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  /**
   * Reset analytics (when user opts out)
   */
  reset(): void {
    this.analyticsId = null;
    console.log('📊 [Analytics] Reset - user opted out');
  }
}

export const analyticsService = new AnalyticsService();
