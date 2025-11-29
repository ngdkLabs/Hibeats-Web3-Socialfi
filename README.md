# HiBeats - AI-Powered Music NFT Platform

![Built on Somnia](https://img.shields.io/badge/Built%20on-Somnia-blueviolet?style=for-the-badge&logo=ethereum)
![AI Powered](https://img.shields.io/badge/AI-Powered-lightblue?style=for-the-badge&logo=openai)
![License MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge)

## Project Demo
[Go to site](https://www.hibeats.xyz/)

<img width="1918" height="921" alt="Screenshot 2025-09-27 165912" src="https://github.com/user-attachments/assets/ba7f5ada-f2fb-4059-943a-277e4d6870a7" />

---

# Overview

## Introduction to HiBeats

HiBeats is a next-generation SocialFi platform that converges AI-powered music generation, NFT marketplace infrastructure, and decentralized social networking into a unified Web3 ecosystem. Built on Somnia's high-performance blockchain, HiBeats empowers creators to generate, monetize, and distribute music through a permissionless, community-driven economy.

The platform addresses critical inefficiencies in the traditional music industry: centralized gatekeeping, opaque revenue distribution, and limited creator ownership. By integrating advanced AI music generation with blockchain-native primitives, HiBeats enables anyone to produce professional-grade compositions from text prompts and instantly tokenize them as tradeable NFTs—eliminating intermediaries and ensuring transparent, programmable royalties.

HiBeats leverages Somnia's sub-second finality and Data Streams technology to deliver Web2-level user experience with Web3 ownership guarantees. The architecture combines on-chain smart contracts for asset management and marketplace operations with real-time data synchronization for social features, creating a seamless environment where creators can build audiences, engage communities, and capture value directly from their work.

At its core, HiBeats is designed for composability and interoperability, providing open APIs, standardized NFT metadata, and cross-platform compatibility that position it as infrastructure for the future of decentralized music creation and distribution.

## What Is HiBeats?

HiBeats is a decentralized SocialFi protocol for AI-generated music, combining generative AI infrastructure, NFT marketplace mechanics, and social graph primitives to create a permissionless music economy. The platform enables creators to generate professional music compositions through natural language prompts, tokenize them as ERC-721 NFTs, and distribute them through an open marketplace with programmable royalties and community-driven discovery.

The protocol architecture consists of three core layers:

**Generation Layer**: Multi-model AI engine (V3.5, V4, V4.5) supporting custom lyrics, instrumental modes, and style parameters, with generation times optimized between 30-180 seconds depending on quality requirements.

**Asset Layer**: Smart contract infrastructure on Somnia blockchain managing NFT minting, ownership transfers, marketplace listings, and automated royalty distribution with sub-second transaction finality.

**Social Layer**: Real-time data synchronization via Somnia Data Streams enabling social posts, interactions, encrypted messaging, playlist management, and the BeatsXP (BXP) gamification system—all with Web2-level latency (15-100ns read/write).

HiBeats operates as a fully decentralized protocol where users maintain custody of their assets, control their data, and participate in an open economy without platform lock-in or centralized intermediaries.

### Key Technologies

- **Somnia Blockchain**: High-performance EVM-compatible blockchain with sub-second finality
- **Somnia Data Streams**: Real-time data synchronization for social features and interactions
- **Sequence Wallet**: Seamless Web3 wallet integration with gasless transaction support
- **AI Music Engine**: Advanced AI music generation with multiple model versions
- **IPFS**: Decentralized storage for music files and metadata

## Key Features

### AI-Powered Music Generation

HiBeats facilitates professional music creation using advanced AI technology without the need for traditional music production skills or expensive equipment. Users can input creative prompts and generate unique compositions across multiple genres using:

- **V3.5**: Balanced quality and speed (30-90 seconds generation time)
- **V4**: Enhanced features and better quality (45-120 seconds)
- **V4.5**: Latest model with best quality (60-180 seconds)

Features include custom lyrics support, instrumental mode, style customization, and vocal gender selection.

### Seamless NFT Minting and Marketplace Trading

HiBeats leverages blockchain technology to securely transform generated music into tradeable NFTs using smart contracts that ensure ownership authenticity, royalty distribution, and marketplace transparency through automated protocols.

### Real-Time Social Features with Somnia Data Streams

The platform integrates Somnia Data Streams for real-time social interactions including:

- **Social Posts**: Create, like, comment, and repost content
- **Live Indicators**: Real-time typing indicators and online status
- **Notifications**: Instant notifications for mentions, tips, and interactions
- **Encrypted Messaging**: Secure direct messaging between users

### BeatsXP (BXP) Reward System

A comprehensive gamification system that rewards user engagement:

- XP rewards for music generation, listening, and social interactions
- Daily and weekly XP caps to ensure fair distribution
- Streak bonuses for consecutive daily activity
- Leaderboards and achievements
- Level progression system

### Playlist Management

Full-featured playlist system with:

- Create, edit, and delete playlists
- Add/remove tracks with optimistic updates
- Collaborative playlists with multiple editors
- Social features (follow, like, play counts)
- Multi-publisher support for decentralized data

### Tipping System

Support creators directly with STT tokens:

- Tip posts, tracks, albums, or artists
- Real-time balance updates
- Tip statistics and leaderboards
- Background notification processing

---

# Technical Architecture

## Smart Contract Ecosystem

HiBeats deploys a comprehensive smart contract ecosystem on Somnia Testnet (Chain ID: 50312):

### Deployed Contracts

| Contract | Address | Function |
|----------|---------|----------|
| **UserProfile** | `0x6aD6eBc95116A81CB89FCB2676E829b5dabF7536` | Creator profile and social features |
| **SongNFT** | `0xc9Ab73b5f988826943e4f63E89ed0841757CBD6c` | Music NFT minting and ownership |
| **AlbumManager** | `0x94892b8E7CC63E0C5E5eE7ce27D4E7588CbAf864` | Album creation and management |
| **Marketplace** | `0xe62Dc8113C77bDA6b13Eebb86f3453C4df5399e2` | NFT trading and price discovery |
| **TippingSystem** | `0xD6CAA4722083afFdBE54949E39C46C164ad1a370` | Creator tipping functionality |

**Note:** Playlists, social posts, messaging, and BXP rewards are managed via Somnia Data Streams (not smart contracts) for real-time performance.

### Somnia Data Streams Integration

Real-time data synchronization using Somnia's native Data Streams:

- **Datastream Contract**: ``
- **WebSocket Support**: `wss://dream-rpc.somnia.network/ws`
- **Polling Interval**: 100ms for sub-second finality

---

## How Somnia Data Streams (SDS) Was Used

HiBeats leverages Somnia Data Streams as the core infrastructure for all real-time social features, achieving Web2-level performance (15-100ns read/write latency) while maintaining Web3 decentralization guarantees. SDS replaces traditional smart contracts for high-frequency operations where gas costs and transaction latency would create poor user experience.

### Why SDS Over Smart Contracts?

| Feature | Smart Contracts | Somnia Data Streams |
|---------|----------------|---------------------|
| **Write Latency** | 400-1000ms | 15-100ns |
| **Read Latency** | RPC call (~100ms) | 15-100ns (IceDB) |
| **Gas Costs** | Per transaction | Zero (native protocol) |
| **Throughput** | Limited by block gas | 400,000+ TPS |
| **Use Case** | Asset ownership, transfers | Social interactions, real-time data |

### SDS Implementation Architecture

```typescript
// Core SDS Service Integration
import { SomniaDatastreamService } from '@/services/somniaDatastreamService';

const datastreamService = new SomniaDatastreamService({
  rpcUrl: 'https://dream-rpc.somnia.network',
  wsUrl: 'wss://dream-rpc.somnia.network/ws',
  pollingInterval: 100, // Sub-second finality
  enableMultiPublisher: true // Decentralized data redundancy
});
```

### Real-World SDS Use Cases in HiBeats

#### 1. Social Posts & Interactions (V6 Schema)

**Problem Solved**: Traditional social media requires centralized databases. On-chain storage via smart contracts is too expensive and slow for high-frequency interactions.

**SDS Solution**: Posts, likes, comments, and reposts are written to `hibeats_posts_v6` and `hibeats_

## Somnia Data Streams Schema Implementation

HiBeats implements a comprehensive V6 schema system optimized for Web2-level performance on Web3, leveraging Somnia's IceDB with 15-100ns read/write latency.

### Core Schemas (V6 - Production Ready)

#### 1. Posts Schema (`hibeats_posts_v6`)

Full SocialFi features with monetization support:

```solidity
uint256 id,              // Timestamp-based unique ID
uint256 timestamp,       // Unix timestamp
string content,          // Post text content
uint8 contentType,       // 0=TEXT, 1=IMAGE, 2=VIDEO, 3=MUSIC, 4=QUOTE
string mediaHashes,      // Comma-separated IPFS hashes
address author,          // User address
uint256 quotedPostId,    // Referenced post ID (0 if not quote)
uint256 replyToId,       // Reply to post ID (threading support)
string mentions,         // Comma-separated mentioned addresses
address collectModule,   // Smart contract for collect logic
uint256 collectPrice,    // Price in wei to collect
uint32 collectLimit
,     // Max collects (0 = unlimited)
uint32 collectCount,     // Current collect count
bool isGated,            // Content locked behind payment
address referrer,        // Referral address for revenue sharing
uint32 nftTokenId,       // NFT token ID (0 if not NFT)
bool isDeleted,          // Soft delete flag
bool isPinned            // Pinned to profile
```

#### 2. Interactions Schema (`hibeats_interactions_v6`)

Enhanced with tipping and comprehensive interaction types:

```solidity
uint256 id,              // Deterministic ID for deduplication
uint256 timestamp,       // Unix timestamp
uint8 interactionType,   // Enum: LIKE, UNLIKE, COMMENT, REPOST, etc.
uint256 targetId,        // Target post/comment ID
uint8 targetType,        // 0=POST, 1=COMMENT, 2=USER, 3=ALBUM, 4=SONG, 5=PLAYLIST
address fromUser,        // User address
string content,          // Comment text (empty for likes)
uint256 parentId,        // Parent comment ID (0 for top-level)
uint256 tipAmount        // Tip amount in wei
```

**Interaction Types:**
| Type | Value | Description |
|------|-------|-------------|
| LIKE | 0 | Like a post/song |
| UNLIKE | 1 | Remove like |
| COMMENT | 2 | Add comment |
| REPOST | 3 | Repost content |
| UNREPOST | 4 | Remove repost |
| DELETE | 5 | Delete content |
| BOOKMARK | 6 | Save to bookmarks |
| UNBOOKMARK | 7 | Remove bookmark |
| TIP | 8 | Tip creator |
| COLLECT | 9 | Collect/mint as NFT |
| FOLLOW | 11 | Follow user |
| UNFOLLOW | 12 | Unfollow user |

#### 3. Profiles Schema (`hibeats_profiles_v6`)

Cached user profiles for fast lookups:

```solidity
address userAddress,     // Primary key
string username,         // Unique username
string displayName,      // Display name
string bio,              // User bio
string avatarHash,       // IPFS hash for avatar
uint32 followerCount,    // Cached follower count
uint32 followingCount,   // Cached following count
bool isVerified,         // Verified badge
bool isArtist            // Artist badge
```

#### 4. Generated Music Schema (`hibeats_generated_music_v1`)

Backup for failed mint recovery:

```solidity
uint256 id,              // Timestamp-based ID
uint256 timestamp,       // Unix timestamp
address owner,           // User who generated
string taskId,           // AI task ID
string title,            // Song title
string audioUrl,         // IPFS/direct URL to audio
string imageUrl,         // IPFS/direct URL to cover
string prompt,           // Generation prompt
string style,            // Music style/genre
string lyrics,           // Song lyrics
uint8 status             // 0=PENDING, 1=COMPLETED, 2=MINTED, 3=FAILED
```

#### 5. Play Events Schema (`hibeats_play_events_v1`)

For play count tracking and trending algorithm:

```solidity
uint256 id,              // Unique event ID
uint256 timestamp,       // Unix timestamp
uint32 tokenId,          // NFT token ID
address listener,        // User who played
uint32 duration,         // Play duration in seconds
string source            // Source: feed, collection, album, etc.
```

#### 6. Activity History Schema (`hibeats_activity_history_v1`)

Wallet activity tracking:

```solidity
uint256 id,              // Unique ID
uint256 timestamp,       // Unix timestamp
address user,            // User address
uint8 activityType,      // MINT, TRANSFER, SALE, PURCHASE, etc.
string title,            // Activity title
string description,      // Activity description
uint256 targetId,        // Target ID (tokenId, postId, etc.)
address targetAddress,   // Target address
string txHash,           // Transaction hash
string metadata          // JSON metadata
```

#### 7. Playlist Schema (Somnia Data Streams)

**Note:** Playlists are managed via Somnia Data Streams SDK, not smart contracts.

```solidity
uint64 timestamp,        // Unix timestamp
uint256 playlistId,      // Unique playlist ID
address owner,           // Playlist owner
string title,            // Playlist title
string description,      // Playlist description
string coverHash,        // IPFS hash for cover image
string trackIds,         // Comma-separated track IDs
bool isPublic,           // Public/private visibility
bool isDeleted           // Soft delete flag
```

**Features:**
- Multi-publisher support for decentralized data
- Optimistic updates for instant UI feedback
- Collaborative playlists with multiple editors
- Social features (follow, like, play counts)

#### 8. Messaging Schemas V2 (Somnia Data Streams)

**Direct Messages:**
```solidity
bytes32 messageId,       // Unique message ID
uint64 timestamp,        // Unix timestamp
bytes32 conversationId,  // Conversation ID
string content,          // Message content
address sender,          // Sender address
address recipient,       // Recipient address
uint8 messageType,       // TEXT, IMAGE, VIDEO, etc.
string mediaUrl,         // Media URL (if any)
bytes32 replyToMessageId, // Reply reference
bool isRead,             // Read status
bool isDeleted,          // Deleted flag
bool isEdited,           // Edited flag
uint64 editedAt          // Edit timestamp
```

**Conversations:**
```solidity
bytes32 conversationId,  // Unique conversation ID
address participant1,    // First participant
address participant2,    // Second participant
uint64 lastMessageTime,  // Last message timestamp
uint64 createdAt,        // Creation timestamp
bool isArchived,         // Archive status
bool isMuted,            // Mute status
bool isPinned,           // Pin status
uint32 unreadCount       // Unread message count
```

**Typing Indicators:**
```solidity
bytes32 conversationId,  // Conversation ID
address user,            // User address
bool isTyping,           // Typing status
uint64 timestamp         // Timestamp
```

**User Presence:**
```solidity
address user,            // User address
uint8 status,            // OFFLINE, ONLINE, AWAY, BUSY
uint64 lastSeen,         // Last seen timestamp
string statusMessage,    // Custom status message
bool isOnline            // Online flag
```

**Message Types Supported:**
- TEXT (0), IMAGE (1), VIDEO (2), AUDIO (3), FILE (4)
- LINK (5), GIF (6), STICKER (7), LOCATION (8)
- CONTACT (9), POLL (10), NFT (11), TOKEN_TRANSFER (12)
- VOICE_NOTE (13), STORY_REPLY (14), MUSIC_TRACK (15)

### BeatsXP (BXP) Schemas

#### BXP Transactions (`hibeats_bxp_transactions_v1`)

```typescript
{
  id: string,            // Unique transaction ID
  userAddress: string,   // User wallet address
  amount: number,        // XP amount (after multipliers)
  baseAmount: number,    // Base XP before multipliers
  type: string,          // Reward type
  multiplier: number,    // Total multiplier applied
  timestamp: number,     // Unix timestamp
  metadata: string,      // JSON additional data
  dailyTotal: number,    // Running daily total
  weeklyTotal: number    // Running weekly total
}
```

#### BXP Profiles (`hibeats_bxp_profiles_v1`)

```typescript
{
  userAddress: string,   // Primary key
  totalXP: number,       // Total lifetime XP
  level: number,         // Current level
  dailyXP: number,       // XP earned today
  weeklyXP: number,      // XP earned this week
  monthlyXP: number,     // XP earned this month
  streak: number,        // Current daily streak
  longestStreak: number, // Longest streak achieved
  lastActivityDate: string, // YYYY-MM-DD
  multipliers: string,   // JSON array of active multipliers
  achievements: string,  // JSON array of achievement IDs
  rank: number,          // Global rank
  updatedAt: number      // Last update timestamp
}
```

#### BXP Quests (`hibeats_bxp_quests_v1`)

```typescript
{
  id: string,            // Quest ID
  userAddress: string,   // User wallet address
  questType: string,     // daily, weekly, monthly
  questName: string,     // Quest name
  description: string,   // Quest description
  targetValue: number,   // Target to complete
  currentValue: number,  // Current progress
  reward: number,        // XP reward
  completed: boolean,    // Completion status
  claimedAt: number,     // Claim timestamp
  expiresAt: number,     // Expiration timestamp
  createdAt: number      // Creation timestamp
}
```

#### BXP Leaderboard (`hibeats_bxp_leaderboard_v1`)

```typescript
{
  userAddress: string,   // User wallet address
  totalXP: number,       // Total XP for ranking
  level: number,         // Current level
  rank: number,          // Current rank
  previousRank: number,  // Previous rank
  period: string,        // all_time, monthly, weekly
  updatedAt: number      // Last update timestamp
}
```



## Subgraph Implementation

HiBeats uses The Graph protocol for indexing on-chain NFT and trading data, while social features are handled by Somnia Data Streams.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    HiBeats Data Layer                       │
├─────────────────────────────┬───────────────────────────────┤
│   Somnia Data Streams       │         Subgraph              │
│   (Real-time Social)        │    (NFT & Trading)            │
├─────────────────────────────┼───────────────────────────────┤
│ • Posts & Comments          │ • Song NFT Metadata           │
│ • Likes & Reposts           │ • Album Management            │
│ • Follows & Bookmarks       │ • Marketplace Listings        │
│ • Play Events               │ • Sales & Transfers           │
│ • BXP Rewards               │ • On-chain Tips               │
│ • Live Indicators           │ • Price History               │
│ • Notifications             │ • Trading Analytics           │
└─────────────────────────────┴───────────────────────────────┘
```

### Subgraph Entities

#### User Profile Entity

```graphql
type UserProfile @entity {
  id: ID!                          # User address
  beatsId: BigInt!                 # Unique numeric identifier
  username: String!
  displayName: String!
  bio: String
  avatarHash: String
  bannerHash: String
  isVerified: Boolean!
  isArtist: Boolean!
  reputationScore: BigInt!
  createdAt: BigInt!
  updatedAt: BigInt!
  
  # Relations
  songs: [Song!]! @derivedFrom(field: "artist")
  ownedSongs: [Song!]! @derivedFrom(field: "owner")
  albums: [Album!]! @derivedFrom(field: "artist")
  songsSold: [SongSale!]! @derivedFrom(field: "seller")
  songsBought: [SongSale!]! @derivedFrom(field: "buyer")
  tipsGiven: [Tip!]! @derivedFrom(field: "tipper")
  tipsReceived: [Tip!]! @derivedFrom(field: "recipient")
}
```

#### Song NFT Entity

```graphql
type Song @entity {
  id: ID!                          # Token ID
  tokenId: BigInt!
  artist: UserProfile!
  owner: UserProfile!
  title: String!
  description: String
  genre: String
  audioHash: String!               # IPFS hash
  coverHash: String
  duration: BigInt!
  price: BigInt!
  royaltyPercentage: BigInt!
  transferCount: BigInt!
  isListed: Boolean!
  createdAt: BigInt!
  
  # Relations
  transfers: [SongTransfer!]! @derivedFrom(field: "song")
  sales: [SongSale!]! @derivedFrom(field: "song")
  listings: [SongListing!]! @derivedFrom(field: "song")
  tips: [Tip!]! @derivedFrom(field: "song")
  dailyStats: [SongDailyStats!]! @derivedFrom(field: "song")
}
```

#### Album Entity

```graphql
type Album @entity {
  id: ID!
  albumId: BigInt!
  artist: UserProfile!
  title: String!
  description: String
  coverImageHash: String
  albumType: AlbumType!            # SINGLE, EP, ALBUM
  songCount: BigInt!
  createdAt: BigInt!
  releaseDate: BigInt
  isPublished: Boolean!
  songs: [AlbumSong!]! @derivedFrom(field: "album")
}
```

#### Marketplace Entities

```graphql
type SongListing @entity {
  id: ID!
  song: Song!
  seller: UserProfile!
  price: BigInt!
  isActive: Boolean!
  listedAt: BigInt!
  expiresAt: BigInt
  soldAt: BigInt
  buyer: UserProfile
}

type SongSale @entity(immutable: true) {
  id: ID!
  song: Song!
  seller: UserProfile!
  buyer: UserProfile!
  price: BigInt!
  royaltyPaid: BigInt!
  platformFee: BigInt!
  sellerProceeds: BigInt!
  timestamp: BigInt!
}
```

#### Analytics Entities

```graphql
type UserNFTStats @entity {
  id: ID!
  user: UserProfile!
  songsOwned: BigInt!
  songsCreated: BigInt!
  albumsCreated: BigInt!
  songsSold: BigInt!
  songsBought: BigInt!
  totalSalesVolume: BigInt!
  totalRoyaltiesEarned: BigInt!
  activeListings: BigInt!
  highestSalePrice: BigInt!
  averageSalePrice: BigInt!
}

type TrendingSong @entity {
  id: ID!
  song: Song!
  period: String!                  # daily, weekly, monthly
  sales: BigInt!
  volume: BigInt!
  tips: BigInt!
  trendingScore: BigInt!
  rank: BigInt!
  previousRank: BigInt!
  rankChange: BigInt!
}

type PlatformStats @entity {
  id: ID!                          # "global"
  totalUsers: BigInt!
  totalArtists: BigInt!
  totalSongs: BigInt!
  totalAlbums: BigInt!
  totalSales: BigInt!
  totalVolume: BigInt!
  totalRoyalties: BigInt!
  activeListings: BigInt!
  sales24h: BigInt!
  volume24h: BigInt!
}
```

### Data Flow

| Data Type | Source | Storage |
|-----------|--------|---------|
| Social Posts | User Action | Somnia Data Streams |
| Likes/Comments | User Action | Somnia Data Streams |
| Play Events | Music Player | Somnia Data Streams |
| BXP Rewards | System | Somnia Data Streams |
| NFT Minting | Smart Contract | Subgraph |
| NFT Sales | Smart Contract | Subgraph |
| Marketplace Listings | Smart Contract | Subgraph |
| On-chain Tips | Smart Contract | Subgraph |
| Price History | Smart Contract | Subgraph |

### Query Examples

**Get User Profile with NFT Stats:**
```graphql
query GetUserProfile($address: ID!) {
  userProfile(id: $address) {
    username
    displayName
    isArtist
    isVerified
    nftStats {
      songsOwned
      songsCreated
      totalSalesVolume
      totalRoyaltiesEarned
    }
    songs(first: 10, orderBy: createdAt, orderDirection: desc) {
      tokenId
      title
      price
      isListed
    }
  }
}
```

**Get Trending Songs:**
```graphql
query GetTrendingSongs($period: String!) {
  trendingSongs(
    where: { period: $period }
    orderBy: rank
    orderDirection: asc
    first: 100
  ) {
    song {
      tokenId
      title
      artist { username }
      coverHash
    }
    trendingScore
    rank
    rankChange
    sales
    volume
  }
}
```

**Get Platform Statistics:**
```graphql
query GetPlatformStats {
  platformStats(id: "global") {
    totalUsers
    totalArtists
    totalSongs
    totalSales
    totalVolume
    sales24h
    volume24h
    activeListings
  }
}
```
## Frontend Architecture

Built with modern React ecosystem:

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Wagmi + Viem** for blockchain interactions
- **Sequence Wallet** for Web3 authentication
- **TanStack Query** for data fetching and caching
- **Radix UI + Tailwind CSS** for UI components
- **Apollo Client** for GraphQL queries

### Key Services

| Service | Purpose |
|---------|---------|
| `musicGenerationService` | AI music generation engine |
| `playlistService` | Playlist CRUD with multi-publisher support |
| `tipService` | STT tipping with background processing |
| `bxpService` | BeatsXP rewards and gamification |
| `somniaDatastreamService` | Real-time data synchronization |
| `notificationService` | Push notifications and alerts |
| `encryptedMessagingService` | Secure direct messaging |

---

# Problems and Solutions

## Barriers to Music Creation

**Problem**: Music creation is often constrained by expensive equipment, complex software, and technical skills.

**HiBeats' Solution**: AI-powered music generation enables anyone to create professional-quality compositions from simple text prompts, removing the need for traditional production tools.

## Unfair Music Industry Monetization

**Problem**: Traditional music platforms suffer from unfair revenue distribution and high platform fees.

**HiBeats' Solution**: Blockchain-based NFT minting and direct peer-to-peer trading ensures creators maintain full ownership and receive fair compensation through automated royalty systems.

## Limited Music Discovery

**Problem**: Current platforms rely on algorithmic recommendations that limit music discovery.

**HiBeats' Solution**: Open, community-driven platform with social features, playlists, and trending discovery without algorithmic limitations.

## Inflexible Creator Monetization

**Problem**: Traditional platforms offer limited monetization options.

**HiBeats' Solution**: Multiple native monetization streams including NFT sales, tipping system, and community engagement rewards through the BXP system.

---

# How We Achieve AI-Powered Music Creation

<img width="1200" height="800" alt="hibeats-ai-music-flow" src="https://github.com/user-attachments/assets/467a3743-21f4-4749-9723-45dbcf34ca09" />

<img width="2678" height="1422" alt="diagram-export-9-27-2025-4_44_53-PM" src="https://github.com/user-attachments/assets/ce910e75-ed0a-497b-b202-eea63f41c564" />

### Music Generation Flow

1. **User Input**: Users enter creative prompts with style preferences, lyrics, and model selection
2. **AI Processing**: The AI engine processes the request using the selected model
3. **Real-time Tracking**: Generation status tracked via polling with exponential backoff
4. **NFT Minting**: Completed music automatically prepared for NFT minting
5. **Blockchain Storage**: Metadata stored on Somnia blockchain with IPFS for audio files

### Optimistic Updates

The platform uses optimistic UI updates for instant feedback:

```typescript
// Example: Playlist creation with optimistic update
const playlist = { id, owner, title, ... };
this.playlistCache.set(playlistId, playlist); // Immediate cache update
await this.writePlaylistToBlockchain(playlist); // Background write
```

---

# Platform Features

## Music Generation

- **AI Models**: V3.5, V4, V4.5
- **Custom Lyrics**: Support for user-provided lyrics
- **Instrumental Mode**: Generate music without vocals
- **Style Customization**: Genre, mood, and style parameters
- **Vocal Options**: Male/female vocal selection

## Social Features

- **User Profiles**: Customizable creator profiles
- **Social Feed**: Posts, likes, comments, reposts
- **Following System**: Follow favorite artists
- **Direct Messages**: Encrypted messaging
- **Notifications**: Real-time alerts

## Marketplace

- **NFT Trading**: Buy and sell music NFTs
- **Price Discovery**: Market-driven pricing
- **Royalty Distribution**: Automated creator compensation
- **Collection Management**: Organize owned NFTs

## Playlists

- **CRUD Operations**: Create, read, update, delete
- **Track Management**: Add/remove tracks
- **Collaboration**: Multi-editor support
- **Social Features**: Follow, like, share playlists

## Rewards (BXP)

- **Activity Rewards**: XP for engagement
- **Daily Caps**: Fair distribution limits
- **Streaks**: Bonus for consecutive activity
- **Leaderboards**: Competitive rankings
- **Achievements**: Milestone rewards

---

# Getting Started

## Prerequisites

- Node.js 18+
- npm or bun
- Sequence Wallet or compatible Web3 wallet

## Installation

```bash
# Clone the repository
git clone https://github.com/NGDK101/Hibeats--Somnia-Defi-Mini-Hackathon.git

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Start development server
npm run dev
```

## Environment Variables

```env
# Somnia Network
VITE_SOMNIA_RPC_URL=https://dream-rpc.somnia.network
VITE_SOMNIA_WS_URL=wss://dream-rpc.somnia.network/ws

# AI Music Generation
VITE_AI_API_KEY=your_ai_api_key

# Sequence Wallet
VITE_SEQUENCE_PROJECT_ACCESS_KEY=your_sequence_key

# Contract Addresses (auto-configured)
VITE_CONTRACT_USER_PROFILE=0x6aD6eBc95116A81CB89FCB2676E829b5dabF7536
VITE_CONTRACT_SONG_NFT=0xc9Ab73b5f988826943e4f63E89ed0841757CBD6c
```

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run verify:env   # Verify environment variables
npm run test:tip     # Test tipping system
npm run test:playlist # Test playlist features
```

---

# Network Information

## Somnia Testnet

| Property | Value |
|----------|-------|
| **Chain ID** | 50312 |
| **Network Name** | Somnia Testnet |
| **Native Currency** | STT (18 decimals) |
| **RPC URL** | https://dream-rpc.somnia.network |
| **WebSocket** | wss://dream-rpc.somnia.network/ws |
| **Block Explorer** | https://shannon-explorer.somnia.network |

---

## 🔗 Links

- 🌐 Website: [https://www.hibeats.xyz/](https://www.hibeats.xyz/)
- 🏢 Organization: [https://github.com/ngdkLabs/Hibeats-Web3-Socialfi/](https://github.com/ngdkLabs/Hibeats-Web3-Socialfi/)
- 📑 Documentation: [Comprehensive Documentation]()
- 🎥 Demo Video: [Platform Walkthrough](https://drive.google.com/drive/folders/1GRXqQw2aVn-GUDIRMctkXrcnAAhMlRvB)

---

## License

MIT License © 2025 HiBeats
