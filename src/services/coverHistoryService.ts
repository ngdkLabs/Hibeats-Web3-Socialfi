/**
 * Cover History Service
 * Manages cover generation history in localStorage
 */

export interface CoverHistoryItem {
  id: string;
  taskId: string;
  audioUrl: string;
  title: string;
  audioId?: string;
  imageUrl?: string;
  tags?: string;
  duration?: number;
  prompt?: string;
  modelName?: string;
  createdAt: string;
  settings: {
    style?: string;
    customMode: boolean;
    instrumental: boolean;
    model: string;
    vocalGender: string;
    personaId?: string;
    negativeTags?: string;
    styleWeight: number;
    weirdnessConstraint: number;
    audioWeight: number;
  };
}

const STORAGE_KEY = 'coverHistory';
const MAX_HISTORY_ITEMS = 50; // Keep last 50 covers

class CoverHistoryService {
  /**
   * Get all cover history
   */
  getHistory(): CoverHistoryItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      
      const history = JSON.parse(data);
      return Array.isArray(history) ? history : [];
    } catch (error) {
      console.error('Failed to load cover history:', error);
      return [];
    }
  }

  /**
   * Add new cover to history
   */
  addToHistory(item: Omit<CoverHistoryItem, 'id' | 'createdAt'>): CoverHistoryItem {
    const history = this.getHistory();
    
    const newItem: CoverHistoryItem = {
      ...item,
      id: `cover_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    
    // Add to beginning of array
    history.unshift(newItem);
    
    // Keep only last MAX_HISTORY_ITEMS
    const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);
    
    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
      console.log('✅ Cover saved to history:', newItem.title);
    } catch (error) {
      console.error('Failed to save cover to history:', error);
    }
    
    return newItem;
  }

  /**
   * Get cover by ID
   */
  getById(id: string): CoverHistoryItem | null {
    const history = this.getHistory();
    return history.find(item => item.id === id) || null;
  }

  /**
   * Delete cover from history
   */
  deleteFromHistory(id: string): boolean {
    const history = this.getHistory();
    const filtered = history.filter(item => item.id !== id);
    
    if (filtered.length === history.length) {
      return false; // Item not found
    }
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      console.log('✅ Cover deleted from history:', id);
      return true;
    } catch (error) {
      console.error('Failed to delete cover from history:', error);
      return false;
    }
  }

  /**
   * Clear all history
   */
  clearHistory(): boolean {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('✅ Cover history cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear cover history:', error);
      return false;
    }
  }

  /**
   * Get history count
   */
  getCount(): number {
    return this.getHistory().length;
  }

  /**
   * Search history by title or tags
   */
  search(query: string): CoverHistoryItem[] {
    const history = this.getHistory();
    const lowerQuery = query.toLowerCase();
    
    return history.filter(item => 
      item.title.toLowerCase().includes(lowerQuery) ||
      item.tags?.toLowerCase().includes(lowerQuery) ||
      item.settings.style?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get history grouped by date
   */
  getGroupedByDate(): Record<string, CoverHistoryItem[]> {
    const history = this.getHistory();
    const grouped: Record<string, CoverHistoryItem[]> = {};
    
    history.forEach(item => {
      const date = new Date(item.createdAt).toLocaleDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(item);
    });
    
    return grouped;
  }

  /**
   * Export history as JSON
   */
  exportHistory(): string {
    const history = this.getHistory();
    return JSON.stringify(history, null, 2);
  }

  /**
   * Import history from JSON
   */
  importHistory(jsonData: string): boolean {
    try {
      const imported = JSON.parse(jsonData);
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format: expected array');
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      console.log('✅ Cover history imported:', imported.length, 'items');
      return true;
    } catch (error) {
      console.error('Failed to import cover history:', error);
      return false;
    }
  }
}

export const coverHistoryService = new CoverHistoryService();
