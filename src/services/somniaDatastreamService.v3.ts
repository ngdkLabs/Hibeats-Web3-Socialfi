/**
 * Somnia Datastream Service V3
 * 
 * Optimized service layer untuk skema V3
 * - Simplified API
 * - Better caching
 * - Faster performance
 */

import { SDK, SchemaEncoder } from '@somnia-chain/streams';
import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  type Hex,
  numberToHex,
  pad,
  stringToHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somniaTestnet } from '@/lib/web3-config';
import { publisherIndexer } from './publisherIndexer';
import {
  SOMNIA_CONFIG_V3,
  PostDataV3,
  InteractionDataV3,
  ProfileDataV3,
  ContentType,
  InteractionType,
  TargetType,
  createPostId,
  aggregateInteractions,
  enrichPostsWithQuotes,
  buildCommentTree,
  PostStats,
  validatePostData,
  validateInteractionData,
  GeneratedMusicData,
  GeneratedMusicStatus,
  PlayEventData,
  ActivityHistoryData,
  ActivityHistoryType,
} from '@/config/somniaDataStreams.v3';
import { transactionQueue } from './nonceManager';
import { interactionLogger } from '@/utils/interactionLogger';

// Helper function to convert number to bytes32 (Hex)
function numberToBytes32(num: number): Hex {
  return pad(numberToHex(num), { size: 32 });
}

class SomniaDatastreamServiceV3 {
  private sdk: SDK | null = null;
  private publicClient: any = null;
  private walletClient: any = null;
  
  // Debug flag - set to false to reduce console logs
  private DEBUG_MODE = false; // ✅ Set to false for production
  
  // Caching
  private schemaIdCache: Map<string, Hex> = new Map();
  private dataCache: Map<string, { data: any[]; timestamp: number }> = new Map();
  private cacheExpiry = 30000; // 30 seconds
  
  // Request deduplication
  private pendingRequests: Map<string, Promise<any>> = new Map();

  private initPromise: Promise<void> | null = null;

  constructor() {
    // Auto-initialize on construction
    this.initPromise = this.initialize();
  }

  // ===== INITIALIZATION =====

  private async initialize(): Promise<void> {
    try {
      // Initialize clients
      this.publicClient = createPublicClient({
        chain: somniaTestnet,
        transport: webSocket(SOMNIA_CONFIG_V3.wsUrl),
      });

      // Wallet client (if private key available)
      const privateKey = import.meta.env.VITE_PRIVATE_KEY;
      if (privateKey) {
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        this.walletClient = createWalletClient({
          account,
          chain: somniaTestnet,
          transport: http(SOMNIA_CONFIG_V3.rpcUrl),
        });
        console.log('✅ [V3] Wallet client initialized');
      }

      console.log('✅ [V3] Viem clients initialized');

      // Initialize SDK
      console.log('🚀 [V3] Initializing Somnia DataStream SDK...');
      this.sdk = new SDK({
        public: this.publicClient,
        wallet: this.walletClient,
      });

      console.log('✅ [V3] SDK initialized successfully');
    } catch (error) {
      console.error('❌ [V3] Failed to initialize:', error);
      throw error;
    }
  }

