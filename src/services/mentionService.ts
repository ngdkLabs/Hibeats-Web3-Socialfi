/**
 * Mention Service
 * 
 * Service untuk mendukung fitur @mention di aplikasi
 * - Mendapatkan daftar user untuk autocomplete
 * - Parsing mention dari text
 * - Validasi mention
 */

import { searchService, SearchResult } from './searchService';

export interface MentionUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isVerified?: boolean;
  isArtist?: boolean;
}

export interface ParsedMention {
  username: string;
  startIndex: number;
  endIndex: number;
  userId?: string;
}

class MentionService {
  private userCache: Map<string, MentionUser> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  /**
   * Get users for mention autocomplete
   * @param query - Search query (optional)
   * @param limit - Maximum number of results
   */
  async getUsersForMention(query?: string, limit: number = 10): Promise<MentionUser[]> {
    try {
      console.log('👤 [MENTION] Getting users for mention...', { query, limit });
      
      // Get users from search service
      const searchResults = await searchService.getAllUsersForMention(query);
      
      // Convert to MentionUser format
      const users: MentionUser[] = searchResults
        .filter(result => result.username) // Only users with username
        .slice(0, limit)
        .map(result => ({
          id: result.id,
          username: result.username || '',
          displayName: result.title,
          avatarUrl: result.image,
          isVerified: result.verified,
          isArtist: result.type === 'artist',
        }));
      
      // Update cache
      users.forEach(user => {
        this.userCache.set(user.username.toLowerCase(), user);
      });
      this.lastCacheUpdate = Date.now();
      
      console.log(`✅ [MENTION] Found ${users.length} users`);
      
      return users;
    } catch (error) {
      console.error('❌ [MENTION] Error getting users:', error);
      return [];
    }
  }

  /**
   * Parse mentions from text
   * Finds all @username patterns in text
   */
  parseMentions(text: string): ParsedMention[] {
    const mentions: ParsedMention[] = [];
    
    // Regex to match @username (alphanumeric and underscore)
    const mentionRegex = /@(\w+)/g;
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const username = match[1];
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;
      
      mentions.push({
        username,
        startIndex,
        endIndex,
      });
    }
    
    console.log(`📝 [MENTION] Parsed ${mentions.length} mentions from text`);
    
    return mentions;
  }

  /**
   * Validate mentions and resolve user IDs
   * @param mentions - Parsed mentions
   * @returns Mentions with resolved user IDs
   */
  async validateMentions(mentions: ParsedMention[]): Promise<ParsedMention[]> {
    if (mentions.length === 0) return [];
    
    try {
      console.log(`🔍 [MENTION] Validating ${mentions.length} mentions...`);
      
      // Get all users if cache is expired
      if (Date.now() - this.lastCacheUpdate > this.cacheExpiry) {
        await this.getUsersForMention();
      }
      
      // Resolve user IDs from cache
      const validatedMentions = mentions.map(mention => {
        const user = this.userCache.get(mention.username.toLowerCase());
        
        if (user) {
          return {
            ...mention,
            userId: user.id,
          };
        }
        
        return mention;
      });
      
      const validCount = validatedMentions.filter(m => m.userId).length;
      console.log(`✅ [MENTION] Validated ${validCount}/${mentions.length} mentions`);
      
      return validatedMentions;
    } catch (error) {
      console.error('❌ [MENTION] Error validating mentions:', error);
      return mentions;
    }
  }

  /**
   * Extract mention usernames from text
   * @param text - Text containing mentions
   * @returns Array of usernames (without @)
   */
  extractMentionUsernames(text: string): string[] {
    const mentions = this.parseMentions(text);
    return mentions.map(m => m.username);
  }

  /**
   * Format mentions for storage
   * Converts mentions to comma-separated string of user IDs
   */
  async formatMentionsForStorage(text: string): Promise<string> {
    const mentions = this.parseMentions(text);
    const validatedMentions = await this.validateMentions(mentions);
    
    // Get unique user IDs
    const userIds = [...new Set(
      validatedMentions
        .filter(m => m.userId)
        .map(m => m.userId!)
    )];
    
    return userIds.join(',');
  }

  /**
   * Highlight mentions in text for display
   * Wraps @username in span tags for styling
   */
  highlightMentions(text: string): string {
    return text.replace(
      /@(\w+)/g,
      '<span class="mention" data-username="$1">@$1</span>'
    );
  }

  /**
   * Get user by username from cache
   */
  getUserFromCache(username: string): MentionUser | undefined {
    return this.userCache.get(username.toLowerCase());
  }

  /**
   * Clear user cache
   */
  clearCache(): void {
    this.userCache.clear();
    this.lastCacheUpdate = 0;
    console.log('🗑️ [MENTION] Cache cleared');
  }

  /**
   * Preload users for better performance
   */
  async preloadUsers(): Promise<void> {
    try {
      console.log('⚡ [MENTION] Preloading users...');
      await this.getUsersForMention(undefined, 50);
      console.log('✅ [MENTION] Users preloaded');
    } catch (error) {
      console.error('❌ [MENTION] Error preloading users:', error);
    }
  }
}

export const mentionService = new MentionService();
export default mentionService;
