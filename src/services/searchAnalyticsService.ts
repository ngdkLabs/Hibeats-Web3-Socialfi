/**
 * Search Analytics Service
 * Tracks search queries, clicks, and user behavior for improving search results
 */

interface SearchEvent {
  query: string;
  category?: string;
  resultCount: number;
  timestamp: number;
  userId?: string;
}

interface SearchClickEvent {
  query: string;
  resultId: string;
  resultType: string;
  position: number;
  timestamp: number;
  userId?: string;
}

class SearchAnalyticsService {
  private readonly STORAGE_KEY = 'search_analytics';
  private readonly MAX_EVENTS = 1000;

  /**
   * Track a search query
   */
  trackSearch(query: string, resultCount: number, category?: string, userId?: string) {
    const event: SearchEvent = {
      query: query.toLowerCase().trim(),
      category,
      resultCount,
      timestamp: Date.now(),
      userId,
    };

    this.saveEvent('searches', event);
    
    // Log to console for debugging
    console.log('🔍 Search tracked:', event);
  }

  /**
   * Track a search result click
   */
  trackClick(
    query: string,
    resultId: string,
    resultType: string,
    position: number,
    userId?: string
  ) {
    const event: SearchClickEvent = {
      query: query.toLowerCase().trim(),
      resultId,
      resultType,
      position,
      timestamp: Date.now(),
      userId,
    };

    this.saveEvent('clicks', event);
    
    // Log to console for debugging
    console.log('👆 Search click tracked:', event);
  }

  /**
   * Get popular searches
   */
  getPopularSearches(limit: number = 10): string[] {
    const searches = this.getEvents<SearchEvent>('searches');
    
    // Count query frequency
    const queryCounts = new Map<string, number>();
    searches.forEach(search => {
      const count = queryCounts.get(search.query) || 0;
      queryCounts.set(search.query, count + 1);
    });

    // Sort by frequency
    const sorted = Array.from(queryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([query]) => query);

    return sorted.slice(0, limit);
  }

  /**
   * Get trending searches (recent + popular)
   */
  getTrendingSearches(limit: number = 10): string[] {
    const searches = this.getEvents<SearchEvent>('searches');
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Filter recent searches
    const recentSearches = searches.filter(s => s.timestamp > oneDayAgo);

    // Count query frequency
    const queryCounts = new Map<string, number>();
    recentSearches.forEach(search => {
      const count = queryCounts.get(search.query) || 0;
      queryCounts.set(search.query, count + 1);
    });

    // Sort by frequency
    const sorted = Array.from(queryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([query]) => query);

    return sorted.slice(0, limit);
  }

  /**
   * Get search suggestions based on user history
   */
  getSuggestions(partialQuery: string, limit: number = 5): string[] {
    const searches = this.getEvents<SearchEvent>('searches');
    const lowerQuery = partialQuery.toLowerCase().trim();

    if (!lowerQuery) return [];

    // Find matching queries
    const matches = searches
      .filter(s => s.query.includes(lowerQuery))
      .map(s => s.query);

    // Remove duplicates and limit
    return [...new Set(matches)].slice(0, limit);
  }

  /**
   * Get click-through rate for a query
   */
  getClickThroughRate(query: string): number {
    const searches = this.getEvents<SearchEvent>('searches').filter(
      s => s.query === query.toLowerCase().trim()
    );
    const clicks = this.getEvents<SearchClickEvent>('clicks').filter(
      c => c.query === query.toLowerCase().trim()
    );

    if (searches.length === 0) return 0;
    return clicks.length / searches.length;
  }

  /**
   * Clear old analytics data
   */
  clearOldData(daysToKeep: number = 30) {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    const searches = this.getEvents<SearchEvent>('searches').filter(
      e => e.timestamp > cutoffTime
    );
    const clicks = this.getEvents<SearchClickEvent>('clicks').filter(
      e => e.timestamp > cutoffTime
    );

    this.saveAllEvents('searches', searches);
    this.saveAllEvents('clicks', clicks);
  }

  /**
   * Save an event to localStorage
   */
  private saveEvent(type: string, event: any) {
    const events = this.getEvents(type);
    events.push(event);

    // Keep only recent events
    const trimmed = events.slice(-this.MAX_EVENTS);
    this.saveAllEvents(type, trimmed);
  }

  /**
   * Get events from localStorage
   */
  private getEvents<T = any>(type: string): T[] {
    try {
      const data = localStorage.getItem(`${this.STORAGE_KEY}_${type}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading analytics:', error);
      return [];
    }
  }

  /**
   * Save all events to localStorage
   */
  private saveAllEvents(type: string, events: any[]) {
    try {
      localStorage.setItem(`${this.STORAGE_KEY}_${type}`, JSON.stringify(events));
    } catch (error) {
      console.error('Error saving analytics:', error);
    }
  }

  /**
   * Export analytics data
   */
  exportData() {
    return {
      searches: this.getEvents<SearchEvent>('searches'),
      clicks: this.getEvents<SearchClickEvent>('clicks'),
      popular: this.getPopularSearches(20),
      trending: this.getTrendingSearches(20),
    };
  }

  /**
   * Clear all analytics data
   */
  clearAll() {
    localStorage.removeItem(`${this.STORAGE_KEY}_searches`);
    localStorage.removeItem(`${this.STORAGE_KEY}_clicks`);
  }
}

export const searchAnalyticsService = new SearchAnalyticsService();