  async connect(): Promise<void> {
    // Wait for initialization to complete
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }
  }

  /**
   * Get server publisher address (for backward compatibility)
   */
  private async getServerPublisherAddress(): Promise<string> {
    const privateKey = import.meta.env.VITE_PRIVATE_KEY;
    if (privateKey) {
      return privateKeyToAccount(privateKey as `0x${string}`).address;
    }
    throw new Error('Server private key not found');
  }

  isConnected(): boolean {
    return this.sdk !== null;
  }

  /**
   * Get SDK instance for external use (e.g., messaging service)
   */
  async getSDK(): Promise<SDK | null> {
    await this.ensureInitialized();
    return this.sdk;
  }

  /**
   * Get public client for external use
   */
  getPublicClient(): any {
    return this.publicClient;
  }

  /**
   * Get total count of posts for current publisher
   */
  async getPostCount(): Promise<number> {
    await this.ensureInitialized();
    
    try {
      const privateKey = import.meta.env.VITE_PRIVATE_KEY;
      const publisher = privateKey ? privateKeyToAccount(privateKey as `0x${string}`).address : null;
      
      if (!publisher) {
        throw new Error('Publisher address not found');
      }

      const schemaId = await this.getSchemaIdCached('posts');
      
      // Use getAllPublisherDataForSchema and count length
      const allData = await this.sdk!.streams.getAllPublisherDataForSchema(schemaId, publisher);
      const count = allData?.length || 0;
      
      console.log(`📊 [V3] Total posts in blockchain: ${count}`, {
        publisher,
        schemaId
      });
      
      return count;
    } catch (error) {
      console.error('❌ [V3] Failed to get post count:', error);
      return 0;
    }
  }

  // ===== SCHEMA MANAGEMENT =====

  private async getSchemaIdCached(schemaName: keyof typeof SOMNIA_CONFIG_V3.schemas): Promise<Hex> {
    await this.ensureInitialized();
    
    const schemaKey = SOMNIA_CONFIG_V3.schemas[schemaName];
    
    if (this.schemaIdCache.has(schemaKey)) {
      return this.schemaIdCache.get(schemaKey)!;
    }
    
    const schemaString = SOMNIA_CONFIG_V3.schemaStrings[schemaName];
    const computed = await this.sdk!.streams.computeSchemaId(schemaString);
    this.schemaIdCache.set(schemaKey, computed);
    
    // Only log once per schema (verbose level)
    if (!this.schemaIdCache.has(schemaKey)) {
      console.log(`🔑 [V3] Schema ID cached: ${schemaName} -> ${computed}`);
    }
    return computed;
  }

  /**
   * Get schema string by schema ID (reverse lookup)
   */
  private getSchemaStringById(schemaId: Hex): string | null {
    for (const [name, schemaString] of Object.entries(SOMNIA_CONFIG_V3.schemaStrings)) {
      // Check if this schema matches
      const schemaKey = SOMNIA_CONFIG_V3.schemas[name as keyof typeof SOMNIA_CONFIG_V3.schemas];
      if (this.schemaIdCache.get(schemaKey) === schemaId) {
        return schemaString;
      }
    }
    return null;
  }

  /**
   * Encode data for a schema dynamically
   */
  private encodeDataForSchema(encoder: SchemaEncoder, data: Record<string, any>, schemaString: string): `0x${string}` {
    // Parse schema string to get field names and types
    const fields = schemaString.split(',').map(f => {
      const parts = f.trim().split(' ');
      return { type: parts[0], name: parts[1] };
    });
    
    // Build encoded data array
    const encodedFields = fields.map(field => {
      const value = data[field.name!];
      return {
        name: field.name!,
        value: value !== undefined ? value : this.getDefaultValueForType(field.type!),
        type: field.type!
      };
    });
    
    return encoder.encodeData(encodedFields) as `0x${string}`;
  }

  /**
   * Get default value for a Solidity type
   */
  private getDefaultValueForType(type: string): any {
    if (type.startsWith('uint') || type.startsWith('int')) return 0;
    if (type === 'bool') return false;
    if (type === 'address') return '0x0000000000000000000000000000000000000000';
    if (type === 'string') return '';
    if (type.startsWith('bytes')) return '0x';
    return '';
  }

  // ===== READ OPERATIONS (ULTRA-OPTIMIZED) =====

  /**
   * Get posts using index-based pagination (FASTEST METHOD)
   * 
   * Uses getBetweenRange for O(1) pagination instead of loading all data
   * Performance: ~50-100ms for 20 posts (vs ~500ms loading all)
   */
  async getPostsPaginated(page: number = 0, pageSize: number = 20): Promise<PostDataV3[]> {
    await this.ensureInitialized();

    try {
      const startTime = Date.now();

      // ✅ MULTI-PUBLISHER: Get all known publishers
      const publishers = publisherIndexer.getAllPublishers();

      if (publishers.length === 0) {
        console.warn('⚠️ [V3] No publishers indexed, adding server publisher');
        try {
          const serverPublisher = await this.getServerPublisherAddress();
          publisherIndexer.addPublisher(serverPublisher);
          publishers.push(serverPublisher);
        } catch (error) {
          console.error('❌ [V3] Could not add server publisher:', error);
          return [];
        }
      }

      const schemaId = await this.getSchemaIdCached('posts');

      if (this.DEBUG_MODE) {
        console.log(`📚 [V3] Loading posts from ${publishers.length} publishers...`, {
          publishers: publishers.map((p) => p.slice(0, 10) + '...'),
          schemaId,
        });
      }

      // ✅ MULTI-PUBLISHER: Load posts from all publishers
      const allPostsArrays = await Promise.all(
        publishers.map(async (publisher) => {
          try {
            if (this.DEBUG_MODE) {
              console.log(`📥 [V3] Loading from publisher: ${publisher.slice(0, 10)}...`);
            }
            const posts = await this.sdk!.streams.getAllPublisherDataForSchema(
              schemaId,
              publisher as `0x${string}`
            );
            return posts || [];
          } catch (error: any) {
            // Silently handle NoData errors (expected for publishers with no data)
            if (!error?.message?.includes('NoData')) {
              console.warn(`⚠️ [V3] Failed to load from publisher ${publisher.slice(0, 10)}:`, error?.message || error);
            }
            return [];
          }
        })
      );

      // Merge all posts from all publishers
      const allData = allPostsArrays.flat();
      if (this.DEBUG_MODE) {
        console.log(`✅ [V3] Got ${allData.length} total posts from all publishers`);
      }

      // ✅ DEDUPLICATE: If same post ID exists from multiple publishers, keep the latest one
      // This handles the case where a post is created with one wallet and deleted with another
      const postMap = new Map<number, any>();
      for (const item of allData) {
        try {
          // Extract post ID to check for duplicates
          const safeExtractValue = (val: any) => {
            if (!val) return val;
            if (val.value !== undefined) {
              if (typeof val.value === 'object' && val.value.value !== undefined) {
                return val.value.value;
              }
              return val.value;
            }
            return val;
          };
          
          const postId = Number(safeExtractValue(item[0]));
          const isDeleted = Boolean(safeExtractValue(item[16]));
          
          // If post already exists, keep the one with isDeleted = true (latest state)
          if (postMap.has(postId)) {
            const existing = postMap.get(postId);
            const existingIsDeleted = Boolean(safeExtractValue(existing[16]));
            
            // Prefer deleted version over non-deleted
            if (isDeleted && !existingIsDeleted) {
              postMap.set(postId, item);
              console.log(`🔄 [V3-DEDUP] Replaced post ${postId} with deleted version`);
            }
          } else {
            postMap.set(postId, item);
          }
        } catch (error) {
          // Skip invalid items
          continue;
        }
      }
      
      const deduplicatedData = Array.from(postMap.values());
      console.log(`🔄 [V3] Deduplicated: ${allData.length} → ${deduplicatedData.length} posts`);

      // Paginate merged data
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      const rawData = deduplicatedData.slice(startIndex, endIndex);
      if (this.DEBUG_MODE) {
        console.log(`📄 [V3] Sliced to ${rawData.length} posts for page ${page}`);
      }

      if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
        console.log('📭 [V3] No posts found in range');
        return [];
      }

      // Helper function to safely extract value
      const safeExtractValue = (item: any, defaultValue: any = '') => {
        if (!item) return defaultValue;
        
        // Try nested value.value first
        if (item.value !== undefined) {
          if (typeof item.value === 'object' && item.value.value !== undefined) {
            return item.value.value;
          }
          return item.value;
        }
        
        // Direct value
        return item;
      };

      // Helper to safely convert to string
      const safeString = (value: any, defaultValue: string = ''): string => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
          console.warn('⚠️ [V3] Object detected, using default:', value);
          return defaultValue;
        }
        return String(value);
      };

      // Helper to safely convert to number
      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'object') {
          console.warn('⚠️ [V3] Object detected for number, using default:', value);
          return defaultValue;
        }
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
      };

      // Decode data - SDK returns already decoded data with nested structure
      const posts: PostDataV3[] = [];
      
      for (let idx = 0; idx < rawData.length; idx++) {
        try {
          const item = rawData[idx];
          
          // Skip empty or invalid data
          if (!item || !Array.isArray(item) || item.length === 0) {
            console.warn('⚠️ [V3] Skipping invalid post record (empty data)');
            continue;
          }

          // Access nested value.value for decoded data - V6 (18 fields)
          const id = safeNumber(safeExtractValue(item[0]));
          const timestamp = safeNumber(safeExtractValue(item[1]));
          const content = safeString(safeExtractValue(item[2]));
          const contentType = safeNumber(safeExtractValue(item[3]), 0);
          const mediaHashes = safeString(safeExtractValue(item[4])); // V6
          const author = safeString(safeExtractValue(item[5]));
          const quotedPostId = safeNumber(safeExtractValue(item[6]), 0); // V6: uint256
          const replyToId = safeNumber(safeExtractValue(item[7]), 0); // V6
          const mentions = safeString(safeExtractValue(item[8])); // V6
          const collectModule = safeString(safeExtractValue(item[9]), '0x0000000000000000000000000000000000000000'); // V6
          const collectPrice = safeNumber(safeExtractValue(item[10]), 0); // V6
          const collectLimit = safeNumber(safeExtractValue(item[11]), 0); // V6
          const collectCount = safeNumber(safeExtractValue(item[12]), 0); // V6
          const isGated = Boolean(safeExtractValue(item[13])); // V6
          const referrer = safeString(safeExtractValue(item[14]), '0x0000000000000000000000000000000000000000'); // V6
          const nftTokenId = safeNumber(safeExtractValue(item[15]), 0);
          const isDeleted = Boolean(safeExtractValue(item[16]));
          const isPinned = Boolean(safeExtractValue(item[17]));
          
          // ✅ Debug logging for deleted posts
          if (isDeleted) {
            console.log(`🗑️ [V3-DEBUG] Found deleted post:`, {
              id,
              author: author.slice(0, 10) + '...',
              content: content.substring(0, 50) + '...',
              isDeleted
            });
          }
          
          posts.push({
            id,
            index: Number(startIndex) + idx,
            timestamp,
            content,
            contentType: contentType as ContentType,
            mediaHashes,
            author,
            quotedPostId,
            replyToId,
            mentions,
            collectModule,
            collectPrice,
            collectLimit,
            collectCount,
            isGated,
            referrer,
            nftTokenId,
            isDeleted,
            isPinned,
          });
        } catch (decodeError: any) {
          console.warn('⚠️ [V3] Failed to decode post record, skipping:', decodeError.message);
          continue;
        }
      }

      // 🔍 AUTO-DISCOVER: Index new publishers from post authors
      // This ensures we discover new users who have posted
      const newPublishers: string[] = [];
      for (const post of posts) {
        if (post.author && post.author.startsWith('0x')) {
          const authorLower = post.author.toLowerCase();
          if (!publishers.includes(authorLower) && !publisherIndexer.hasPublisher(authorLower)) {
            newPublishers.push(authorLower);
            publisherIndexer.addPublisher(authorLower);
          }
        }
      }
      
      if (newPublishers.length > 0) {
        console.log(`🔍 [AUTO-DISCOVER] Found ${newPublishers.length} new publishers from post authors:`, 
          newPublishers.map(p => p.slice(0, 10) + '...'));
      }

      const loadTime = Date.now() - startTime;
      console.log(`✅ [V3] Loaded ${posts.length} posts in ${loadTime}ms (index-based)`);

      return posts;
    } catch (error: any) {
      // Handle InvalidSize error - fallback to getAllPublisherDataForSchema
      if (error?.message?.includes('InvalidSize()')) {
        console.log('⚠️ [V3] InvalidSize error, falling back to getAllPublisherDataForSchema');
        try {
          const privateKey = import.meta.env.VITE_PRIVATE_KEY;
          const publisher = privateKey ? privateKeyToAccount(privateKey as `0x${string}`).address : null;
          
          if (!publisher) {
            throw new Error('Publisher address not found');
          }

          const schemaId = await this.getSchemaIdCached('posts');
          const allData = await this.sdk!.streams.getAllPublisherDataForSchema(schemaId, publisher);
          console.log(`📊 [V3] Got ${allData?.length || 0} total posts, slicing ${page * pageSize}-${(page + 1) * pageSize}`);
          
          const slicedData = allData?.slice(page * pageSize, (page + 1) * pageSize) || [];
          
          // Helper function to safely extract value
          const safeExtractValue = (item: any, defaultValue: any = '') => {
            if (!item) return defaultValue;
            if (item.value !== undefined) {
              if (typeof item.value === 'object' && item.value.value !== undefined) {
                return item.value.value;
              }
              return item.value;
            }
            return item;
          };

          const safeString = (value: any, defaultValue: string = ''): string => {
            if (value === null || value === undefined) return defaultValue;
            if (typeof value === 'string') return value;
            if (typeof value === 'object') return defaultValue;
            return String(value);
          };

          const safeNumber = (value: any, defaultValue: number = 0): number => {
            if (value === null || value === undefined) return defaultValue;
            if (typeof value === 'number') return value;
            if (typeof value === 'bigint') return Number(value);
            if (typeof value === 'object') return defaultValue;
            const num = Number(value);
            return isNaN(num) ? defaultValue : num;
          };
          
          // Decode data - V6 (18 fields)
          const posts: PostDataV3[] = slicedData.map((item: any, idx: number) => {
            const id = safeNumber(safeExtractValue(item[0]));
            const timestamp = safeNumber(safeExtractValue(item[1]));
            const content = safeString(safeExtractValue(item[2]));
            const contentType = safeNumber(safeExtractValue(item[3]), 0);
            const mediaHashes = safeString(safeExtractValue(item[4]));
            const author = safeString(safeExtractValue(item[5]));
            const quotedPostId = safeNumber(safeExtractValue(item[6]), 0);
            const replyToId = safeNumber(safeExtractValue(item[7]), 0);
            const mentions = safeString(safeExtractValue(item[8]));
            const collectModule = safeString(safeExtractValue(item[9]), '0x0000000000000000000000000000000000000000');
            const collectPrice = safeNumber(safeExtractValue(item[10]), 0);
            const collectLimit = safeNumber(safeExtractValue(item[11]), 0);
            const collectCount = safeNumber(safeExtractValue(item[12]), 0);
            const isGated = Boolean(safeExtractValue(item[13]));
            const referrer = safeString(safeExtractValue(item[14]), '0x0000000000000000000000000000000000000000');
            const nftTokenId = safeNumber(safeExtractValue(item[15]), 0);
            const isDeleted = Boolean(safeExtractValue(item[16]));
            const isPinned = Boolean(safeExtractValue(item[17]));
            
            // ✅ Debug logging for deleted posts (fallback method)
            if (isDeleted) {
              console.log(`🗑️ [V3-DEBUG-FALLBACK] Found deleted post:`, {
                id,
                author: author.slice(0, 10) + '...',
                content: content.substring(0, 50) + '...',
                isDeleted
              });
            }
            
            return {
              id,
              index: page * pageSize + idx,
              timestamp,
              content,
              contentType: contentType as ContentType,
              mediaHashes,
              author,
              quotedPostId,
              replyToId,
              mentions,
              collectModule,
              collectPrice,
              collectLimit,
              collectCount,
              isGated,
              referrer,
              nftTokenId,
              isDeleted,
              isPinned,
            };
          });
          
          console.log(`✅ [V3] Loaded ${posts.length} posts using fallback method`);
          return posts;
        } catch (fallbackError) {
          console.error('❌ [V3] Fallback also failed:', fallbackError);
          return [];
        }
      }
      
      console.error('❌ [V3] Failed to load posts:', error);
      return [];
    }
  }

  /**
   * Get all posts (fallback method, use getPostsPaginated instead)
   */
  async getAllPosts(limit?: number, offset = 0): Promise<PostDataV3[]> {
    const cacheKey = 'all_posts';
    
    // Check cache
    const cached = this.dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('⚡ [V3] Using cached posts');
      const posts = cached.data as PostDataV3[];
      return limit ? posts.slice(offset, offset + limit) : posts;
    }
    
    // Deduplicate requests
    if (this.pendingRequests.has(cacheKey)) {
      // console.log('⚡ [V3] Reusing in-flight request');
      return this.pendingRequests.get(cacheKey)!;
    }
    
    const promise = this._getAllPostsInternal();
    this.pendingRequests.set(cacheKey, promise);
    
    try {
      const posts = await promise;
      
      // Cache result
      this.dataCache.set(cacheKey, { data: posts, timestamp: Date.now() });
      
      return limit ? posts.slice(offset, offset + limit) : posts;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async _getAllPostsInternal(): Promise<PostDataV3[]> {
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    try {
      const startTime = Date.now();
      console.log('📚 [V3] Loading all posts...');

      // ✅ MULTI-PUBLISHER: Get all known publishers
      const publishers = publisherIndexer.getAllPublishers();

      if (publishers.length === 0) {
        console.warn('⚠️ [V3] No publishers indexed for posts, adding server publisher');
        try {
          const serverPublisher = await this.getServerPublisherAddress();
          publisherIndexer.addPublisher(serverPublisher);
          publishers.push(serverPublisher);
        } catch (error) {
          console.error('❌ [V3] Could not add server publisher:', error);
          return [];
        }
      }

      const schemaId = await this.getSchemaIdCached('posts');

      if (this.DEBUG_MODE) {
        console.log(`📚 [V3] Loading posts from ${publishers.length} publishers...`, {
          publishers: publishers.map((p) => p.slice(0, 10) + '...'),
          schemaId,
        });
      }

      // ✅ MULTI-PUBLISHER: Load posts from all publishers
      const allPostsArrays = await Promise.all(
        publishers.map(async (publisher) => {
          try {
            if (this.DEBUG_MODE) {
              console.log(`📥 [V3] Loading posts from publisher: ${publisher.slice(0, 10)}...`);
            }
            const posts = await this.sdk!.streams.getAllPublisherDataForSchema(
              schemaId,
              publisher as `0x${string}`
            );
            return posts || [];
          } catch (error: any) {
            // Silently handle NoData errors (expected for publishers with no data)
            if (!error?.message?.includes('NoData')) {
              console.warn(`⚠️ [V3] Failed to load posts from publisher ${publisher.slice(0, 10)}:`, error?.message || error);
            }
            return [];
          }
        })
      );

      // Merge all posts from all publishers
      const rawData = allPostsArrays.flat();
      if (this.DEBUG_MODE) {
        console.log(`✅ [V3] Got ${rawData.length} total posts from all publishers`);
      }

      if (!rawData || rawData.length === 0) {
        console.log('📭 [V3] No posts found');
        return [];
      }

      // Helper functions for safe extraction
      const safeExtractValue = (item: any, defaultValue: any = '') => {
        if (!item) return defaultValue;
        if (item.value !== undefined) {
          if (typeof item.value === 'object' && item.value.value !== undefined) {
            return item.value.value;
          }
          return item.value;
        }
        return item;
      };

      const safeString = (value: any, defaultValue: string = ''): string => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return defaultValue;
        return String(value);
      };

      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'object') return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
      };

      // Decode data - SDK returns already decoded data with nested structure - V6 (18 fields)
      const posts: PostDataV3[] = rawData.map((item: any, idx: number) => {
        const id = safeNumber(safeExtractValue(item[0]));
        const timestamp = safeNumber(safeExtractValue(item[1]));
        const content = safeString(safeExtractValue(item[2]));
        const contentType = safeNumber(safeExtractValue(item[3]), 0);
        const mediaHashes = safeString(safeExtractValue(item[4]));
        const author = safeString(safeExtractValue(item[5]));
        const quotedPostId = safeNumber(safeExtractValue(item[6]), 0);
        const replyToId = safeNumber(safeExtractValue(item[7]), 0);
        const mentions = safeString(safeExtractValue(item[8]));
        const collectModule = safeString(safeExtractValue(item[9]), '0x0000000000000000000000000000000000000000');
        const collectPrice = safeNumber(safeExtractValue(item[10]), 0);
        const collectLimit = safeNumber(safeExtractValue(item[11]), 0);
        const collectCount = safeNumber(safeExtractValue(item[12]), 0);
        const isGated = Boolean(safeExtractValue(item[13]));
        const referrer = safeString(safeExtractValue(item[14]), '0x0000000000000000000000000000000000000000');
        const nftTokenId = safeNumber(safeExtractValue(item[15]), 0);
        const isDeleted = Boolean(safeExtractValue(item[16]));
        const isPinned = Boolean(safeExtractValue(item[17]));
        
        return {
          id,
          index: idx,
          timestamp,
          content,
          contentType: contentType as ContentType,
          mediaHashes,
          author,
          quotedPostId,
          replyToId,
          mentions,
          collectModule,
          collectPrice,
          collectLimit,
          collectCount,
          isGated,
          referrer,
          nftTokenId,
          isDeleted,
          isPinned,
        };
      });

      // Sort by timestamp (newest first)
      posts.sort((a, b) => b.timestamp - a.timestamp);

      const loadTime = Date.now() - startTime;
      console.log(`✅ [V3] Loaded ${posts.length} posts in ${loadTime}ms`);

      return posts;
    } catch (error: any) {
      if (error?.message?.includes('NoData()')) {
        console.log('📭 [V3] No posts found (NoData)');
        return [];
      }
      console.error('❌ [V3] Failed to load posts:', error);
      throw error;
    }
  }

  /**
   * Get all interactions (with optional filtering)
   */
  async getAllInteractions(targetIds?: string[]): Promise<InteractionDataV3[]> {
    const cacheKey = targetIds ? `interactions_${targetIds.join(',')}` : 'all_interactions';
    
    // Check cache (PENTING: Jangan gunakan cache untuk all_interactions agar selalu fresh dari blockchain)
    const cached = this.dataCache.get(cacheKey);
    const shouldUseCache = targetIds && targetIds.length > 0; // Only cache filtered interactions
    
    if (shouldUseCache && cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('⚡ [V3] Using cached interactions');
      return cached.data as InteractionDataV3[];
    }
    
    // Deduplicate requests
    if (this.pendingRequests.has(cacheKey)) {
      // console.log('⚡ [V3] Reusing in-flight request');
      return this.pendingRequests.get(cacheKey)!;
    }
    
    const promise = this._getAllInteractionsInternal(targetIds);
    this.pendingRequests.set(cacheKey, promise);
    
    try {
      const interactions = await promise;
      
      // Cache result (only if filtered)
      if (shouldUseCache) {
        this.dataCache.set(cacheKey, { data: interactions, timestamp: Date.now() });
      }
      
      return interactions;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async _getAllInteractionsInternal(targetIds?: string[]): Promise<InteractionDataV3[]> {
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    try {
      const startTime = Date.now();
      // console.log('📚 [V3] Loading interactions...');

      // ✅ MULTI-PUBLISHER: Get all known publishers
      const publishers = publisherIndexer.getAllPublishers();

      if (publishers.length === 0) {
        console.warn('⚠️ [V3] No publishers indexed for interactions, adding server publisher');
        try {
          const serverPublisher = await this.getServerPublisherAddress();
          publisherIndexer.addPublisher(serverPublisher);
          publishers.push(serverPublisher);
        } catch (error) {
          console.error('❌ [V3] Could not add server publisher:', error);
          return [];
        }
      }

      const schemaId = await this.getSchemaIdCached('interactions');

      if (this.DEBUG_MODE) {
        console.log(`📚 [V3] Loading interactions from ${publishers.length} publishers...`, {
          publishers: publishers.map((p) => p.slice(0, 10) + '...'),
          schemaId,
        });
      }

      // ✅ MULTI-PUBLISHER: Load interactions from all publishers
      const allInteractionsArrays = await Promise.all(
        publishers.map(async (publisher) => {
          try {
            if (this.DEBUG_MODE) {
              console.log(`📥 [V3] Loading interactions from publisher: ${publisher.slice(0, 10)}...`);
            }
            const interactions = await this.sdk!.streams.getAllPublisherDataForSchema(
              schemaId,
              publisher as `0x${string}`
            );
            return interactions || [];
          } catch (error: any) {
            // Silently handle NoData errors (expected for publishers with no data)
            if (!error?.message?.includes('NoData')) {
              console.warn(`⚠️ [V3] Failed to load interactions from publisher ${publisher.slice(0, 10)}:`, error?.message || error);
            }
            return [];
          }
        })
      );

      // Merge all interactions from all publishers
      const rawData = allInteractionsArrays.flat();
      if (this.DEBUG_MODE) {
        console.log(`✅ [V3] Got ${rawData.length} total interactions from all publishers`);
      }

      if (!rawData || rawData.length === 0) {
        console.log('📭 [V3] No interactions found');
        return [];
      }

      // Helper function to safely extract value
      const safeExtractValue = (item: any, defaultValue: any = '') => {
        if (!item) return defaultValue;
        if (item.value !== undefined) {
          if (typeof item.value === 'object' && item.value.value !== undefined) {
            return item.value.value;
          }
          return item.value;
        }
        return item;
      };

      const safeString = (value: any, defaultValue: string = ''): string => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return defaultValue;
        return String(value);
      };

      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'object') return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
      };

      // Decode data with error handling for invalid records
      // SDK returns already decoded data with nested structure (like posts)
      let interactions: InteractionDataV3[] = [];
      
      for (const item of rawData) {
        try {
          // Skip empty or invalid data
          if (!item || !Array.isArray(item) || item.length === 0) {
            console.warn('⚠️ [V3] Skipping invalid interaction record (empty data)');
            continue;
          }

          // Access nested value.value for decoded data V6 (9 fields)
          const id = safeNumber(safeExtractValue(item[0]));
          const timestamp = safeNumber(safeExtractValue(item[1]));
          const interactionType = safeNumber(safeExtractValue(item[2]), 0);
          const targetId = safeNumber(safeExtractValue(item[3]), 0); // V6: uint256
          const targetType = safeNumber(safeExtractValue(item[4]), 0);
          const fromUser = safeString(safeExtractValue(item[5]));
          const content = safeString(safeExtractValue(item[6]));
          const parentId = safeNumber(safeExtractValue(item[7]), 0); // V6: uint256
          const tipAmount = safeNumber(safeExtractValue(item[8]), 0); // V6: Tipping
          
          // Debug log untuk interaction pertama
          // if (interactions.length === 0) {
          //   console.log('🔍 [V3] First interaction decoded:', {
          //     decoded: {
          //       timestamp,
          //       interactionType: InteractionType[interactionType],
          //       targetId,
          //       targetType: TargetType[targetType],
          //       fromUser: fromUser.substring(0, 10) + '...',
          //       content: content.substring(0, 30),
          //       parentId
          //     }
          //   });
          // }
          
          interactions.push({
            id,
            timestamp,
            interactionType: interactionType as InteractionType,
            targetId,
            targetType: targetType as TargetType,
            fromUser,
            content,
            parentId,
            tipAmount, // V6
          });
        } catch (decodeError: any) {
          console.warn('⚠️ [V3] Failed to decode interaction record, skipping:', decodeError.message);
          continue;
        }
      }

      // Filter by targetIds if provided (convert to number for comparison)
      if (targetIds && targetIds.length > 0) {
        const targetIdsNum = targetIds.map(id => typeof id === 'string' ? parseInt(id) : id);
        interactions = interactions.filter(i => targetIdsNum.includes(i.targetId));
      }

      // 🔍 AUTO-DISCOVER: Index new publishers from interaction authors
      // This ensures we discover new users who have interacted
      const newPublishers: string[] = [];
      for (const interaction of interactions) {
        if (interaction.fromUser && interaction.fromUser.startsWith('0x')) {
          const userLower = interaction.fromUser.toLowerCase();
          if (!publishers.includes(userLower) && !publisherIndexer.hasPublisher(userLower)) {
            newPublishers.push(userLower);
            publisherIndexer.addPublisher(userLower);
          }
        }
      }
      
      if (newPublishers.length > 0) {
        console.log(`🔍 [AUTO-DISCOVER] Found ${newPublishers.length} new publishers from interactions:`, 
          newPublishers.map(p => p.slice(0, 10) + '...'));
      }

      const loadTime = Date.now() - startTime;
      // console.log(`✅ [V3] Loaded ${interactions.length} interactions in ${loadTime}ms`);

      return interactions;
    } catch (error: any) {
      if (error?.message?.includes('NoData()')) {
        console.log('📭 [V3] No interactions found (NoData)');
        return [];
      }
      console.error('❌ [V3] Failed to load interactions:', error);
      throw error;
    }
  }

  // ===== WRITE OPERATIONS (BATCH-OPTIMIZED) =====

  private writeBatch: Array<{ schemaId: Hex; id: Hex; data: Hex }> = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  
  // ===== LIKE BATCH PROCESSING (MULTI-PUBLISHER) =====
  private likeBatch: Array<{ 
    schemaId: Hex; 
    id: Hex; 
    data: Hex;
    interactionData: Partial<InteractionDataV3>;
    userWalletClient?: any;
    publisherAddress: string;
  }> = [];
  private likeBatchTimeout: NodeJS.Timeout | null = null;
  private readonly LIKE_BATCH_SIZE = 50;
  private readonly LIKE_BATCH_DELAY = 2000; // 2 seconds delay to collect more likes

  // ===== BOOKMARK BATCH PROCESSING (MULTI-PUBLISHER) =====
  private bookmarkBatch: Array<{ 
    schemaId: Hex; 
    id: Hex; 
    data: Hex;
    interactionData: Partial<InteractionDataV3>;
    userWalletClient?: any;
    publisherAddress: string;
  }> = [];
  private bookmarkBatchTimeout: NodeJS.Timeout | null = null;
  private readonly BOOKMARK_BATCH_SIZE = 50;
  private readonly BOOKMARK_BATCH_DELAY = 2000; // 2 seconds delay to collect more bookmarks

  // ===== UNIFIED BATCH PROCESSING (ALL INTERACTIONS) =====
  private unifiedBatch: Array<{ 
    schemaId: Hex; 
    id: Hex; 
    data: Hex;
    interactionData: Partial<InteractionDataV3>;
    userWalletClient?: any;
    publisherAddress: string;
  }> = [];
  private unifiedBatchTimeout: NodeJS.Timeout | null = null;
  private readonly UNIFIED_BATCH_SIZE = 100;
  private readonly UNIFIED_BATCH_DELAY = 2000; // 2 seconds delay to collect all interactions

  // ===== REPOST BATCH PROCESSING (MULTI-PUBLISHER) =====
  private repostBatch: Array<{ 
    schemaId: Hex; 
    id: Hex; 
    data: Hex;
    interactionData: Partial<InteractionDataV3>;
    userWalletClient?: any;
    publisherAddress: string;
  }> = [];
  private repostBatchTimeout: NodeJS.Timeout | null = null;
  private readonly REPOST_BATCH_SIZE = 50;
  private readonly REPOST_BATCH_DELAY = 2000; // 2 seconds delay to collect more reposts

  /**
   * Flush batch writes to blockchain
   * 
   * Combines multiple writes into single transaction for efficiency
   */
  private async flushBatch(): Promise<string[]> {
    if (this.writeBatch.length === 0) return [];
    
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    // Use transaction queue to prevent nonce conflicts
    return transactionQueue.enqueue(async () => {
      const batch = [...this.writeBatch];
      this.writeBatch = [];
      
      console.log(`📦 [V3] Flushing batch of ${batch.length} writes...`);
      const startTime = Date.now();

      // 📊 LOG: Batch flush start with detailed batch info
      const { interactionLogger } = await import('@/utils/interactionLogger');
      // ✅ FIX: Use SERVER wallet type for general batch (uses server wallet)
      const logId = interactionLogger.logStart('BATCH_FLUSH_PLAY', 'SERVER', {
        content: `Batch flush: ${batch.length} items`,
        batchSize: batch.length,
        rawData: {
          batchItems: batch.map(item => ({
            schemaId: item.schemaId,
            id: item.id,
            dataSize: item.data.length
          }))
        }
      });

      try {
        // ⚡ Single transaction for all writes
        const txHash = await this.sdk!.streams.set(batch);

        const flushTime = Date.now() - startTime;
        console.log(`✅ [V3] Batch flushed in ${flushTime}ms:`, txHash);

        // 📊 LOG: Batch flush success with detailed info
        // ✅ FIX: Use actual server publisher address (not BATCH_SYSTEM)
        const serverPublisher = await this.getServerPublisherAddress();
        interactionLogger.logSuccess(logId, txHash!, serverPublisher, {
          batchSize: batch.length,
          duration: flushTime,
          txHash: txHash,
          schemaIds: [...new Set(batch.map(b => b.schemaId))], // Unique schema IDs
          itemIds: batch.map(b => b.id).slice(0, 10) // First 10 IDs
        });

        // Invalidate caches
        this.dataCache.clear();

        return [txHash];
      } catch (error) {
        // 📊 LOG: Batch flush failure
        interactionLogger.logFailure(logId, error as Error);
        throw error;
      }
    });
  }

  /**
   * Add write to batch (auto-flushes after delay)
   */
  private addToBatch(schemaId: Hex, id: Hex, data: Hex): void {
    this.writeBatch.push({ schemaId, id, data });

    // Auto-flush after delay or when batch is full
    if (this.writeBatch.length >= SOMNIA_CONFIG_V3.performance.batchSize) {
      this.flushBatch();
    } else {
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }
      this.batchTimeout = setTimeout(() => {
        this.flushBatch();
      }, SOMNIA_CONFIG_V3.performance.batchDelay);
    }
  }

  /**
   * Flush like batch to blockchain (MULTI-PUBLISHER)
   * Groups by publisher and flushes each publisher's batch separately
   */
  private async flushLikeBatch(): Promise<void> {
    console.log(`❤️ [V3-LIKE-BATCH] flushLikeBatch() called. Batch size: ${this.likeBatch.length}`);
    
    // ✅ Clear timeout to prevent duplicate flush calls
    if (this.likeBatchTimeout) {
      clearTimeout(this.likeBatchTimeout);
      this.likeBatchTimeout = null;
    }
    
    if (this.likeBatch.length === 0) {
      console.log(`❤️ [V3-LIKE-BATCH] Batch empty, skipping flush`);
      return;
    }
    
    if (!this.sdk) {
      console.error('❌ [V3-LIKE-BATCH] SDK not initialized!');
      throw new Error('SDK not initialized');
    }

    // ✅ MULTI-PUBLISHER: Group batch by publisher
    const batch = [...this.likeBatch];
    this.likeBatch = [];
    
    console.log(`❤️ [V3-LIKE-BATCH] Flushing ${batch.length} like interactions...`);
    const startTime = Date.now();

    // Group by publisher address
    const batchesByPublisher = new Map<string, typeof batch>();
    batch.forEach(item => {
      const publisher = item.publisherAddress.toLowerCase();
      if (!batchesByPublisher.has(publisher)) {
        batchesByPublisher.set(publisher, []);
      }
      batchesByPublisher.get(publisher)!.push(item);
    });

    console.log(`❤️ [V3-LIKE-BATCH] Grouped into ${batchesByPublisher.size} publisher(s)`);

    // 📊 LOG: Like batch flush start
    // ✅ FIX: Use USER wallet type for multi-publisher batch (not BATCH)
    const logId = interactionLogger.logStart('BATCH_FLUSH_LIKE', 'USER', {
      content: `Like batch flush: ${batch.length} interactions from ${batchesByPublisher.size} publisher(s)`,
      batchSize: batch.length,
      rawData: {
        publisherCount: batchesByPublisher.size,
        interactions: batch.map(item => ({
          id: item.interactionData.id,
          timestamp: item.interactionData.timestamp,
          interactionType: item.interactionData.interactionType,
          interactionTypeName: InteractionType[item.interactionData.interactionType!],
          targetId: item.interactionData.targetId,
          targetType: item.interactionData.targetType,
          fromUser: item.interactionData.fromUser,
          publisherAddress: item.publisherAddress,
          schemaId: item.schemaId,
          idHex: item.id,
          encodedData: item.data,
        }))
      }
    });

    try {
      // ⚡ Flush each publisher's batch (parallel execution, safe because different wallets)
      const flushPromises = Array.from(batchesByPublisher.entries()).map(
        async ([publisher, items]) => {
          console.log(`❤️ [V3-LIKE-BATCH] Flushing ${items.length} likes for publisher ${publisher.substring(0, 10)}...`);
          
          // ✅ MULTI-PUBLISHER: Must have user wallet
          if (!items[0]?.userWalletClient) {
            console.error(`❌ [V3-LIKE-BATCH] No user wallet for publisher ${publisher}`);
            throw new Error(`Multi-publisher batch requires user wallet for ${publisher}`);
          }
          
          const sdk = new SDK({ 
            public: this.publicClient, 
            wallet: items[0].userWalletClient! 
          });

          const batchData = items.map(item => ({
            schemaId: item.schemaId,
            id: item.id,
            data: item.data
          }));

          // Single transaction for all likes from this publisher
          const txHash = await sdk.streams.set(batchData);
          
          console.log(`✅ [V3-LIKE-BATCH] Publisher ${publisher.substring(0, 10)} flushed: ${txHash}`);
          
          // ✅ Index publisher
          publisherIndexer.addPublisher(publisher);
          
          return { publisher, txHash, count: items.length };
        }
      );

      const results = await Promise.all(flushPromises);

      const flushTime = Date.now() - startTime;
      console.log(`✅ [V3-LIKE-BATCH] All publishers flushed in ${flushTime}ms`);

      // 📊 LOG: Like batch flush success
      // ✅ FIX: Use actual user's publisher address (not BATCH_SYSTEM)
      const primaryTxHash = results[0]?.txHash || 'MULTI_PUBLISHER_BATCH';
      const primaryPublisher = results[0]?.publisher || batch[0]?.publisherAddress || 'UNKNOWN';
      
      interactionLogger.logSuccess(logId, primaryTxHash, primaryPublisher, {
        batchSize: batch.length,
        duration: flushTime,
        txHash: primaryTxHash,
        publisherAddress: primaryPublisher,
        rawData: {
          publisherCount: batchesByPublisher.size,
          // All transaction hashes from all publishers
          allTxHashes: results.map(r => ({ publisher: r.publisher, txHash: r.txHash, count: r.count })),
          results: results,
          interactionIds: batch.map(b => b.interactionData.id),
          interactionTypes: batch.map(b => InteractionType[b.interactionData.interactionType!]),
        },
        interactions: batch.map(item => ({
          id: item.interactionData.id,
          timestamp: item.interactionData.timestamp,
          interactionType: item.interactionData.interactionType,
          interactionTypeName: InteractionType[item.interactionData.interactionType!],
          targetId: item.interactionData.targetId,
          targetType: item.interactionData.targetType,
          fromUser: item.interactionData.fromUser,
          publisherAddress: item.publisherAddress,
          schemaId: item.schemaId,
          idHex: item.id,
          encodedData: item.data,
        }))
      });

      // ✅ Clear interaction cache to force fresh read
      this.dataCache.delete('all_interactions');
      
      // Small delay to allow blockchain to propagate
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('❌ [V3-LIKE-BATCH] Failed to flush like batch:', error);
      
      // 📊 LOG: Like batch flush failure
      interactionLogger.logFailure(logId, error as Error);
      
      throw error;
    }
  }

  /**
   * Add like interaction to batch (MULTI-PUBLISHER)
   */
  private addToLikeBatch(
    schemaId: Hex, 
    id: Hex, 
    data: Hex,
    interactionData: Partial<InteractionDataV3>,
    userWalletClient?: any,
    publisherAddress?: string
  ): void {
    // Use fromUser as publisher if not explicitly provided
    const publisher = publisherAddress || interactionData.fromUser!;
    
    this.likeBatch.push({ 
      schemaId, 
      id, 
      data, 
      interactionData,
      userWalletClient,
      publisherAddress: publisher
    });
    
    console.log(`❤️ [V3-LIKE-BATCH] Added to batch. Current size: ${this.likeBatch.length}/${this.LIKE_BATCH_SIZE} (publisher: ${publisher.substring(0, 10)}...)`);

    // Auto-flush after delay or when batch is full
    if (this.likeBatch.length >= this.LIKE_BATCH_SIZE) {
      console.log(`❤️ [V3-LIKE-BATCH] Batch full (${this.likeBatch.length}), flushing immediately...`);
      this.flushLikeBatch();
    } else {
      if (this.likeBatchTimeout) {
        clearTimeout(this.likeBatchTimeout);
      }
      console.log(`❤️ [V3-LIKE-BATCH] Setting timeout to flush in ${this.LIKE_BATCH_DELAY}ms...`);
      this.likeBatchTimeout = setTimeout(() => {
        console.log(`❤️ [V3-LIKE-BATCH] Timeout triggered, flushing ${this.likeBatch.length} likes...`);
        this.flushLikeBatch();
      }, this.LIKE_BATCH_DELAY);
    }
  }

  /**
   * Flush bookmark batch to blockchain (MULTI-PUBLISHER)
   * Groups by publisher and flushes each publisher's batch separately
   */
  private async flushBookmarkBatch(): Promise<void> {
    console.log(`🔖 [V3-BOOKMARK-BATCH] flushBookmarkBatch() called. Batch size: ${this.bookmarkBatch.length}`);
    
    // ✅ Clear timeout to prevent duplicate flush calls
    if (this.bookmarkBatchTimeout) {
      clearTimeout(this.bookmarkBatchTimeout);
      this.bookmarkBatchTimeout = null;
    }
    
    if (this.bookmarkBatch.length === 0) {
      console.log(`🔖 [V3-BOOKMARK-BATCH] Batch empty, skipping flush`);
      return;
    }
    
    if (!this.sdk) {
      console.error('❌ [V3-BOOKMARK-BATCH] SDK not initialized!');
      throw new Error('SDK not initialized');
    }

    // ✅ MULTI-PUBLISHER: Group batch by publisher
    const batch = [...this.bookmarkBatch];
    this.bookmarkBatch = [];
    
    console.log(`🔖 [V3-BOOKMARK-BATCH] Flushing ${batch.length} bookmark interactions...`);
    const startTime = Date.now();

    // Group by publisher address
    const batchesByPublisher = new Map<string, typeof batch>();
    batch.forEach(item => {
      const publisher = item.publisherAddress.toLowerCase();
      if (!batchesByPublisher.has(publisher)) {
        batchesByPublisher.set(publisher, []);
      }
      batchesByPublisher.get(publisher)!.push(item);
    });

    console.log(`🔖 [V3-BOOKMARK-BATCH] Grouped into ${batchesByPublisher.size} publisher(s)`);

    // 📊 LOG: Bookmark batch flush start
    const logId = interactionLogger.logStart('BATCH_FLUSH_BOOKMARK', 'USER', {
      content: `Bookmark batch flush: ${batch.length} interactions from ${batchesByPublisher.size} publisher(s)`,
      batchSize: batch.length,
      rawData: {
        publisherCount: batchesByPublisher.size,
        interactions: batch.map(item => ({
          id: item.interactionData.id,
          timestamp: item.interactionData.timestamp,
          interactionType: item.interactionData.interactionType,
          interactionTypeName: InteractionType[item.interactionData.interactionType!],
          targetId: item.interactionData.targetId,
          targetType: item.interactionData.targetType,
          fromUser: item.interactionData.fromUser,
          publisherAddress: item.publisherAddress,
          schemaId: item.schemaId,
          idHex: item.id,
          encodedData: item.data,
        }))
      }
    });

    try {
      // ⚡ Flush each publisher's batch (parallel execution, safe because different wallets)
      const flushPromises = Array.from(batchesByPublisher.entries()).map(
        async ([publisher, items]) => {
          console.log(`🔖 [V3-BOOKMARK-BATCH] Flushing ${items.length} bookmarks for publisher ${publisher.substring(0, 10)}...`);
          
          // ✅ MULTI-PUBLISHER: Must have user wallet
          if (!items[0]?.userWalletClient) {
            console.error(`❌ [V3-BOOKMARK-BATCH] No user wallet for publisher ${publisher}`);
            throw new Error(`Multi-publisher batch requires user wallet for ${publisher}`);
          }
          
          const sdk = new SDK({ 
            public: this.publicClient, 
            wallet: items[0].userWalletClient! 
          });

          const batchData = items.map(item => ({
            schemaId: item.schemaId,
            id: item.id,
            data: item.data
          }));

          // Single transaction for all bookmarks from this publisher
          const txHash = await sdk.streams.set(batchData);
          
          console.log(`✅ [V3-BOOKMARK-BATCH] Publisher ${publisher.substring(0, 10)} flushed: ${txHash}`);
          
          // ✅ Index publisher
          publisherIndexer.addPublisher(publisher);
          
          return { publisher, txHash, count: items.length };
        }
      );

      const results = await Promise.all(flushPromises);

      const flushTime = Date.now() - startTime;
      console.log(`✅ [V3-BOOKMARK-BATCH] All publishers flushed in ${flushTime}ms`);

      // 📊 LOG: Bookmark batch flush success
      const primaryTxHash = results[0]?.txHash || 'MULTI_PUBLISHER_BATCH';
      const primaryPublisher = results[0]?.publisher || batch[0]?.publisherAddress || 'UNKNOWN';
      
      interactionLogger.logSuccess(logId, primaryTxHash, primaryPublisher, {
        batchSize: batch.length,
        duration: flushTime,
        txHash: primaryTxHash,
        publisherAddress: primaryPublisher,
        rawData: {
          publisherCount: batchesByPublisher.size,
          allTxHashes: results.map(r => ({ publisher: r.publisher, txHash: r.txHash, count: r.count })),
          results: results,
          interactionIds: batch.map(b => b.interactionData.id),
          interactionTypes: batch.map(b => InteractionType[b.interactionData.interactionType!]),
        },
        interactions: batch.map(item => ({
          id: item.interactionData.id,
          timestamp: item.interactionData.timestamp,
          interactionType: item.interactionData.interactionType,
          interactionTypeName: InteractionType[item.interactionData.interactionType!],
          targetId: item.interactionData.targetId,
          targetType: item.interactionData.targetType,
          fromUser: item.interactionData.fromUser,
          publisherAddress: item.publisherAddress,
          schemaId: item.schemaId,
          idHex: item.id,
          encodedData: item.data,
        }))
      });

      // ✅ Clear interaction cache to force fresh read
      this.dataCache.delete('all_interactions');
      
      // Small delay to allow blockchain to propagate
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('❌ [V3-BOOKMARK-BATCH] Failed to flush bookmark batch:', error);
      
      // 📊 LOG: Bookmark batch flush failure
      interactionLogger.logFailure(logId, error as Error);
      
      throw error;
    }
  }

  /**
   * Add bookmark interaction to batch (MULTI-PUBLISHER)
   */
  private addToBookmarkBatch(
    schemaId: Hex, 
    id: Hex, 
    data: Hex,
    interactionData: Partial<InteractionDataV3>,
    userWalletClient?: any,
    publisherAddress?: string
  ): void {
    // Use fromUser as publisher if not explicitly provided
    const publisher = publisherAddress || interactionData.fromUser!;
    
    this.bookmarkBatch.push({ 
      schemaId, 
      id, 
      data, 
      interactionData,
      userWalletClient,
      publisherAddress: publisher
    });
    
    console.log(`🔖 [V3-BOOKMARK-BATCH] Added to batch. Current size: ${this.bookmarkBatch.length}/${this.BOOKMARK_BATCH_SIZE} (publisher: ${publisher.substring(0, 10)}...)`);

    // Auto-flush after delay or when batch is full
    if (this.bookmarkBatch.length >= this.BOOKMARK_BATCH_SIZE) {
      console.log(`🔖 [V3-BOOKMARK-BATCH] Batch full (${this.bookmarkBatch.length}), flushing immediately...`);
      this.flushBookmarkBatch();
    } else {
      if (this.bookmarkBatchTimeout) {
        clearTimeout(this.bookmarkBatchTimeout);
      }
      console.log(`🔖 [V3-BOOKMARK-BATCH] Setting timeout to flush in ${this.BOOKMARK_BATCH_DELAY}ms...`);
      this.bookmarkBatchTimeout = setTimeout(() => {
        console.log(`🔖 [V3-BOOKMARK-BATCH] Timeout triggered, flushing ${this.bookmarkBatch.length} bookmarks...`);
        this.flushBookmarkBatch();
      }, this.BOOKMARK_BATCH_DELAY);
    }
  }

  // ===== REPOST BATCH PROCESSING (MULTI-PUBLISHER) =====
  
  /**
   * Flush repost batch to blockchain (MULTI-PUBLISHER)
   * Groups by publisher and flushes each publisher's batch separately
   */
  private async flushRepostBatch(): Promise<void> {
    console.log(`🔄 [V3-REPOST-BATCH] flushRepostBatch() called. Batch size: ${this.repostBatch.length}`);
    
    // ✅ Clear timeout to prevent duplicate flush calls
    if (this.repostBatchTimeout) {
      clearTimeout(this.repostBatchTimeout);
      this.repostBatchTimeout = null;
    }
    
    if (this.repostBatch.length === 0) {
      console.log(`🔄 [V3-REPOST-BATCH] Batch empty, skipping flush`);
      return;
    }
    
    if (!this.sdk) {
      console.error('❌ [V3-REPOST-BATCH] SDK not initialized!');
      throw new Error('SDK not initialized');
    }

    // ✅ MULTI-PUBLISHER: Group batch by publisher
    const batch = [...this.repostBatch];
    this.repostBatch = [];
    
    console.log(`🔄 [V3-REPOST-BATCH] Flushing ${batch.length} repost interactions...`);
    const startTime = Date.now();

    // Group by publisher address
    const batchesByPublisher = new Map<string, typeof batch>();
    batch.forEach(item => {
      const publisher = item.publisherAddress.toLowerCase();
      if (!batchesByPublisher.has(publisher)) {
        batchesByPublisher.set(publisher, []);
      }
      batchesByPublisher.get(publisher)!.push(item);
    });

    console.log(`🔄 [V3-REPOST-BATCH] Grouped into ${batchesByPublisher.size} publisher(s)`);

    // 📊 LOG: Repost batch flush start
    // ✅ FIX: Use USER wallet type for multi-publisher batch (not BATCH)
    const logId = interactionLogger.logStart('BATCH_FLUSH_REPOST', 'USER', {
      content: `Repost batch flush: ${batch.length} interactions from ${batchesByPublisher.size} publisher(s)`,
      batchSize: batch.length,
      rawData: {
        publisherCount: batchesByPublisher.size,
        interactions: batch.map(item => ({
          id: item.interactionData.id,
          timestamp: item.interactionData.timestamp,
          interactionType: item.interactionData.interactionType,
          interactionTypeName: InteractionType[item.interactionData.interactionType!],
          targetId: item.interactionData.targetId,
          targetType: item.interactionData.targetType,
          fromUser: item.interactionData.fromUser,
          publisherAddress: item.publisherAddress,
          schemaId: item.schemaId,
          idHex: item.id,
          encodedData: item.data,
        }))
      }
    });

    try {
      // ⚡ Flush each publisher's batch (parallel execution, safe because different wallets)
      const flushPromises = Array.from(batchesByPublisher.entries()).map(
        async ([publisher, items]) => {
          console.log(`🔄 [V3-REPOST-BATCH] Flushing ${items.length} reposts for publisher ${publisher.substring(0, 10)}...`);
          
          // ✅ MULTI-PUBLISHER: Must have user wallet
          if (!items[0]?.userWalletClient) {
            console.error(`❌ [V3-REPOST-BATCH] No user wallet for publisher ${publisher}`);
            throw new Error(`Multi-publisher batch requires user wallet for ${publisher}`);
          }
          
          const sdk = new SDK({ 
            public: this.publicClient, 
            wallet: items[0].userWalletClient! 
          });

          const batchData = items.map(item => ({
            schemaId: item.schemaId,
            id: item.id,
            data: item.data
          }));

          // Single transaction for all reposts from this publisher
          const txHash = await sdk.streams.set(batchData);
          
          console.log(`✅ [V3-REPOST-BATCH] Publisher ${publisher.substring(0, 10)} flushed: ${txHash}`);
          
          // ✅ Index publisher
          publisherIndexer.addPublisher(publisher);
          
          return { publisher, txHash, count: items.length };
        }
      );

      const results = await Promise.all(flushPromises);

      const flushTime = Date.now() - startTime;
      console.log(`✅ [V3-REPOST-BATCH] All publishers flushed in ${flushTime}ms`);

      // 📊 LOG: Repost batch flush success
      // ✅ FIX: Use actual user's publisher address (not BATCH_SYSTEM)
      const primaryTxHash = results[0]?.txHash || 'MULTI_PUBLISHER_BATCH';
      const primaryPublisher = results[0]?.publisher || batch[0]?.publisherAddress || 'UNKNOWN';
      
      interactionLogger.logSuccess(logId, primaryTxHash, primaryPublisher, {
        batchSize: batch.length,
        duration: flushTime,
        txHash: primaryTxHash,
        publisherAddress: primaryPublisher,
        rawData: {
          publisherCount: batchesByPublisher.size,
          // All transaction hashes from all publishers
          allTxHashes: results.map(r => ({ publisher: r.publisher, txHash: r.txHash, count: r.count })),
          results: results,
          interactionIds: batch.map(b => b.interactionData.id),
          interactionTypes: batch.map(b => InteractionType[b.interactionData.interactionType!]),
        },
        interactions: batch.map(item => ({
          id: item.interactionData.id,
          timestamp: item.interactionData.timestamp,
          interactionType: item.interactionData.interactionType,
          interactionTypeName: InteractionType[item.interactionData.interactionType!],
          targetId: item.interactionData.targetId,
          targetType: item.interactionData.targetType,
          fromUser: item.interactionData.fromUser,
          publisherAddress: item.publisherAddress,
          schemaId: item.schemaId,
          idHex: item.id,
          encodedData: item.data,
        }))
      });

      // Clear cache
      this.dataCache.delete('all_interactions');
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error('❌ [V3-REPOST-BATCH] Flush failed:', error);
      
      // 📊 LOG: Failure
      interactionLogger.logFailure(logId, error as Error);
      
      throw error;
    }
  }

  /**
   * Add repost interaction to batch (MULTI-PUBLISHER)
   */
  private addToRepostBatch(
    schemaId: Hex, 
    id: Hex, 
    data: Hex,
    interactionData: Partial<InteractionDataV3>,
    userWalletClient?: any,
    publisherAddress?: string
  ): void {
    // Use fromUser as publisher if not explicitly provided
    const publisher = publisherAddress || interactionData.fromUser!;
    
    this.repostBatch.push({ 
      schemaId, 
      id, 
      data, 
      interactionData,
      userWalletClient,
      publisherAddress: publisher
    });
    
    console.log(`🔄 [V3-REPOST-BATCH] Added to batch. Current size: ${this.repostBatch.length}/${this.REPOST_BATCH_SIZE} (publisher: ${publisher.substring(0, 10)}...)`);

    // Auto-flush after delay or when batch is full
    if (this.repostBatch.length >= this.REPOST_BATCH_SIZE) {
      console.log(`🔄 [V3-REPOST-BATCH] Batch full (${this.repostBatch.length}), flushing immediately...`);
      this.flushRepostBatch();
    } else {
      if (this.repostBatchTimeout) {
        clearTimeout(this.repostBatchTimeout);
      }
      console.log(`🔄 [V3-REPOST-BATCH] Setting timeout to flush in ${this.REPOST_BATCH_DELAY}ms...`);
      this.repostBatchTimeout = setTimeout(() => {
        console.log(`🔄 [V3-REPOST-BATCH] Timeout triggered, flushing ${this.repostBatch.length} reposts...`);
        this.flushRepostBatch();
      }, this.REPOST_BATCH_DELAY);
    }
  }

  // ===== UNIFIED BATCH PROCESSING (ALL INTERACTIONS) =====
  
  /**
   * Flush unified batch to blockchain (MULTI-PUBLISHER)
   * Combines like, unlike, repost, unrepost, bookmark, unbookmark in single transaction per publisher
   * This is the most efficient way to batch all user interactions
   */
  private async flushUnifiedBatch(): Promise<void> {
    console.log(`🚀 [V3-UNIFIED-BATCH] flushUnifiedBatch() called. Batch size: ${this.unifiedBatch.length}`);
    
    // ✅ Clear timeout to prevent duplicate flush calls
    if (this.unifiedBatchTimeout) {
      clearTimeout(this.unifiedBatchTimeout);
      this.unifiedBatchTimeout = null;
    }
    
    if (this.unifiedBatch.length === 0) {
      console.log(`🚀 [V3-UNIFIED-BATCH] Batch empty, skipping flush`);
      return;
    }
    
    if (!this.sdk) {
      console.error('❌ [V3-UNIFIED-BATCH] SDK not initialized!');
      throw new Error('SDK not initialized');
    }

    // ✅ MULTI-PUBLISHER: Group batch by publisher
    const batch = [...this.unifiedBatch];
    this.unifiedBatch = [];
    
    console.log(`🚀 [V3-UNIFIED-BATCH] Flushing ${batch.length} interactions...`);
    const startTime = Date.now();

    // Group by publisher address
    const batchesByPublisher = new Map<string, typeof batch>();
    batch.forEach(item => {
      const publisher = item.publisherAddress.toLowerCase();
      if (!batchesByPublisher.has(publisher)) {
        batchesByPublisher.set(publisher, []);
      }
      batchesByPublisher.get(publisher)!.push(item);
    });

    console.log(`🚀 [V3-UNIFIED-BATCH] Grouped into ${batchesByPublisher.size} publisher(s)`);

    // Count interaction types
    const typeCounts = new Map<string, number>();
    batch.forEach(item => {
      const typeName = InteractionType[item.interactionData.interactionType!];
      typeCounts.set(typeName, (typeCounts.get(typeName) || 0) + 1);
    });
    const typeCountsStr = Array.from(typeCounts.entries())
      .map(([type, count]) => `${type}:${count}`)
      .join(', ');

    // 📊 LOG: Unified batch flush start
    const logId = interactionLogger.logStart('BATCH_FLUSH_UNIFIED', 'USER', {
      content: `Unified batch flush: ${batch.length} interactions (${typeCountsStr}) from ${batchesByPublisher.size} publisher(s)`,
      batchSize: batch.length,
      rawData: {
        publisherCount: batchesByPublisher.size,
        typeCounts: Object.fromEntries(typeCounts),
        interactions: batch.map(item => ({
          id: item.interactionData.id,
          timestamp: item.interactionData.timestamp,
          interactionType: item.interactionData.interactionType,
          interactionTypeName: InteractionType[item.interactionData.interactionType!],
          targetId: item.interactionData.targetId,
          targetType: item.interactionData.targetType,
          fromUser: item.interactionData.fromUser,
          publisherAddress: item.publisherAddress,
          schemaId: item.schemaId,
          idHex: item.id,
          encodedData: item.data,
        }))
      }
    });

    try {
      // ⚡ Flush each publisher's batch (parallel execution, safe because different wallets)
      const flushPromises = Array.from(batchesByPublisher.entries()).map(
        async ([publisher, items]) => {
          console.log(`🚀 [V3-UNIFIED-BATCH] Flushing ${items.length} interactions for publisher ${publisher.substring(0, 10)}...`);
          
          // ✅ MULTI-PUBLISHER: Must have user wallet
          if (!items[0]?.userWalletClient) {
            console.error(`❌ [V3-UNIFIED-BATCH] No user wallet for publisher ${publisher}`);
            throw new Error(`Multi-publisher batch requires user wallet for ${publisher}`);
          }
          
          const sdk = new SDK({ 
            public: this.publicClient, 
            wallet: items[0].userWalletClient! 
          });

          const batchData = items.map(item => ({
            schemaId: item.schemaId,
            id: item.id,
            data: item.data
          }));

          // Single transaction for all interactions from this publisher
          const txHash = await sdk.streams.set(batchData);
          
          console.log(`✅ [V3-UNIFIED-BATCH] Publisher ${publisher.substring(0, 10)} flushed: ${txHash}`);
          
          // ✅ Index publisher
          publisherIndexer.addPublisher(publisher);
          
          return { publisher, txHash, count: items.length };
        }
      );

      const results = await Promise.all(flushPromises);

      const flushTime = Date.now() - startTime;
      console.log(`✅ [V3-UNIFIED-BATCH] All publishers flushed in ${flushTime}ms`);

      // 📊 LOG: Unified batch flush success
      const primaryTxHash = results[0]?.txHash || 'MULTI_PUBLISHER_BATCH';
      const primaryPublisher = results[0]?.publisher || batch[0]?.publisherAddress || 'UNKNOWN';
      
      interactionLogger.logSuccess(logId, primaryTxHash, primaryPublisher, {
        batchSize: batch.length,
        duration: flushTime,
        txHash: primaryTxHash,
        publisherAddress: primaryPublisher,
        rawData: {
          publisherCount: batchesByPublisher.size,
          typeCounts: Object.fromEntries(typeCounts),
          allTxHashes: results.map(r => ({ publisher: r.publisher, txHash: r.txHash, count: r.count })),
          results: results,
          interactionIds: batch.map(b => b.interactionData.id),
          interactionTypes: batch.map(b => InteractionType[b.interactionData.interactionType!]),
        },
        interactions: batch.map(item => ({
          id: item.interactionData.id,
          timestamp: item.interactionData.timestamp,
          interactionType: item.interactionData.interactionType,
          interactionTypeName: InteractionType[item.interactionData.interactionType!],
          targetId: item.interactionData.targetId,
          targetType: item.interactionData.targetType,
          fromUser: item.interactionData.fromUser,
          publisherAddress: item.publisherAddress,
          schemaId: item.schemaId,
          idHex: item.id,
          encodedData: item.data,
        }))
      });

      // ✅ Clear interaction cache to force fresh read
      this.dataCache.delete('all_interactions');
      
      // Small delay to allow blockchain to propagate
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('❌ [V3-UNIFIED-BATCH] Failed to flush unified batch:', error);
      
      // 📊 LOG: Unified batch flush failure
      interactionLogger.logFailure(logId, error as Error);
      
      throw error;
    }
  }

  /**
   * Add interaction to unified batch (MULTI-PUBLISHER)
   * This is the recommended way to batch all interactions for maximum efficiency
   */
  private addToUnifiedBatch(
    schemaId: Hex, 
    id: Hex, 
    data: Hex,
    interactionData: Partial<InteractionDataV3>,
    userWalletClient?: any,
    publisherAddress?: string
  ): void {
    // Use fromUser as publisher if not explicitly provided
    const publisher = publisherAddress || interactionData.fromUser!;
    
    this.unifiedBatch.push({ 
      schemaId, 
      id, 
      data, 
      interactionData,
      userWalletClient,
      publisherAddress: publisher
    });
    
    const typeName = InteractionType[interactionData.interactionType!];
    console.log(`🚀 [V3-UNIFIED-BATCH] Added ${typeName} to batch. Current size: ${this.unifiedBatch.length}/${this.UNIFIED_BATCH_SIZE} (publisher: ${publisher.substring(0, 10)}...)`);

    // Auto-flush after delay or when batch is full
    if (this.unifiedBatch.length >= this.UNIFIED_BATCH_SIZE) {
      console.log(`🚀 [V3-UNIFIED-BATCH] Batch full (${this.unifiedBatch.length}), flushing immediately...`);
      this.flushUnifiedBatch();
    } else {
      if (this.unifiedBatchTimeout) {
        clearTimeout(this.unifiedBatchTimeout);
      }
      console.log(`🚀 [V3-UNIFIED-BATCH] Setting timeout to flush in ${this.UNIFIED_BATCH_DELAY}ms...`);
      this.unifiedBatchTimeout = setTimeout(() => {
        console.log(`🚀 [V3-UNIFIED-BATCH] Timeout triggered, flushing ${this.unifiedBatch.length} interactions...`);
        this.flushUnifiedBatch();
      }, this.UNIFIED_BATCH_DELAY);
    }
  }

  /**
   * Force flush pending unified batch writes (MULTI-PUBLISHER)
   */
  async forceUnifiedBatchFlush(): Promise<void> {
    if (this.unifiedBatchTimeout) {
      clearTimeout(this.unifiedBatchTimeout);
      this.unifiedBatchTimeout = null;
    }
    return this.flushUnifiedBatch();
  }

  /**
   * Get unified batch status (MULTI-PUBLISHER)
   */
  getUnifiedBatchStatus(): { 
    pending: number; 
    willFlushIn: number;
    publishers: string[];
    typeCounts: Record<string, number>;
  } {
    // Get unique publishers in batch
    const publishers = [...new Set(this.unifiedBatch.map(item => item.publisherAddress))];
    
    // Count interaction types
    const typeCounts: Record<string, number> = {};
    this.unifiedBatch.forEach(item => {
      const typeName = InteractionType[item.interactionData.interactionType!];
      typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
    });
    
    return {
      pending: this.unifiedBatch.length,
      willFlushIn: this.unifiedBatchTimeout ? this.UNIFIED_BATCH_DELAY : 0,
      publishers,
      typeCounts
    };
  }

  /**
   * Create a new post (batched)
   * @param userWalletClient Optional user wallet for multi-publisher pattern
   */
  async createPost(
    postData: Partial<PostDataV3>,
    immediate: boolean = false,
    userWalletClient?: any
  ): Promise<number> {
    await this.ensureInitialized();
    
    if (!validatePostData(postData)) {
      throw new Error('Invalid post data');
    }

    if (!postData.author) {
      throw new Error('Author is required');
    }

    // 📊 START LOGGING
    const logId = interactionLogger.logStart(
      'POST',
      userWalletClient ? 'USER' : 'SERVER',
      {
        author: postData.author,
        content: postData.content?.substring(0, 50),
        contentType: ContentType[postData.contentType || 0],
        timestamp: postData.timestamp
      }
    );

    try {
      console.log('📝 [V3] Creating post...', postData);

      const schemaId = await this.getSchemaIdCached('posts');
      const schemaEncoder = new SchemaEncoder(SOMNIA_CONFIG_V3.schemaStrings.posts);

      // Generate ID if not provided
      const timestamp = postData.timestamp || Date.now();
      const author = postData.author;
      const postId = postData.id || createPostId(author, timestamp);

      // Encode data using SDK format V6 (18 fields)
      const encodedData = schemaEncoder.encodeData([
        { name: 'id', value: postId.toString(), type: 'uint256' },
        { name: 'timestamp', value: timestamp.toString(), type: 'uint256' },
        { name: 'content', value: postData.content || '', type: 'string' },
        { name: 'contentType', value: (postData.contentType ?? ContentType.TEXT).toString(), type: 'uint8' },
        { name: 'mediaHashes', value: postData.mediaHashes || '', type: 'string' }, // V6: Multiple media
        { name: 'author', value: author, type: 'address' },
        { name: 'quotedPostId', value: (postData.quotedPostId || 0).toString(), type: 'uint256' }, // V6: uint256
        { name: 'replyToId', value: (postData.replyToId || 0).toString(), type: 'uint256' }, // V6: Threading
        { name: 'mentions', value: postData.mentions || '', type: 'string' }, // V6: Mentions
        { name: 'collectModule', value: postData.collectModule || '0x0000000000000000000000000000000000000000', type: 'address' }, // V6: Monetization
        { name: 'collectPrice', value: (postData.collectPrice || 0).toString(), type: 'uint256' }, // V6: Monetization
        { name: 'collectLimit', value: (postData.collectLimit || 0).toString(), type: 'uint32' }, // V6: Monetization
        { name: 'collectCount', value: (postData.collectCount || 0).toString(), type: 'uint32' }, // V6: Monetization
        { name: 'isGated', value: postData.isGated || false, type: 'bool' }, // V6: Gated content
        { name: 'referrer', value: postData.referrer || '0x0000000000000000000000000000000000000000', type: 'address' }, // V6: Referral
        { name: 'nftTokenId', value: (postData.nftTokenId || 0).toString(), type: 'uint32' },
        { name: 'isDeleted', value: postData.isDeleted || false, type: 'bool' },
        { name: 'isPinned', value: postData.isPinned || false, type: 'bool' },
      ]);

      // Convert number ID to bytes32
      const postIdHex = numberToBytes32(postId);

      // 📊 LOG BLOCKCHAIN DATA
      interactionLogger.logBlockchainData(
        logId,
        schemaId,
        encodedData,
        postIdHex
      );

      if (immediate) {
        // ✅ HYBRID: Use user wallet if provided, fallback to server wallet
        const sdk = userWalletClient
          ? new SDK({ public: this.publicClient, wallet: userWalletClient })
          : this.sdk;

        // Immediate write (use transaction queue to prevent nonce conflicts)
        console.log('📤 [V3] Writing post to blockchain...', {
          schemaId,
          postId,
          author,
          content: postData.content?.substring(0, 50),
          wallet: userWalletClient ? 'USER' : 'SERVER',
        });

        // Use transaction queue to ensure sequential execution
        await transactionQueue.enqueue(async () => {
          const txHash = await sdk.streams.set([
            {
              schemaId,
              id: postIdHex,
              data: encodedData,
            },
          ]);

          console.log('✅ [V3] Post written to blockchain!', {
            txHash,
            postId,
            schemaId,
            wallet: userWalletClient ? 'USER' : 'SERVER',
          });

          // ✅ Index publisher
          const publisherAddress = userWalletClient
            ? author // User's wallet = author
            : await this.getServerPublisherAddress(); // Server wallet

          publisherIndexer.addPublisher(publisherAddress!);

          // 📊 LOG SUCCESS
          interactionLogger.logSuccess(
            logId,
            txHash!,
            publisherAddress!,
            {
              postId,
              schemaId,
              author,
              contentType: ContentType[postData.contentType || 0]
            }
          );

          this.dataCache.delete('all_posts');
          return txHash;
        });

        return postId;
      } else {
        // Add to batch (faster, but delayed)
        this.addToBatch(schemaId, postIdHex, encodedData);
        console.log('✅ [V3] Post added to batch (not yet written to blockchain)');
        console.log('💡 [V3] Click "Flush Batch" to write to blockchain');
        return postId;
      }
    } catch (error) {
      console.error('❌ [V3] Failed to create post:', error);
      
      // 📊 LOG FAILURE
      interactionLogger.logFailure(logId, error as Error);
      
      throw error;
    }
  }

  /**
   * Delete a post (soft delete by setting isDeleted = true)
   * @param userWalletClient Optional user wallet for multi-publisher pattern
   */
  async deletePost(postId: number, postData: PostDataV3, userWalletClient?: any): Promise<void> {
    await this.ensureInitialized();

    if (!postData.author) {
      throw new Error('Author is required');
    }

    try {
      const walletType = userWalletClient ? 'USER' : 'SERVER';
      console.log(`🗑️ [V3] Deleting post with ${walletType} wallet...`, postId);

      const schemaId = await this.getSchemaIdCached('posts');
      const schemaEncoder = new SchemaEncoder(SOMNIA_CONFIG_V3.schemaStrings.posts);

      // Encode data with isDeleted = true (keep all other fields the same)
      const encodedData = schemaEncoder.encodeData([
        { name: 'id', value: postId.toString(), type: 'uint256' },
        { name: 'timestamp', value: postData.timestamp.toString(), type: 'uint256' },
        { name: 'content', value: postData.content || '', type: 'string' },
        { name: 'contentType', value: postData.contentType.toString(), type: 'uint8' },
        { name: 'mediaHashes', value: postData.mediaHashes || '', type: 'string' },
        { name: 'author', value: postData.author, type: 'address' },
        { name: 'quotedPostId', value: (postData.quotedPostId || 0).toString(), type: 'uint256' },
        { name: 'replyToId', value: (postData.replyToId || 0).toString(), type: 'uint256' },
        { name: 'mentions', value: postData.mentions || '', type: 'string' },
        { name: 'collectModule', value: postData.collectModule || '0x0000000000000000000000000000000000000000', type: 'address' },
        { name: 'collectPrice', value: (postData.collectPrice || 0).toString(), type: 'uint256' },
        { name: 'collectLimit', value: (postData.collectLimit || 0).toString(), type: 'uint32' },
        { name: 'collectCount', value: (postData.collectCount || 0).toString(), type: 'uint32' },
        { name: 'isGated', value: postData.isGated || false, type: 'bool' },
        { name: 'referrer', value: postData.referrer || '0x0000000000000000000000000000000000000000', type: 'address' },
        { name: 'nftTokenId', value: postData.nftTokenId || 0, type: 'uint32' },
        { name: 'isDeleted', value: true, type: 'bool' }, // Set to true for delete
        { name: 'isPinned', value: postData.isPinned || false, type: 'bool' },
      ]);

      // Convert number ID to bytes32
      const postIdHex = numberToBytes32(postId);

      console.log(`📤 [V3] Writing delete to blockchain with ${walletType} wallet...`, {
        schemaId,
        postId,
        author: postData.author,
        isDeleted: true // ✅ Confirm we're setting isDeleted to true
      });
      
      // ✅ Use USER wallet if provided, otherwise use SERVER wallet
      const sdkToUse = userWalletClient 
        ? new SDK({ public: this.publicClient, wallet: userWalletClient })
        : this.sdk;

      if (!sdkToUse) {
        throw new Error('SDK not initialized');
      }

      // ✅ Register user as publisher if using user wallet
      if (userWalletClient) {
        publisherIndexer.addPublisher(postData.author);
        console.log(`📝 [V3] Publisher ${postData.author.slice(0, 10)}... registered`);
      }
      
      // Use transaction queue to ensure sequential execution
      await transactionQueue.enqueue(async () => {
        const txHash = await sdkToUse.streams.set([{
          schemaId,
          id: postIdHex,
          data: encodedData,
        }]);
        
        console.log(`✅ [V3] Post deleted on blockchain with ${walletType} wallet!`, {
          txHash,
          postId,
          schemaId,
          author: postData.author.slice(0, 10) + '...'
        });
        
        // Clear cache
        this.dataCache.delete('all_posts');
        return txHash;
      });
    } catch (error) {
      console.error('❌ [V3] Failed to delete post:', error);
      throw error;
    }
  }

  /**
   * Create an interaction (like, comment, repost, etc.) - batched
   * @param userWalletClient Optional user wallet for multi-publisher pattern
   */
  async createInteraction(
    interactionData: Partial<InteractionDataV3>,
    immediate: boolean = false,
    userWalletClient?: any
  ): Promise<string> {
    if (!validateInteractionData(interactionData)) {
      throw new Error('Invalid interaction data');
    }

    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    // 📊 START LOGGING
    const interactionTypeName = InteractionType[interactionData.interactionType!] as any;
    const logId = interactionLogger.logStart(
      interactionTypeName,
      userWalletClient ? 'USER' : 'SERVER',
      {
        fromUser: interactionData.fromUser,
        targetId: interactionData.targetId,
        interactionType: interactionData.interactionType,
        content: interactionData.content?.substring(0, 50),
        timestamp: interactionData.timestamp
      }
    );

    try {
      console.log('📝 [V3] Creating interaction:', InteractionType[interactionData.interactionType!]);

      const schemaId = await this.getSchemaIdCached('interactions');
      const schemaEncoder = new SchemaEncoder(SOMNIA_CONFIG_V3.schemaStrings.interactions);

      // Encode data using SDK format V6 (9 fields)
      const timestamp = interactionData.timestamp || Date.now();
      const id = interactionData.id || (timestamp * 10 + (interactionData.interactionType || 0));
      
      // V6: targetId and parentId are uint256
      const targetId = interactionData.targetId || 0;
      const parentId = interactionData.parentId || 0;
      const tipAmount = interactionData.tipAmount || 0;
      
      console.log('🔍 [V3] Encoding interaction data V6:', {
        id,
        timestamp,
        interactionType: interactionData.interactionType,
        targetId,
        targetType: interactionData.targetType,
        fromUser: interactionData.fromUser?.substring(0, 10) + '...',
        content: interactionData.content?.substring(0, 30),
        parentId,
        tipAmount
      });
      
      // Encode V6 with uint256 IDs
      const encodedData = schemaEncoder.encodeData([
        { name: 'id', value: id.toString(), type: 'uint256' },
        { name: 'timestamp', value: timestamp.toString(), type: 'uint256' },
        { name: 'interactionType', value: (interactionData.interactionType ?? InteractionType.LIKE).toString(), type: 'uint8' },
        { name: 'targetId', value: targetId.toString(), type: 'uint256' }, // V6: uint256
        { name: 'targetType', value: (interactionData.targetType ?? TargetType.POST).toString(), type: 'uint8' },
        { name: 'fromUser', value: interactionData.fromUser || '', type: 'address' },
        { name: 'content', value: interactionData.content || '', type: 'string' },
        { name: 'parentId', value: parentId.toString(), type: 'uint256' }, // V6: uint256
        { name: 'tipAmount', value: tipAmount.toString(), type: 'uint256' }, // V6: Tipping
      ]);
      
      console.log('✅ [V3] Data encoded successfully');

      // Convert number ID to bytes32
      const idHex = numberToBytes32(id);

      // 📊 LOG BLOCKCHAIN DATA
      interactionLogger.logBlockchainData(
        logId,
        schemaId,
        encodedData,
        idHex
      );

      // ✅ Check if this is a like/unlike interaction for optimized batching
      const isLikeInteraction = 
        interactionData.interactionType === InteractionType.LIKE || 
        interactionData.interactionType === InteractionType.UNLIKE;

      // ✅ Check if this is a bookmark/unbookmark interaction for optimized batching
      const isBookmarkInteraction = 
        interactionData.interactionType === InteractionType.BOOKMARK || 
        interactionData.interactionType === InteractionType.UNBOOKMARK;

      // ✅ Check if this is a repost/unrepost interaction for multi-publisher batching
      const isRepostInteraction = 
        interactionData.interactionType === InteractionType.REPOST || 
        interactionData.interactionType === InteractionType.UNREPOST;

      // 🚀 SMART DETECTION: Check if we should use unified batch
      // Unified batch is used when multiple interaction types are pending
      const isBatchableInteraction = isLikeInteraction || isBookmarkInteraction || isRepostInteraction;
      const shouldUseUnifiedBatch = isBatchableInteraction && userWalletClient && (
        // Use unified if we have mixed types in pending batches
        (this.likeBatch.length > 0 && (this.bookmarkBatch.length > 0 || this.repostBatch.length > 0)) ||
        (this.bookmarkBatch.length > 0 && (this.likeBatch.length > 0 || this.repostBatch.length > 0)) ||
        (this.repostBatch.length > 0 && (this.likeBatch.length > 0 || this.bookmarkBatch.length > 0)) ||
        // Or if unified batch already has items
        this.unifiedBatch.length > 0
      );

      if (immediate) {
        // ✅ HYBRID: Use user wallet if provided, fallback to server wallet
        const sdk = userWalletClient
          ? new SDK({ public: this.publicClient, wallet: userWalletClient })
          : this.sdk;

        // Immediate write (use transaction queue to prevent nonce conflicts)
        console.log('📤 [V3] Writing interaction to blockchain...', {
          wallet: userWalletClient ? 'USER' : 'SERVER',
        });

        // Use transaction queue to ensure sequential execution
        const txHash = await transactionQueue.enqueue(async () => {
          const hash = await sdk.streams.set([
            {
              schemaId,
              id: idHex,
              data: encodedData,
            },
          ]);

          console.log('✅ [V3] Interaction created (immediate):', {
            hash,
            wallet: userWalletClient ? 'USER' : 'SERVER',
          });

          // ✅ Index publisher
          const publisherAddress = userWalletClient
            ? interactionData.fromUser! // User's wallet = fromUser
            : await this.getServerPublisherAddress(); // Server wallet

          publisherIndexer.addPublisher(publisherAddress!);

          // 📊 LOG SUCCESS
          interactionLogger.logSuccess(
            logId,
            hash!,
            publisherAddress!,
            {
              interactionId: id,
              interactionType: InteractionType[interactionData.interactionType!],
              targetId,
              fromUser: interactionData.fromUser
            }
          );

          this.dataCache.delete('all_interactions');
          return hash;
        });

        return txHash;
      } else {
        // 🚀 SMART ROUTING: Use unified batch if multiple types are pending
        if (shouldUseUnifiedBatch) {
          console.log(`🚀 [V3] Using UNIFIED BATCH (smart detection) for ${InteractionType[interactionData.interactionType!]}`);
          
          const enrichedInteractionData = {
            ...interactionData,
            id,
            timestamp,
            targetId,
          };
          
          const publisherAddress = interactionData.fromUser! as string;
          
          this.addToUnifiedBatch(
            schemaId,
            idHex,
            encodedData,
            enrichedInteractionData,
            userWalletClient,
            publisherAddress
          );
          
          // 📊 LOG SUCCESS (unified batched)
          interactionLogger.logSuccess(
            logId,
            'UNIFIED_BATCHED',
            publisherAddress,
            {
              batched: true,
              batchType: 'UNIFIED',
              multiPublisher: true,
              publisherAddress,
              willFlushIn: `${this.UNIFIED_BATCH_DELAY}ms`,
              interactionId: id,
              interactionType: InteractionType[interactionData.interactionType!],
              targetId,
              fromUser: interactionData.fromUser,
              timestamp,
              content: interactionData.content || '',
              schemaId,
              id: idHex,
              encodedData,
              rawData: {
                interactionId: id,
                interactionType: InteractionType[interactionData.interactionType!],
                targetId,
                fromUser: interactionData.fromUser,
                publisherAddress,
                smartDetection: true,
                pendingBatches: {
                  like: this.likeBatch.length,
                  bookmark: this.bookmarkBatch.length,
                  repost: this.repostBatch.length,
                  unified: this.unifiedBatch.length
                }
              }
            }
          );
          
          return 'unified_batched';
        }
        
        // ⚡ MULTI-PUBLISHER: Use dedicated like batch for like/unlike interactions
        if (isLikeInteraction) {
          // ✅ FIX: Only use like batch if userWalletClient is provided
          if (!userWalletClient) {
            console.warn('⚠️ [V3] Like interaction without userWalletClient, using general batch instead');
            this.addToBatch(schemaId, idHex, encodedData);
            
            // 📊 LOG SUCCESS (batched)
            interactionLogger.logSuccess(
              logId,
              'batched',
              interactionData.fromUser || 'unknown',
              { batched: true, reason: 'no_user_wallet' }
            );
            
            return 'batched';
          }
          
          // ✅ FIX: Add generated id to interactionData before batching
          const enrichedInteractionData = {
            ...interactionData,
            id, // Add the generated id
            timestamp,
            targetId,
          };
          
          // Get publisher address (use fromUser since userWalletClient is provided)
          const publisherAddress = interactionData.fromUser! as string;
          
          this.addToLikeBatch(
            schemaId, 
            idHex, 
            encodedData, 
            enrichedInteractionData,
            userWalletClient,
            publisherAddress
          );
          console.log(`❤️ [V3] ${InteractionType[interactionData.interactionType!]} added to like batch (multi-publisher, instant response)`);
          
          // 📊 LOG SUCCESS (like batched) with full data
          interactionLogger.logSuccess(
            logId,
            'LIKE_BATCHED',
            publisherAddress,
            { 
              batched: true,
              batchType: 'LIKE',
              multiPublisher: !!userWalletClient,
              publisherAddress,
              willFlushIn: `${this.LIKE_BATCH_DELAY}ms`,
              // Full interaction data (like immediate write)
              interactionId: id,
              interactionType: InteractionType[interactionData.interactionType!],
              targetId,
              fromUser: interactionData.fromUser,
              timestamp,
              content: interactionData.content || '',
              // Blockchain data
              schemaId,
              id: idHex,
              encodedData,
              // Raw data for detailed view
              rawData: {
                interactionId: id,
                interactionType: InteractionType[interactionData.interactionType!],
                targetId,
                fromUser: interactionData.fromUser,
                publisherAddress
              }
            }
          );
          
          return 'like_batched';
        } else if (isBookmarkInteraction) {
          // ⚡ OPTIMIZED: Use dedicated bookmark batch for bookmark/unbookmark interactions (MULTI-PUBLISHER)
          const enrichedInteractionData = {
            ...interactionData,
            id, // Add the generated id
            timestamp,
            targetId,
          };
          
          // Get publisher address (use fromUser since userWalletClient is provided)
          const publisherAddress = interactionData.fromUser! as string;
          
          this.addToBookmarkBatch(
            schemaId, 
            idHex, 
            encodedData, 
            enrichedInteractionData,
            userWalletClient,
            publisherAddress
          );
          console.log(`🔖 [V3] ${InteractionType[interactionData.interactionType!]} added to bookmark batch (multi-publisher, instant response)`);
          
          // 📊 LOG SUCCESS (bookmark batched) with full data
          interactionLogger.logSuccess(
            logId,
            'BOOKMARK_BATCHED',
            publisherAddress,
            { 
              batched: true,
              batchType: 'BOOKMARK',
              multiPublisher: !!userWalletClient,
              publisherAddress,
              willFlushIn: `${this.BOOKMARK_BATCH_DELAY}ms`,
              // Full interaction data
              interactionId: id,
              interactionType: InteractionType[interactionData.interactionType!],
              targetId,
              fromUser: interactionData.fromUser,
              timestamp,
              content: interactionData.content || '',
              // Blockchain data
              schemaId,
              id: idHex,
              encodedData,
              // Raw data for detailed view
              rawData: {
                interactionId: id,
                interactionType: InteractionType[interactionData.interactionType!],
                targetId,
                fromUser: interactionData.fromUser
              }
            }
          );
          
          return 'bookmark_batched';
        } else if (isRepostInteraction) {
          // ✅ FIX: Only use repost batch if userWalletClient is provided
          if (!userWalletClient) {
            console.warn('⚠️ [V3] Repost interaction without userWalletClient, using general batch instead');
            this.addToBatch(schemaId, idHex, encodedData);
            
            // 📊 LOG SUCCESS (batched)
            interactionLogger.logSuccess(
              logId,
              'batched',
              interactionData.fromUser || 'unknown',
              { batched: true, reason: 'no_user_wallet' }
            );
            
            return 'batched';
          }
          
          // ⚡ MULTI-PUBLISHER: Use dedicated repost batch for repost/unrepost interactions
          const enrichedInteractionData = {
            ...interactionData,
            id, // Add the generated id
            timestamp,
            targetId,
          };
          
          // Get publisher address (use fromUser since userWalletClient is provided)
          const publisherAddress = interactionData.fromUser! as string;
          
          this.addToRepostBatch(
            schemaId, 
            idHex, 
            encodedData, 
            enrichedInteractionData,
            userWalletClient,
            publisherAddress
          );
          console.log(`🔄 [V3] ${InteractionType[interactionData.interactionType!]} added to repost batch (multi-publisher, instant response)`);
          
          // 📊 LOG SUCCESS (repost batched) with full data
          interactionLogger.logSuccess(
            logId,
            'REPOST_BATCHED',
            publisherAddress,
            { 
              batched: true,
              batchType: 'REPOST',
              multiPublisher: !!userWalletClient,
              publisherAddress,
              willFlushIn: `${this.REPOST_BATCH_DELAY}ms`,
              // Full interaction data
              interactionId: id,
              interactionType: InteractionType[interactionData.interactionType!],
              targetId,
              fromUser: interactionData.fromUser,
              timestamp,
              content: interactionData.content || '',
              // Blockchain data
              schemaId,
              id: idHex,
              encodedData,
              // Raw data for detailed view
              rawData: {
                interactionId: id,
                interactionType: InteractionType[interactionData.interactionType!],
                targetId,
                fromUser: interactionData.fromUser,
                publisherAddress
              }
            }
          );
          
          return 'repost_batched';
        } else {
          // Add to general batch (for other non-critical interactions)
          this.addToBatch(schemaId, idHex, encodedData);
          console.log('✅ [V3] Interaction added to batch');
          
          // 📊 LOG SUCCESS (batched)
          interactionLogger.logSuccess(
            logId,
            'batched',
            interactionData.fromUser || 'unknown',
            { batched: true }
          );
          
          return 'batched';
        }
      }
    } catch (error) {
      console.error('❌ [V3] Failed to create interaction:', error);
      
      // 📊 LOG FAILURE
      interactionLogger.logFailure(logId, error as Error);
      
      // Check if it's a network timeout
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('timeout') || errorMessage.includes('deadline exceeded')) {
        console.warn('⚠️ [V3] Network timeout detected - transaction may still succeed');
        console.warn('💡 [V3] Suggestion: Wait a moment and check if transaction completed, or retry');
      }
      
      throw error;
    }
  }

  /**
   * Batch create multiple interactions at once
   * 
   * Use this for bulk operations (e.g., importing data)
   */
  async createInteractionsBatch(interactions: Partial<InteractionDataV3>[]): Promise<string> {
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    // Use transaction queue to prevent nonce conflicts
    return transactionQueue.enqueue(async () => {
      console.log(`📦 [V3] Creating ${interactions.length} interactions in batch...`);
      const startTime = Date.now();

      const schemaId = await this.getSchemaIdCached('interactions');
      const schemaEncoder = new SchemaEncoder(SOMNIA_CONFIG_V3.schemaStrings.interactions);

      const batch = interactions.map((interaction): { schemaId: `0x${string}`; id: `0x${string}`; data: `0x${string}` } => {
        const timestamp = interaction.timestamp || Date.now();
        const id = interaction.id || (timestamp * 10 + (interaction.interactionType || 0));
        
        // V6: targetId dan parentId sebagai uint256
        const targetId = interaction.targetId || 0;
        const parentId = interaction.parentId || 0;
        const tipAmount = interaction.tipAmount || 0;
        
        const encodedData = schemaEncoder.encodeData([
          { name: 'id', value: id.toString(), type: 'uint256' },
          { name: 'timestamp', value: timestamp.toString(), type: 'uint256' },
          { name: 'interactionType', value: (interaction.interactionType ?? InteractionType.LIKE).toString(), type: 'uint8' },
          { name: 'targetId', value: targetId.toString(), type: 'uint256' },
          { name: 'targetType', value: (interaction.targetType ?? TargetType.POST).toString(), type: 'uint8' },
          { name: 'fromUser', value: interaction.fromUser || '', type: 'address' },
          { name: 'content', value: interaction.content || '', type: 'string' },
          { name: 'parentId', value: parentId.toString(), type: 'uint256' },
          { name: 'tipAmount', value: tipAmount.toString(), type: 'uint256' },
        ]);

        return {
          schemaId,
          id: numberToBytes32(id),
          data: encodedData,
        };
      });

      const txHash = await this.sdk!.streams.set(batch);

      const batchTime = Date.now() - startTime;
      console.log(`✅ [V3] Batch created in ${batchTime}ms:`, txHash);

      this.dataCache.delete('all_interactions');
      return txHash;
    });
  }

  /**
   * Force flush pending batch writes
   */
  async forceBatchFlush(): Promise<string[]> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    return this.flushBatch();
  }

  /**
   * Force flush pending like batch writes
   */
  async forceLikeBatchFlush(): Promise<void> {
    if (this.likeBatchTimeout) {
      clearTimeout(this.likeBatchTimeout);
      this.likeBatchTimeout = null;
    }
    return this.flushLikeBatch();
  }

  /**
   * Get like batch status (MULTI-PUBLISHER)
   */
  getLikeBatchStatus(): { 
    pending: number; 
    willFlushIn: number;
    publishers: string[];
  } {
    // Get unique publishers in batch
    const publishers = [...new Set(this.likeBatch.map(item => item.publisherAddress))];
    
    return {
      pending: this.likeBatch.length,
      willFlushIn: this.likeBatchTimeout ? this.LIKE_BATCH_DELAY : 0,
      publishers
    };
  }

  /**
   * Force flush pending bookmark batch writes
   */
  async forceBookmarkBatchFlush(): Promise<void> {
    if (this.bookmarkBatchTimeout) {
      clearTimeout(this.bookmarkBatchTimeout);
      this.bookmarkBatchTimeout = null;
    }
    return this.flushBookmarkBatch();
  }

  /**
   * Get bookmark batch status (MULTI-PUBLISHER)
   */
  getBookmarkBatchStatus(): { 
    pending: number; 
    willFlushIn: number;
    publishers: string[];
  } {
    // Get unique publishers in batch
    const publishers = [...new Set(this.bookmarkBatch.map(item => item.publisherAddress))];
    
    return {
      pending: this.bookmarkBatch.length,
      willFlushIn: this.bookmarkBatchTimeout ? this.BOOKMARK_BATCH_DELAY : 0,
      publishers
    };
  }

  /**
   * Force flush pending repost batch writes (MULTI-PUBLISHER)
   */
  async forceRepostBatchFlush(): Promise<void> {
    if (this.repostBatchTimeout) {
      clearTimeout(this.repostBatchTimeout);
      this.repostBatchTimeout = null;
    }
    return this.flushRepostBatch();
  }

  /**
   * Get repost batch status (MULTI-PUBLISHER)
   */
  getRepostBatchStatus(): { 
    pending: number; 
    willFlushIn: number;
    publishers: string[];
  } {
    // Get unique publishers in batch
    const publishers = [...new Set(this.repostBatch.map(item => item.publisherAddress))];
    
    return {
      pending: this.repostBatch.length,
      willFlushIn: this.repostBatchTimeout ? this.REPOST_BATCH_DELAY : 0,
      publishers
    };
  }

  // ===== CACHE MANAGEMENT =====

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.dataCache.clear();
    console.log('🗑️ [V3] Cache cleared');
  }

  /**
   * Clear specific cache
   */
  clearCacheFor(key: string): void {
    this.dataCache.delete(key);
    console.log(`🗑️ [V3] Cache cleared for: ${key}`);
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.dataCache.size,
      keys: Array.from(this.dataCache.keys()),
      expiry: this.cacheExpiry,
    };
  }

  // ===== HIGH-LEVEL FEED OPERATIONS (WEB2-LEVEL PERFORMANCE) =====

  /**
   * Load complete feed with stats (OPTIMIZED)
   * 
   * Single method that loads posts + interactions + aggregates
   * Performance: ~100-200ms for 20 posts with stats
   */
  async loadFeedOptimized(
    page: number = 0,
    pageSize: number = 20,
    currentUser?: string
  ): Promise<{
    posts: PostDataV3[];
    statsMap: Map<number, PostStats>;
    loadTime: number;
    interactions: InteractionDataV3[];
  }> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 [V3] Loading optimized feed (page ${page}, pageSize ${pageSize})...`);

      // ⚡ STEP 1: Load posts (paginated) - ~50ms
      const posts = await this.getPostsPaginated(page, pageSize);
      
      if (posts.length === 0) {
        console.log('📭 [V3] No posts found');
        return { posts: [], statsMap: new Map(), loadTime: Date.now() - startTime, interactions: [] };
      }

      console.log(`📚 [V3] Loaded ${posts.length} posts, now loading interactions...`);

      // ⚡ STEP 2: Load ALL interactions (not filtered by postIds) - ~50ms
      // PENTING: Load semua interactions agar like/unlike/comment/repost persisten
      const interactions = await this.getAllInteractions();
      
      console.log(`💬 [V3] Loaded ${interactions.length} total interactions from blockchain`);

      // Filter interactions for current posts (optional, for performance)
      const postIds = posts.map(p => p.id);
      const relevantInteractions = interactions.filter(i => postIds.includes(i.targetId));
      
      console.log(`🎯 [V3] Found ${relevantInteractions.length} interactions for current posts`);

      // ⚡ STEP 3: Aggregate stats (client-side, super fast) - ~1ms
      const { aggregateInteractions } = await import('@/config/somniaDataStreams.v3');
      const statsMap = aggregateInteractions(relevantInteractions, currentUser);

      console.log(`📊 [V3] Aggregated stats for ${statsMap.size} posts`);
      
      // Log sample stats for debugging
      if (statsMap.size > 0) {
        const firstPostId = Array.from(statsMap.keys())[0];
        const firstStats = statsMap.get(firstPostId!);
        console.log(`📈 [V3] Sample stats for ${String(firstPostId).substring(0, 20)}:`, {
          likes: firstStats?.likes || 0,
          comments: firstStats?.comments || 0,
          reposts: firstStats?.reposts,
          userLiked: firstStats?.userLiked,
          userReposted: firstStats?.userReposted
        });
      }

      const loadTime = Date.now() - startTime;
      console.log(`✅ [V3] Feed loaded in ${loadTime}ms (${posts.length} posts, ${relevantInteractions.length} interactions)`);

      return { posts, statsMap, loadTime, interactions: relevantInteractions };
    } catch (error) {
      console.error('❌ [V3] Failed to load feed:', error);
      throw error;
    }
  }

  /**
   * Load feed with enriched data (posts + stats + quotes + profiles)
   * 
   * Performance: ~200-300ms for complete feed
   */
  async loadFeedEnriched(
    page: number = 0,
    pageSize: number = 20,
    currentUser?: string
  ): Promise<{
    posts: Array<PostDataV3 & { quotedPost?: PostDataV3 }>;
    statsMap: Map<number, PostStats>;
    profiles: Map<string, ProfileDataV3>;
    loadTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 [V3] Loading enriched feed (page ${page})...`);

      // Load basic feed
      const { posts, statsMap } = await this.loadFeedOptimized(page, pageSize, currentUser);

      // Enrich with quoted posts
      const enrichedPosts = enrichPostsWithQuotes(posts);

      // Load profiles for all authors (parallel)
      const authorAddresses = new Set(posts.map(p => p.author));
      const profiles = new Map<string, ProfileDataV3>();
      
      // Load profiles from profileService
      try {
        const { profileService } = await import('@/services/profileService');
        const addressArray = Array.from(authorAddresses);
        const profileResults = await profileService.getMultipleProfiles(addressArray);
        
        // Map profiles to ProfileDataV3 format
        profileResults.forEach((profile, index) => {
          if (profile) {
            const address = addressArray[index]!;
            profiles.set(address.toLowerCase(), {
              userAddress: profile.userAddress,
              username: profile.username || '',
              displayName: profile.displayName || '',
              bio: profile.bio || '',
              avatarHash: profile.avatarHash || '',
              followerCount: profile.followerCount || 0,
              followingCount: profile.followingCount || 0,
              isVerified: profile.isVerified || false,
              isArtist: profile.isArtist || false,
            });
          }
        });
        
        console.log(`✅ [V3] Loaded ${profiles.size} profiles for ${authorAddresses.size} authors`);
      } catch (profileError) {
        console.warn('⚠️ [V3] Failed to load profiles, continuing with empty map:', profileError);
      }

      const loadTime = Date.now() - startTime;
      console.log(`✅ [V3] Enriched feed loaded in ${loadTime}ms`);

      return { posts: enrichedPosts, statsMap, profiles, loadTime };
    } catch (error) {
      console.error('❌ [V3] Failed to load enriched feed:', error);
      throw error;
    }
  }

  /**
   * Prefetch next page for smooth infinite scroll
   */
  async prefetchNextPage(currentPage: number, pageSize: number = 20): Promise<void> {
    if (!SOMNIA_CONFIG_V3.performance.prefetchNextPage) return;

    try {
      console.log(`🔮 [V3] Prefetching page ${currentPage + 1}...`);
      
      // Load next page in background
      await this.getPostsPaginated(currentPage + 1, pageSize);
      
      console.log(`✅ [V3] Page ${currentPage + 1} prefetched`);
    } catch (error) {
      console.warn('⚠️ [V3] Prefetch failed:', error);
    }
  }

  /**
   * Get post by ID (with caching)
   */
  async getPostById(postId: number): Promise<PostDataV3 | null> {
    const cacheKey = `post_${postId}`;
    
    // Check cache
    const cached = this.dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      const cachedData = cached.data as PostDataV3[];
      return cachedData[0] || null;
    }

    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    try {
      const privateKey = import.meta.env.VITE_PRIVATE_KEY;
      const publisher = privateKey ? privateKeyToAccount(privateKey as `0x${string}`).address : null;
      
      if (!publisher) {
        throw new Error('Publisher address not found');
      }

      const schemaId = await this.getSchemaIdCached('posts');
      
      // Get all posts and find by ID
      const allData = await this.sdk!.streams.getAllPublisherDataForSchema(schemaId, publisher);
      
      // Helper functions
      const safeExtractValue = (item: any, defaultValue: any = '') => {
        if (!item) return defaultValue;
        if (item.value !== undefined) {
          if (typeof item.value === 'object' && item.value.value !== undefined) {
            return item.value.value;
          }
          return item.value;
        }
        return item;
      };

      const safeString = (value: any, defaultValue: string = ''): string => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return defaultValue;
        return String(value);
      };

      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'object') return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
      };
      
      // Find the post by matching ID
      for (let idx = 0; idx < allData!.length; idx++) {
        const item = allData![idx] as any;
        const id = safeNumber(safeExtractValue(item[0]));
        
        if (id === postId) {
          const timestamp = safeNumber(safeExtractValue(item[1]));
          const content = safeString(safeExtractValue(item[2]));
          const contentType = safeNumber(safeExtractValue(item[3]), 0);
          const mediaHashes = safeString(safeExtractValue(item[4]));
          const author = safeString(safeExtractValue(item[5]));
          const quotedPostId = safeNumber(safeExtractValue(item[6]), 0);
          const replyToId = safeNumber(safeExtractValue(item[7]), 0);
          const mentions = safeString(safeExtractValue(item[8]));
          const collectModule = safeString(safeExtractValue(item[9]), '0x0000000000000000000000000000000000000000');
          const collectPrice = safeNumber(safeExtractValue(item[10]), 0);
          const collectLimit = safeNumber(safeExtractValue(item[11]), 0);
          const collectCount = safeNumber(safeExtractValue(item[12]), 0);
          const isGated = Boolean(safeExtractValue(item[13]));
          const referrer = safeString(safeExtractValue(item[14]), '0x0000000000000000000000000000000000000000');
          const nftTokenId = safeNumber(safeExtractValue(item[15]), 0);
          const isDeleted = Boolean(safeExtractValue(item[16]));
          const isPinned = Boolean(safeExtractValue(item[17]));
          
          const post: PostDataV3 = {
            id,
            index: idx,
            timestamp,
            content,
            contentType: contentType as ContentType,
            mediaHashes,
            author,
            quotedPostId,
            replyToId,
            mentions,
            collectModule,
            collectPrice,
            collectLimit,
            collectCount,
            isGated,
            referrer,
            nftTokenId,
            isDeleted,
            isPinned,
          };
          
          // Cache result (store as array for consistency)
          this.dataCache.set(cacheKey, { data: [post], timestamp: Date.now() });
          
          return post;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ [V3] Failed to get post by ID:', error);
      return null;
    }
  }

  /**
   * Get interactions for specific post (with caching)
   */
  async getInteractionsForPost(postId: number): Promise<InteractionDataV3[]> {
    const cacheKey = `interactions_${postId}`;
    
    // Check cache
    const cached = this.dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data as InteractionDataV3[];
    }

    const allInteractions = await this.getAllInteractions([postId.toString()]);
    
    // Cache result
    this.dataCache.set(cacheKey, { data: allInteractions, timestamp: Date.now() });
    
    return allInteractions;
  }

  /**
   * Get comment tree for post
   */
  async getCommentTree(postId: number): Promise<Array<InteractionDataV3 & { replies: InteractionDataV3[] }>> {
    const interactions = await this.getInteractionsForPost(postId);
    return buildCommentTree(postId, interactions);
  }

  /**
   * Get performance stats
   */
  getPerformanceStats() {
    return {
      cacheSize: this.dataCache.size,
      pendingRequests: this.pendingRequests.size,
      batchSize: this.writeBatch.length,
      cacheKeys: Array.from(this.dataCache.keys()),
    };
  }

  // ===== GENERATED MUSIC BACKUP OPERATIONS =====

  /**
   * Save generated music to datastream (backup for failed mints)
   */
  async saveGeneratedMusic(musicData: Partial<GeneratedMusicData>, immediate: boolean = true): Promise<number> {
    await this.ensureInitialized();
    
    const { validateGeneratedMusicData, createGeneratedMusicId, GeneratedMusicStatus } = await import('@/config/somniaDataStreams.v3');
    
    if (!validateGeneratedMusicData(musicData)) {
      throw new Error('Invalid generated music data');
    }

    if (!musicData.owner) {
      throw new Error('Owner is required');
    }

    try {
      console.log('🎵 [V3] Saving generated music to datastream...', {
        title: musicData.title,
        taskId: musicData.taskId
      });

      const schemaId = await this.getSchemaIdCached('generatedMusic');
      const schemaEncoder = new SchemaEncoder(SOMNIA_CONFIG_V3.schemaStrings.generatedMusic);

      // Generate ID if not provided
      const timestamp = musicData.timestamp || Date.now();
      const owner = musicData.owner;
      const musicId = musicData.id || createGeneratedMusicId(owner, timestamp);

      // Encode data (11 fields)
      const encodedData = schemaEncoder.encodeData([
        { name: 'id', value: musicId.toString(), type: 'uint256' },
        { name: 'timestamp', value: timestamp.toString(), type: 'uint256' },
        { name: 'owner', value: owner, type: 'address' },
        { name: 'taskId', value: musicData.taskId || '', type: 'string' },
        { name: 'title', value: musicData.title || '', type: 'string' },
        { name: 'audioUrl', value: musicData.audioUrl || '', type: 'string' },
        { name: 'imageUrl', value: musicData.imageUrl || '', type: 'string' },
        { name: 'prompt', value: musicData.prompt || '', type: 'string' },
        { name: 'style', value: musicData.style || '', type: 'string' },
        { name: 'lyrics', value: musicData.lyrics || '', type: 'string' },
        { name: 'status', value: (musicData.status ?? GeneratedMusicStatus.COMPLETED).toString(), type: 'uint8' },
      ]);

      // Convert number ID to bytes32
      const musicIdHex = numberToBytes32(musicId);

      if (immediate) {
        // Immediate write
        console.log('📤 [V3] Writing generated music to blockchain...', {
          schemaId,
          musicId,
          owner,
          title: musicData.title,
          taskId: musicData.taskId,
          audioUrl: musicData.audioUrl?.substring(0, 50) + '...',
          imageUrl: musicData.imageUrl?.substring(0, 50) + '...',
          status: musicData.status
        });
        
        await transactionQueue.enqueue(async () => {
          const txHash = await this.sdk!.streams.set([{
            schemaId,
            id: musicIdHex,
            data: encodedData,
          }]);
          
          console.log('✅ [V3] Generated music saved to blockchain!', {
            txHash,
            musicId,
            schemaId,
            title: musicData.title
          });
          
          // Clear cache to force reload
          this.dataCache.delete('all_generated_music');
          
          // Verify save by reading back (with longer delay for blockchain confirmation)
          setTimeout(async () => {
            try {
              // Force clear cache again before verify
              this.dataCache.delete('all_generated_music');
              
              const allMusic = await this.getAllGeneratedMusic();
              const savedMusic = allMusic.find(m => m.id === musicId);
              if (savedMusic) {
                console.log('✅ [V3] Verified music saved:', savedMusic.title);
              } else {
                console.warn('⚠️ [V3] Music not found after save (may need more time for blockchain confirmation):', musicId);
                console.log('💡 [V3] Total music in blockchain:', allMusic.length);
                console.log('💡 [V3] Latest music IDs:', allMusic.slice(0, 3).map(m => m.id));
              }
            } catch (verifyError) {
              console.error('❌ [V3] Failed to verify save:', verifyError);
            }
          }, 3000); // Increase delay to 3 seconds
          
          return txHash;
        });
        
        return musicId;
      } else {
        // Add to batch
        this.addToBatch(schemaId, musicIdHex, encodedData);
        console.log('✅ [V3] Generated music added to batch');
        return musicId;
      }
    } catch (error) {
      console.error('❌ [V3] Failed to save generated music:', error);
      throw error;
    }
  }

  /**
   * Get all generated music for current user
   */
  async getAllGeneratedMusic(): Promise<GeneratedMusicData[]> {
    await this.ensureInitialized();

    const cacheKey = 'all_generated_music';
    
    // Check cache
    const cached = this.dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('⚡ [V3] Using cached generated music');
      return cached.data as GeneratedMusicData[];
    }

    try {
      const startTime = Date.now();
      console.log('🎵 [V3] Loading all generated music...');

      const privateKey = import.meta.env.VITE_PRIVATE_KEY;
      const publisher = privateKey ? privateKeyToAccount(privateKey as `0x${string}`).address : null;
      
      if (!publisher) {
        throw new Error('Publisher address not found');
      }

      const schemaId = await this.getSchemaIdCached('generatedMusic');
      const rawData = await this.sdk!.streams.getAllPublisherDataForSchema(schemaId, publisher);

      if (!rawData || rawData.length === 0) {
        console.log('📭 [V3] No generated music found');
        return [];
      }

      // Helper functions
      const safeExtractValue = (item: any, defaultValue: any = '') => {
        if (!item) return defaultValue;
        if (item.value !== undefined) {
          if (typeof item.value === 'object' && item.value.value !== undefined) {
            return item.value.value;
          }
          return item.value;
        }
        return item;
      };

      const safeString = (value: any, defaultValue: string = ''): string => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return defaultValue;
        return String(value);
      };

      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'object') return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
      };

      // Decode data (11 fields)
      const { GeneratedMusicStatus } = await import('@/config/somniaDataStreams.v3');
      
      const musicList: GeneratedMusicData[] = [];
      
      for (let idx = 0; idx < rawData.length; idx++) {
        try {
          const item = rawData[idx];
          
          // Skip empty or invalid data
          if (!item || !Array.isArray(item) || item.length === 0) {
            console.warn('⚠️ [V3] Skipping invalid music record (empty data)');
            continue;
          }
          
          const id = safeNumber(safeExtractValue(item[0]));
          const timestamp = safeNumber(safeExtractValue(item[1]));
          const owner = safeString(safeExtractValue(item[2]));
          const taskId = safeString(safeExtractValue(item[3]));
          const title = safeString(safeExtractValue(item[4]));
          const audioUrl = safeString(safeExtractValue(item[5]));
          const imageUrl = safeString(safeExtractValue(item[6]));
          const prompt = safeString(safeExtractValue(item[7]));
          const style = safeString(safeExtractValue(item[8]));
          const lyrics = safeString(safeExtractValue(item[9]));
          const status = safeNumber(safeExtractValue(item[10]), GeneratedMusicStatus.COMPLETED);
          
          // Debug log untuk music pertama
          if (idx === 0) {
            console.log('🔍 [V3] First music decoded:', {
              id,
              timestamp,
              owner: owner.substring(0, 10) + '...',
              taskId,
              title,
              audioUrl: audioUrl.substring(0, 50) + '...',
              imageUrl: imageUrl.substring(0, 50) + '...',
              status
            });
          }
          
          musicList.push({
            id,
            timestamp,
            owner,
            taskId,
            title,
            audioUrl,
            imageUrl,
            prompt,
            style,
            lyrics,
            status: status as GeneratedMusicStatus,
          });
        } catch (decodeError: any) {
          console.warn('⚠️ [V3] Failed to decode music record, skipping:', decodeError.message);
          continue;
        }
      }

      // Sort by timestamp (newest first)
      musicList.sort((a, b) => b.timestamp - a.timestamp);

      const loadTime = Date.now() - startTime;
      console.log(`✅ [V3] Loaded ${musicList.length} generated music in ${loadTime}ms`);

      // Cache result
      this.dataCache.set(cacheKey, { data: musicList, timestamp: Date.now() });

      return musicList;
    } catch (error: any) {
      if (error?.message?.includes('NoData()')) {
        console.log('📭 [V3] No generated music found (NoData)');
        return [];
      }
      console.error('❌ [V3] Failed to load generated music:', error);
      throw error;
    }
  }

  /**
   * Get unminted music (status = COMPLETED)
   */
  async getUnmintedMusic(): Promise<GeneratedMusicData[]> {
    const allMusic = await this.getAllGeneratedMusic();
    const { getUnmintedMusic } = await import('@/config/somniaDataStreams.v3');
    return getUnmintedMusic(allMusic);
  }

  /**
   * Update music status (e.g., after successful mint)
   */
  async updateMusicStatus(musicId: number, newStatus: number, musicData: GeneratedMusicData): Promise<void> {
    await this.ensureInitialized();

    try {
      console.log('🔄 [V3] Updating music status...', { musicId, newStatus });

      const schemaId = await this.getSchemaIdCached('generatedMusic');
      const schemaEncoder = new SchemaEncoder(SOMNIA_CONFIG_V3.schemaStrings.generatedMusic);

      // Encode data with updated status (keep all other fields the same)
      const encodedData = schemaEncoder.encodeData([
        { name: 'id', value: musicId.toString(), type: 'uint256' },
        { name: 'timestamp', value: musicData.timestamp.toString(), type: 'uint256' },
        { name: 'owner', value: musicData.owner, type: 'address' },
        { name: 'taskId', value: musicData.taskId, type: 'string' },
        { name: 'title', value: musicData.title, type: 'string' },
        { name: 'audioUrl', value: musicData.audioUrl, type: 'string' },
        { name: 'imageUrl', value: musicData.imageUrl, type: 'string' },
        { name: 'prompt', value: musicData.prompt, type: 'string' },
        { name: 'style', value: musicData.style, type: 'string' },
        { name: 'lyrics', value: musicData.lyrics, type: 'string' },
        { name: 'status', value: newStatus.toString(), type: 'uint8' },
      ]);

      const musicIdHex = numberToBytes32(musicId);

      console.log('📤 [V3] Writing status update to blockchain...');
      
      await transactionQueue.enqueue(async () => {
        const txHash = await this.sdk!.streams.set([{
          schemaId,
          id: musicIdHex,
          data: encodedData,
        }]);
        
        console.log('✅ [V3] Music status updated on blockchain!', {
          txHash,
          musicId,
          newStatus
        });
        
        // Clear cache
        this.dataCache.delete('all_generated_music');
        return txHash;
      });
    } catch (error) {
      console.error('❌ [V3] Failed to update music status:', error);
      throw error;
    }
  }

  /**
   * Get generated music by task ID
   */
  async getGeneratedMusicByTaskId(taskId: string): Promise<GeneratedMusicData | null> {
    const allMusic = await this.getAllGeneratedMusic();
    return allMusic.find(m => m.taskId === taskId) || null;
  }

  // ===== PLAY EVENTS OPERATIONS =====

  /**
   * Record a play event
   */
  async recordPlayEvent(eventData: Partial<PlayEventData>, immediate: boolean = true): Promise<number> {
    await this.ensureInitialized();
    
    const { validatePlayEventData, createPlayEventId } = await import('@/config/somniaDataStreams.v3');
    
    if (!validatePlayEventData(eventData)) {
      throw new Error('Invalid play event data');
    }

    try {
      console.log('🎵 [V3] Recording play event...', {
        tokenId: eventData.tokenId,
        listener: eventData.listener?.substring(0, 10) + '...',
        duration: eventData.duration,
        source: eventData.source
      });

      const schemaId = await this.getSchemaIdCached('playEvents');
      const schemaEncoder = new SchemaEncoder(SOMNIA_CONFIG_V3.schemaStrings.playEvents);

      // Generate ID if not provided
      const timestamp = eventData.timestamp || Date.now();
      const eventId = eventData.id || createPlayEventId();

      // Encode data (6 fields)
      const encodedData = schemaEncoder.encodeData([
        { name: 'id', value: eventId.toString(), type: 'uint256' },
        { name: 'timestamp', value: timestamp.toString(), type: 'uint256' },
        { name: 'tokenId', value: (eventData.tokenId || 0).toString(), type: 'uint32' },
        { name: 'listener', value: eventData.listener || '', type: 'address' },
        { name: 'duration', value: (eventData.duration || 0).toString(), type: 'uint32' },
        { name: 'source', value: eventData.source || 'app', type: 'string' },
      ]);

      const eventIdHex = numberToBytes32(eventId);

      if (immediate) {
        // Immediate write
        await transactionQueue.enqueue(async () => {
          const txHash = await this.sdk!.streams.set([{
            schemaId,
            id: eventIdHex,
            data: encodedData,
          }]);
          
          console.log('✅ [V3] Play event recorded!', { txHash, eventId });
          this.dataCache.delete('all_play_events');
          return txHash;
        });
        
        return eventId;
      } else {
        // Add to batch
        this.addToBatch(schemaId, eventIdHex, encodedData);
        console.log('✅ [V3] Play event added to batch');
        return eventId;
      }
    } catch (error) {
      console.error('❌ [V3] Failed to record play event:', error);
      throw error;
    }
  }

  /**
   * Get all play events
   */
  async getAllPlayEvents(): Promise<PlayEventData[]> {
    await this.ensureInitialized();

    const cacheKey = 'all_play_events';
    
    // Check cache
    const cached = this.dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      // console.log('⚡ [V3] Using cached play events');
      return cached.data as PlayEventData[];
    }

    try {
      const startTime = Date.now();
      // console.log('🎵 [V3] Loading all play events...');

      const privateKey = import.meta.env.VITE_PRIVATE_KEY;
      const publisher = privateKey ? privateKeyToAccount(privateKey as `0x${string}`).address : null;
      
      if (!publisher) {
        throw new Error('Publisher address not found');
      }

      const schemaId = await this.getSchemaIdCached('playEvents');
      const rawData = await this.sdk!.streams.getAllPublisherDataForSchema(schemaId, publisher);

      if (!rawData || rawData.length === 0) {
        console.log('📭 [V3] No play events found');
        return [];
      }

      // Helper functions
      const safeExtractValue = (item: any, defaultValue: any = '') => {
        if (!item) return defaultValue;
        if (item.value !== undefined) {
          if (typeof item.value === 'object' && item.value.value !== undefined) {
            return item.value.value;
          }
          return item.value;
        }
        return item;
      };

      const safeString = (value: any, defaultValue: string = ''): string => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return defaultValue;
        return String(value);
      };

      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'object') return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
      };

      // Decode data (6 fields)
      const events: PlayEventData[] = [];
      
      for (let idx = 0; idx < rawData.length; idx++) {
        try {
          const item = rawData[idx];
          
          if (!item || !Array.isArray(item) || item.length === 0) {
            console.warn('⚠️ [V3] Skipping invalid play event (empty data)');
            continue;
          }
          
          const id = safeNumber(safeExtractValue(item[0]));
          const timestamp = safeNumber(safeExtractValue(item[1]));
          const tokenId = safeNumber(safeExtractValue(item[2]));
          const listener = safeString(safeExtractValue(item[3]));
          const duration = safeNumber(safeExtractValue(item[4]));
          const source = safeString(safeExtractValue(item[5]), 'app');
          
          events.push({
            id,
            timestamp,
            tokenId,
            listener,
            duration,
            source,
          });
        } catch (decodeError: any) {
          console.warn('⚠️ [V3] Failed to decode play event, skipping:', decodeError.message);
          continue;
        }
      }

      // Sort by timestamp (newest first)
      events.sort((a, b) => b.timestamp - a.timestamp);

      const loadTime = Date.now() - startTime;
      console.log(`✅ [V3] Loaded ${events.length} play events in ${loadTime}ms`);

      // Cache result
      this.dataCache.set(cacheKey, { data: events, timestamp: Date.now() });

      return events;
    } catch (error: any) {
      if (error?.message?.includes('NoData()')) {
        console.log('📭 [V3] No play events found (NoData)');
        return [];
      }
      console.error('❌ [V3] Failed to load play events:', error);
      throw error;
    }
  }

  /**
   * Get play count for a song
   */
  async getPlayCount(tokenId: number): Promise<number> {
    const events = await this.getAllPlayEvents();
    return events.filter(e => e.tokenId === tokenId).length;
  }

  /**
   * Get trending songs
   */
  async getTrendingSongs(limit: number = 10, timeWindow?: number): Promise<Array<{ tokenId: number; score: number; plays: number; uniqueListeners: number }>> {
    const events = await this.getAllPlayEvents();
    
    // Get all unique token IDs
    const tokenIds = [...new Set(events.map(e => e.tokenId))];
    
    const { getTrendingSongs } = await import('@/config/somniaDataStreams.v3');
    return getTrendingSongs(events, tokenIds, limit, timeWindow);
  }

  /**
   * Get play counts for specific token IDs
   */
  async getPlayCountsForTokens(tokenIds: number[]): Promise<Map<number, number>> {
    const allEvents = await this.getAllPlayEvents();
    const { aggregatePlayCounts } = await import('@/config/somniaDataStreams.v3');
    
    // Filter events for requested tokens
    const relevantEvents = allEvents.filter(e => tokenIds.includes(e.tokenId));
    
    return aggregatePlayCounts(relevantEvents);
  }

  /**
   * Get best song in album (highest play count)
   */
  async getBestSongInAlbum(tokenIds: number[]): Promise<{ tokenId: number; playCount: number } | null> {
    if (tokenIds.length === 0) return null;
    
    const playCounts = await this.getPlayCountsForTokens(tokenIds);
    
    let bestSong: { tokenId: number; playCount: number } | null = null;
    
    for (const tokenId of tokenIds) {
      const playCount = playCounts.get(tokenId) || 0;
      if (!bestSong || playCount > bestSong.playCount) {
        bestSong = { tokenId, playCount };
      }
    }
    
    return bestSong;
  }

  // ===== BOOKMARK FUNCTIONS =====

  /**
   * Bookmark a post
   * @param userWalletClient Optional user wallet for multi-publisher pattern
   */
  async bookmarkPost(postId: number, userAddress: string, userWalletClient?: any): Promise<any> {
    console.log('🔖 [V3] Bookmarking post:', postId, 'by user:', userAddress);
    console.log('   Using wallet:', userWalletClient ? 'USER (multi-publisher)' : 'SERVER');
    
    await this.ensureInitialized();
    
    const interactionData: Partial<InteractionDataV3> = {
      interactionType: InteractionType.BOOKMARK,
      targetId: postId,
      targetType: TargetType.POST,
      fromUser: userAddress,
      content: '',
      parentId: 0,
      tipAmount: 0,
    };

    try {
      // ⚡ Use batching for instant response (immediate = false)
      const result = await this.createInteraction(interactionData, false, userWalletClient);
      console.log('✅ [V3] Bookmark added to batch:', result);
      
      // Return structured result like like/unlike
      return {
        success: true,
        batched: true,
        batchType: 'BOOKMARK',
        willFlushIn: `${this.BOOKMARK_BATCH_DELAY}ms`,
        txHash: result,
        publisherAddress: userAddress,
      };
    } catch (error) {
      console.error('❌ [V3] Failed to bookmark:', error);
      throw error;
    }
  }

  /**
   * Unbookmark a post
   * @param userWalletClient Optional user wallet for multi-publisher pattern
   */
  async unbookmarkPost(postId: number, userAddress: string, userWalletClient?: any): Promise<any> {
    console.log('🔖 [V3] Unbookmarking post:', postId, 'by user:', userAddress);
    console.log('   Using wallet:', userWalletClient ? 'USER (multi-publisher)' : 'SERVER');
    
    await this.ensureInitialized();
    
    const interactionData: Partial<InteractionDataV3> = {
      interactionType: InteractionType.UNBOOKMARK,
      targetId: postId,
      targetType: TargetType.POST,
      fromUser: userAddress,
      content: '',
      parentId: 0,
      tipAmount: 0,
    };

    try {
      // ⚡ Use batching for instant response (immediate = false)
      const result = await this.createInteraction(interactionData, false, userWalletClient);
      console.log('✅ [V3] Unbookmark added to batch:', result);
      
      // Return structured result like like/unlike
      return {
        success: true,
        batched: true,
        batchType: 'BOOKMARK',
        willFlushIn: `${this.BOOKMARK_BATCH_DELAY}ms`,
        txHash: result,
        publisherAddress: userAddress,
      };
    } catch (error) {
      console.error('❌ [V3] Failed to unbookmark:', error);
      throw error;
    }
  }

  /**
   * Get bookmarked posts for a user
   */
  async getBookmarkedPosts(userAddress: string): Promise<PostDataV3[]> {
    // Removed verbose logging - use debug tools if needed
    
    try {
      // Get all interactions
      const interactions = await this.getAllInteractions();
      
      // Filter bookmark interactions for this user
      const bookmarkInteractions = interactions.filter(
        i => i.fromUser.toLowerCase() === userAddress.toLowerCase() &&
             (i.interactionType === InteractionType.BOOKMARK || 
              i.interactionType === InteractionType.UNBOOKMARK)
      );
      
      // Track bookmark state per post (handle bookmark/unbookmark)
      const bookmarkState = new Map<number, boolean>();
      
      // Sort by timestamp (oldest first) to process chronologically
      bookmarkInteractions.sort((a, b) => a.timestamp - b.timestamp);
      
      for (const interaction of bookmarkInteractions) {
        if (interaction.interactionType === InteractionType.BOOKMARK) {
          bookmarkState.set(interaction.targetId, true);
        } else if (interaction.interactionType === InteractionType.UNBOOKMARK) {
          bookmarkState.set(interaction.targetId, false);
        }
      }
      
      // Get post IDs that are currently bookmarked
      const bookmarkedPostIds = Array.from(bookmarkState.entries())
        .filter(([_, isBookmarked]) => isBookmarked)
        .map(([postId, _]) => postId);
      
      // Only log if bookmarks found (reduce noise)
      if (bookmarkedPostIds.length > 0) {
        console.log('🔖 [V3] Found', bookmarkedPostIds.length, 'bookmarked posts');
      }
      
      // Get all posts
      const allPosts = await this.getAllPosts();
      
      // Filter posts that are bookmarked
      const bookmarkedPosts = allPosts.filter(post => 
        bookmarkedPostIds.includes(post.id)
      );
      
      // Sort by bookmark timestamp (most recent first)
      bookmarkedPosts.sort((a, b) => {
        const aBookmark = bookmarkInteractions.find(
          i => i.targetId === a.id && i.interactionType === InteractionType.BOOKMARK
        );
        const bBookmark = bookmarkInteractions.find(
          i => i.targetId === b.id && i.interactionType === InteractionType.BOOKMARK
        );
        return (bBookmark?.timestamp || 0) - (aBookmark?.timestamp || 0);
      });
      
      return bookmarkedPosts;
    } catch (error) {
      console.error('❌ [V3] Failed to get bookmarked posts:', error);
      return [];
    }
  }

  /**
   * Check if a post is bookmarked by user
   */
  async isPostBookmarked(postId: number, userAddress: string): Promise<boolean> {
    try {
      const interactions = await this.getAllInteractions();
      
      // Filter bookmark interactions for this user and post
      const bookmarkInteractions = interactions.filter(
        i => i.fromUser.toLowerCase() === userAddress.toLowerCase() &&
             i.targetId === postId &&
             (i.interactionType === InteractionType.BOOKMARK || 
              i.interactionType === InteractionType.UNBOOKMARK)
      );
      
      // Sort by timestamp (oldest first)
      bookmarkInteractions.sort((a, b) => a.timestamp - b.timestamp);
      
      // Get last interaction
      const lastInteraction = bookmarkInteractions[bookmarkInteractions.length - 1];
      
      return lastInteraction?.interactionType === InteractionType.BOOKMARK;
    } catch (error) {
      console.error('❌ [V3] Failed to check bookmark status:', error);
      return false;
    }
  }

  // ===== FOLLOW/UNFOLLOW OPERATIONS (NEW) =====

  /**
   * Follow a user
   * @param targetUserAddress - Address of user to follow
   * @param fromUserAddress - Address of user doing the follow
   * @param immediate - If true, write immediately. If false, use batch (default: false for multi-publisher)
   * @param userWallet - Optional user wallet for multi-publisher batch
   */
  async followUser(
    targetUserAddress: string, 
    fromUserAddress: string, 
    immediate: boolean = false,
    userWallet?: any
  ): Promise<string> {
    console.log('👥 [V3] Following user:', targetUserAddress, 'by:', fromUserAddress, immediate ? '(immediate)' : '(batch)');
    
    await this.ensureInitialized();
    
    // Convert address to number for targetId (use first 16 hex chars)
    const targetId = parseInt(targetUserAddress.slice(2, 18), 16);
    
    const interactionData: Partial<InteractionDataV3> = {
      interactionType: InteractionType.FOLLOW,
      targetId,
      targetType: TargetType.USER,
      fromUser: fromUserAddress,
      content: targetUserAddress, // Store full address in content
      parentId: 0,
      tipAmount: 0,
    };

    try {
      const result = await this.createInteraction(interactionData, immediate, userWallet);
      console.log('✅ [V3] Follow created:', result);
      
      // Clear cache to force refresh
      this.clearCacheFor('all_interactions');
      
      return result;
    } catch (error) {
      console.error('❌ [V3] Failed to follow user:', error);
      throw error;
    }
  }

  /**
   * Unfollow a user
   * @param targetUserAddress - Address of user to unfollow
   * @param fromUserAddress - Address of user doing the unfollow
   * @param immediate - If true, write immediately. If false, use batch (default: false for multi-publisher)
   * @param userWallet - Optional user wallet for multi-publisher batch
   */
  async unfollowUser(
    targetUserAddress: string, 
    fromUserAddress: string,
    immediate: boolean = false,
    userWallet?: any
  ): Promise<string> {
    console.log('👥 [V3] Unfollowing user:', targetUserAddress, 'by:', fromUserAddress, immediate ? '(immediate)' : '(batch)');
    
    await this.ensureInitialized();
    
    // Convert address to number for targetId (use first 16 hex chars)
    const targetId = parseInt(targetUserAddress.slice(2, 18), 16);
    
    const interactionData: Partial<InteractionDataV3> = {
      interactionType: InteractionType.UNFOLLOW,
      targetId,
      targetType: TargetType.USER,
      fromUser: fromUserAddress,
      content: targetUserAddress, // Store full address in content
      parentId: 0,
      tipAmount: 0,
    };

    try {
      const result = await this.createInteraction(interactionData, immediate, userWallet);
      console.log('✅ [V3] Unfollow created:', result);
      
      // Clear cache to force refresh
      this.clearCacheFor('all_interactions');
      
      return result;
    } catch (error) {
      console.error('❌ [V3] Failed to unfollow user:', error);
      throw error;
    }
  }

  /**
   * Check if user is following another user
   */
  async isFollowing(followerAddress: string, targetAddress: string): Promise<boolean> {
    try {
      const interactions = await this.getAllInteractions();
      
      // Convert target address to targetId
      const targetId = parseInt(targetAddress.slice(2, 18), 16);
      
      // Filter follow interactions for this user and target
      const followInteractions = interactions.filter(
        i => i.fromUser.toLowerCase() === followerAddress.toLowerCase() &&
             i.targetId === targetId &&
             i.targetType === TargetType.USER &&
             (i.interactionType === InteractionType.FOLLOW || 
              i.interactionType === InteractionType.UNFOLLOW)
      );
      
      // Sort by timestamp (oldest first)
      followInteractions.sort((a, b) => a.timestamp - b.timestamp);
      
      // Get last interaction
      const lastInteraction = followInteractions[followInteractions.length - 1];
      
      return lastInteraction?.interactionType === InteractionType.FOLLOW;
    } catch (error) {
      console.error('❌ [V3] Failed to check follow status:', error);
      return false;
    }
  }

  /**
   * Get follower count for a user
   */
  async getFollowerCount(userAddress: string): Promise<number> {
    try {
      const interactions = await this.getAllInteractions();
      
      // Convert address to targetId
      const targetId = parseInt(userAddress.slice(2, 18), 16);
      
      // Filter follow/unfollow interactions for this user
      const followInteractions = interactions.filter(
        i => i.targetId === targetId &&
             i.targetType === TargetType.USER &&
             (i.interactionType === InteractionType.FOLLOW || 
              i.interactionType === InteractionType.UNFOLLOW)
      );
      
      // Track follow state per follower
      const followState = new Map<string, boolean>();
      
      // Sort by timestamp (oldest first)
      followInteractions.sort((a, b) => a.timestamp - b.timestamp);
      
      for (const interaction of followInteractions) {
        const follower = interaction.fromUser.toLowerCase();
        if (interaction.interactionType === InteractionType.FOLLOW) {
          followState.set(follower, true);
        } else if (interaction.interactionType === InteractionType.UNFOLLOW) {
          followState.set(follower, false);
        }
      }
      
      // Count active followers
      const count = Array.from(followState.values()).filter(isFollowing => isFollowing).length;
      
      // Removed verbose logging - use debug tools if needed
      return count;
    } catch (error) {
      console.error('❌ [V3] Failed to get follower count:', error);
      return 0;
    }
  }

  /**
   * Get following count for a user
   */
  async getFollowingCount(userAddress: string): Promise<number> {
    try {
      const interactions = await this.getAllInteractions();
      
      // Filter follow/unfollow interactions by this user
      const followInteractions = interactions.filter(
        i => i.fromUser.toLowerCase() === userAddress.toLowerCase() &&
             i.targetType === TargetType.USER &&
             (i.interactionType === InteractionType.FOLLOW || 
              i.interactionType === InteractionType.UNFOLLOW)
      );
      
      // Track follow state per target
      const followState = new Map<number, boolean>();
      
      // Sort by timestamp (oldest first)
      followInteractions.sort((a, b) => a.timestamp - b.timestamp);
      
      for (const interaction of followInteractions) {
        if (interaction.interactionType === InteractionType.FOLLOW) {
          followState.set(interaction.targetId, true);
        } else if (interaction.interactionType === InteractionType.UNFOLLOW) {
          followState.set(interaction.targetId, false);
        }
      }
      
      // Count active follows
      const count = Array.from(followState.values()).filter(isFollowing => isFollowing).length;
      
      // Removed verbose logging - use debug tools if needed
      return count;
    } catch (error) {
      console.error('❌ [V3] Failed to get following count:', error);
      return 0;
    }
  }

  /**
   * Get list of followers for a user
   */
  async getFollowers(userAddress: string): Promise<string[]> {
    try {
      const interactions = await this.getAllInteractions();
      
      // Convert address to targetId
      const targetId = parseInt(userAddress.slice(2, 18), 16);
      
      // Filter follow/unfollow interactions for this user
      const followInteractions = interactions.filter(
        i => i.targetId === targetId &&
             i.targetType === TargetType.USER &&
             (i.interactionType === InteractionType.FOLLOW || 
              i.interactionType === InteractionType.UNFOLLOW)
      );
      
      // Track follow state per follower
      const followState = new Map<string, boolean>();
      
      // Sort by timestamp (oldest first)
      followInteractions.sort((a, b) => a.timestamp - b.timestamp);
      
      for (const interaction of followInteractions) {
        const follower = interaction.fromUser.toLowerCase();
        if (interaction.interactionType === InteractionType.FOLLOW) {
          followState.set(follower, true);
        } else if (interaction.interactionType === InteractionType.UNFOLLOW) {
          followState.set(follower, false);
        }
      }
      
      // Get active followers
      const followers = Array.from(followState.entries())
        .filter(([_, isFollowing]) => isFollowing)
        .map(([follower, _]) => follower);
      
      console.log('👥 [V3] Followers for', userAddress, ':', followers.length);
      return followers;
    } catch (error) {
      console.error('❌ [V3] Failed to get followers:', error);
      return [];
    }
  }

  /**
   * Get list of users that a user is following
   */
  async getFollowing(userAddress: string): Promise<string[]> {
    try {
      const interactions = await this.getAllInteractions();
      
      // Filter follow/unfollow interactions by this user
      const followInteractions = interactions.filter(
        i => i.fromUser.toLowerCase() === userAddress.toLowerCase() &&
             i.targetType === TargetType.USER &&
             (i.interactionType === InteractionType.FOLLOW || 
              i.interactionType === InteractionType.UNFOLLOW)
      );
      
      // Track follow state per target (use content field which stores full address)
      const followState = new Map<string, boolean>();
      
      // Sort by timestamp (oldest first)
      followInteractions.sort((a, b) => a.timestamp - b.timestamp);
      
      for (const interaction of followInteractions) {
        const targetAddress = interaction.content.toLowerCase(); // Full address stored in content
        if (interaction.interactionType === InteractionType.FOLLOW) {
          followState.set(targetAddress, true);
        } else if (interaction.interactionType === InteractionType.UNFOLLOW) {
          followState.set(targetAddress, false);
        }
      }
      
      // Get active follows
      const following = Array.from(followState.entries())
        .filter(([_, isFollowing]) => isFollowing)
        .map(([target, _]) => target);
      
      console.log('👥 [V3] Following for', userAddress, ':', following.length);
      return following;
    } catch (error) {
      console.error('❌ [V3] Failed to get following:', error);
      return [];
    }
  }

  // ===== ACTIVITY HISTORY OPERATIONS (NEW) =====

  /**
   * Record activity to history
   */
  async recordActivity(activityData: Partial<ActivityHistoryData>): Promise<string> {
    await this.ensureInitialized();
    
    try {
      console.log('📝 [V3] Recording activity:', activityData);

      const schemaId = await this.getSchemaIdCached('activityHistory' as any);
      const schemaEncoder = new SchemaEncoder(SOMNIA_CONFIG_V3.schemaStrings.activityHistory);

      const timestamp = activityData.timestamp || Date.now();
      const activityId = activityData.id || timestamp;

      const encodedData = schemaEncoder.encodeData([
        { name: 'id', value: activityId.toString(), type: 'uint256' },
        { name: 'timestamp', value: timestamp.toString(), type: 'uint256' },
        { name: 'user', value: activityData.user || '', type: 'address' },
        { name: 'activityType', value: (activityData.activityType ?? 0).toString(), type: 'uint8' },
        { name: 'title', value: activityData.title || '', type: 'string' },
        { name: 'description', value: activityData.description || '', type: 'string' },
        { name: 'targetId', value: (activityData.targetId || 0).toString(), type: 'uint256' },
        { name: 'targetAddress', value: activityData.targetAddress || '0x0000000000000000000000000000000000000000', type: 'address' },
        { name: 'txHash', value: activityData.txHash || '', type: 'string' },
        { name: 'metadata', value: activityData.metadata || '{}', type: 'string' },
      ]);

      const activityIdHex = numberToBytes32(activityId);

      await transactionQueue.enqueue(async () => {
        const txHash = await this.sdk!.streams.set([{
          schemaId,
          id: activityIdHex,
          data: encodedData,
        }]);
        
        console.log('✅ [V3] Activity recorded:', txHash);
        return txHash;
      });
      
      return activityId.toString();
    } catch (error) {
      console.error('❌ [V3] Failed to record activity:', error);
      throw error;
    }
  }

  /**
   * Get activity history for a user
   */
  async getActivityHistory(userAddress: string, limit: number = 50): Promise<ActivityHistoryData[]> {
    await this.ensureInitialized();

    try {
      console.log('📚 [V3] Loading activity history for:', userAddress);

      const privateKey = import.meta.env.VITE_PRIVATE_KEY;
      const publisher = privateKey ? privateKeyToAccount(privateKey as `0x${string}`).address : null;
      
      if (!publisher) {
        throw new Error('Publisher address not found');
      }

      const schemaId = await this.getSchemaIdCached('activityHistory' as any);
      const rawData = await this.sdk!.streams.getAllPublisherDataForSchema(schemaId, publisher);

      if (!rawData || rawData.length === 0) {
        console.log('📭 [V3] No activity found');
        return [];
      }

      const safeExtractValue = (item: any, defaultValue: any = '') => {
        if (!item) return defaultValue;
        if (item.value !== undefined) {
          if (typeof item.value === 'object' && item.value.value !== undefined) {
            return item.value.value;
          }
          return item.value;
        }
        return item;
      };

      const safeString = (value: any, defaultValue: string = ''): string => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return defaultValue;
        return String(value);
      };

      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'object') return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
      };

      const activities: ActivityHistoryData[] = rawData
        .map((item: any) => {
          const id = safeNumber(safeExtractValue(item[0]));
          const timestamp = safeNumber(safeExtractValue(item[1]));
          const user = safeString(safeExtractValue(item[2]));
          const activityType = safeNumber(safeExtractValue(item[3]), 0);
          const title = safeString(safeExtractValue(item[4]));
          const description = safeString(safeExtractValue(item[5]));
          const targetId = safeNumber(safeExtractValue(item[6]), 0);
          const targetAddress = safeString(safeExtractValue(item[7]), '0x0000000000000000000000000000000000000000');
          const txHash = safeString(safeExtractValue(item[8]));
          const metadata = safeString(safeExtractValue(item[9]), '{}');
          
          return {
            id,
            timestamp,
            user,
            activityType: activityType as ActivityHistoryType,
            title,
            description,
            targetId,
            targetAddress,
            txHash,
            metadata,
          };
        })
        .filter((activity: ActivityHistoryData) => 
          activity.user.toLowerCase() === userAddress.toLowerCase()
        )
        .sort((a: ActivityHistoryData, b: ActivityHistoryData) => b.timestamp - a.timestamp)
        .slice(0, limit);

      console.log(`✅ [V3] Loaded ${activities.length} activities`);
      return activities;
    } catch (error: any) {
      if (error?.message?.includes('NoData()')) {
        console.log('📭 [V3] No activity found (NoData)');
        return [];
      }
      console.error('❌ [V3] Failed to load activity:', error);
      return [];
    }
  }

  // ===== GENERIC DATA METHODS (for BXP and Quest systems) =====

  /**
   * Generic write data method
   * Note: This is a simplified implementation for BXP/Quest systems
   * For production use, implement proper schema encoding
   */
  async writeData(schemaId: Hex, data: Record<string, any>): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.sdk || !this.walletClient) {
      throw new Error('SDK or wallet not initialized');
    }

    try {
      console.log(`📝 [V3] Writing data to schema ${schemaId}...`);
      
      // Get schema string for encoding
      const schemaString = this.getSchemaStringById(schemaId);
      if (!schemaString) {
        throw new Error(`Schema string not found for schemaId: ${schemaId}`);
      }
      
      // Encode data using SchemaEncoder
      const schemaEncoder = new SchemaEncoder(schemaString);
      const encodedData = this.encodeDataForSchema(schemaEncoder, data, schemaString);
      
      // Generate unique data ID
      const dataId = stringToHex(`data_${Date.now()}_${Math.random().toString(36).slice(2)}`, { size: 32 });
      
      // Write to datastream using set()
      const txHash = await this.sdk!.streams.set([{
        id: dataId,
        schemaId: schemaId,
        data: encodedData
      }]);
      
      console.log(`✅ [V3] Data written successfully to schema ${schemaId}, tx: ${txHash}`);
    } catch (error) {
      console.error('❌ [V3] Failed to write data:', error);
      throw error;
    }
  }

  /**
   * Generic query data method
   */
  async queryData(
    schemaId: Hex,
    filter?: Record<string, any>
  ): Promise<any[]> {
    await this.ensureInitialized();
    
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    try {
      console.log(`🔍 [V3] Querying data from schema ${schemaId}...`);
      
      const privateKey = import.meta.env.VITE_PRIVATE_KEY;
      const publisher = privateKey ? privateKeyToAccount(privateKey as `0x${string}`).address : null;
      
      if (!publisher) {
        throw new Error('Publisher address not found');
      }

      // Get all data for this schema
      const allData = await this.sdk!.streams.getAllPublisherDataForSchema(schemaId, publisher);
      
      // If no filter, return all
      if (!filter) {
        console.log(`✅ [V3] Found ${allData?.length || 0} records`);
        return allData || [];
      }

      // Apply filter (simple implementation)
      const filtered = allData?.filter((item: any) => {
        for (const [key, value] of Object.entries(filter)) {
          if (item[key] !== value) {
            return false;
          }
        }
        return true;
      });

      console.log(`✅ [V3] Found ${filtered?.length || 0} filtered records`);
      return filtered || [];
    } catch (error: any) {
      if (error?.message?.includes('NoData()')) {
        console.log('📭 [V3] No data found');
        return [];
      }
      console.error('❌ [V3] Failed to query data:', error);
      return [];
    }
  }
}

// Export singleton instance
export const somniaDatastreamServiceV3 = new SomniaDatastreamServiceV3();
export default somniaDatastreamServiceV3;
