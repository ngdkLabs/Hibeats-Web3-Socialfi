import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, TrendingUp, Clock, Music, User, Disc, ListMusic, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { searchService, SearchResult } from "@/services/searchService";
import { searchAnalyticsService } from "@/services/searchAnalyticsService";
import { somniaDatastreamServiceV3 } from "@/services/somniaDatastreamService.v3";
import { useSequence } from "@/contexts/SequenceContext";

interface AdvancedSearchProps {
  onClose?: () => void;
}

const AdvancedSearch = ({ onClose }: AdvancedSearchProps) => {
  const navigate = useNavigate();
  const { smartAccountAddress } = useSequence();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'all' | 'tracks' | 'artists' | 'albums' | 'playlists' | 'users'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'relevance' | 'recent' | 'popular'>('relevance');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Initialize search service with SDK from SequenceContext
  useEffect(() => {
    const initSearch = async () => {
      try {
        // Get SDK from datastream service
        const sdk = await somniaDatastreamServiceV3.getSDK();
        if (sdk) {
          searchService.initialize(sdk);
          console.log('✅ Search service initialized with SDK');
        }
      } catch (error) {
        console.error('❌ Failed to initialize search service:', error);
      }
    };
    
    initSearch();
    
    // Load trending searches from analytics
    const trending = searchAnalyticsService.getTrendingSearches(8);
    if (trending.length > 0) {
      setTrendingSearches(trending);
    } else {
      // Fallback to default trending
      setTrendingSearches([
        "Lo-fi beats",
        "Chill vibes",
        "Electronic",
        "Hip hop",
        "Indie rock"
      ]);
    }
  }, []);

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  // Save search to history
  const saveToHistory = (query: string) => {
    if (!query.trim()) return;
    
    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  // Clear search history
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
  };

  // Perform search
  const performSearch = useCallback(async (query: string, category: string, sort: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    
    try {
      const searchResults = await searchService.search(query, {
        category: category as any,
        sortBy: sort as any,
        limit: 20
      });

      setResults(searchResults);
      
      // Track search analytics
      searchAnalyticsService.trackSearch(
        query,
        searchResults.length,
        category,
        smartAccountAddress || undefined
      );
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [smartAccountAddress]);

  // Debounced search effect
  useEffect(() => {
    if (debouncedSearch) {
      performSearch(debouncedSearch, activeTab, sortBy);
    } else {
      setResults([]);
    }
  }, [debouncedSearch, activeTab, sortBy, performSearch]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault();
        handleResultClick(results[selectedIndex], selectedIndex);
      } else if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const handleResultClick = (result: SearchResult, position: number) => {
    saveToHistory(searchQuery);
    
    // Track click analytics
    searchAnalyticsService.trackClick(
      searchQuery,
      result.id,
      result.type,
      position,
      smartAccountAddress || undefined
    );
    
    // Navigate based on result type
    switch (result.type) {
      case 'track':
        // Navigate to album if available, otherwise to feed
        if (result.albumId) {
          navigate(`/album/${result.albumId}`);
        } else {
          navigate(`/feed?track=${result.id}`);
        }
        break;
      case 'artist':
      case 'user':
        // Use username if available, otherwise wallet address
        const identifier = result.username || result.id;
        navigate(`/profile/${identifier}`);
        break;
      case 'album':
        navigate(`/album/${result.id}`);
        break;
      case 'playlist':
        navigate(`/playlist/${result.id}`);
        break;
    }
    
    onClose?.();
  };

  const handleHistoryClick = (query: string) => {
    setSearchQuery(query);
    inputRef.current?.focus();
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'track': return <Music className="w-4 h-4" />;
      case 'artist': return <User className="w-4 h-4" />;
      case 'album': return <Disc className="w-4 h-4" />;
      case 'playlist': return <ListMusic className="w-4 h-4" />;
      case 'user': return <User className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  const formatCount = (count?: number) => {
    if (!count) return '';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tracks, artists, albums, playlists, or users..."
          className="pl-12 pr-24 py-6 text-base rounded-2xl border-border/50 focus:border-primary bg-background shadow-lg"
          autoFocus
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setResults([]);
                inputRef.current?.focus();
              }}
              className="h-8 w-8 p-0 rounded-full hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          
          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-muted">
                <ArrowUpDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy('relevance')}>
                Relevance {sortBy === 'relevance' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('popular')}>
                Most Popular {sortBy === 'popular' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('recent')}>
                Most Recent {sortBy === 'recent' && '✓'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="mt-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="tracks">Tracks</TabsTrigger>
            <TabsTrigger value="artists">Artists</TabsTrigger>
            <TabsTrigger value="albums">Albums</TabsTrigger>
            <TabsTrigger value="playlists">Playlists</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Results Container */}
      <div className="mt-4 bg-background rounded-xl border border-border/50 shadow-lg max-h-[500px] overflow-y-auto custom-scrollbar">
        {!searchQuery ? (
          <div className="p-4">
            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Recent Searches
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </Button>
                </div>
                <div className="space-y-1">
                  {searchHistory.map((query, index) => (
                    <button
                      key={index}
                      onClick={() => handleHistoryClick(query)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-all duration-200 flex items-center gap-3 group"
                    >
                      <Clock className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-sm group-hover:text-foreground transition-colors">{query}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Searches */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Trending Searches
              </h3>
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((query, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => handleHistoryClick(query)}
                  >
                    {query}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-3">Searching...</p>
          </div>
        ) : results.length > 0 ? (
          <div ref={resultsRef} className="divide-y divide-border/30">
            {results.map((result, index) => (
              <button
                key={result.id}
                onClick={() => handleResultClick(result, index)}
                className={`w-full p-4 hover:bg-muted transition-all duration-200 flex items-center gap-4 group ${
                  selectedIndex === index ? 'bg-muted' : ''
                }`}
              >
                {/* Result Image */}
                <Avatar className="w-12 h-12 rounded-lg">
                  <AvatarImage src={result.image} />
                  <AvatarFallback className="rounded-lg bg-primary/10">
                    {getResultIcon(result.type)}
                  </AvatarFallback>
                </Avatar>

                {/* Result Info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium group-hover:text-primary transition-colors">{result.title}</h4>
                    {result.verified && <VerifiedBadge size="sm" />}
                  </div>
                  {result.subtitle && (
                    <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">{result.subtitle}</p>
                  )}
                </div>

                {/* Result Stats */}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant="outline" className="capitalize">
                    {result.type}
                  </Badge>
                  {result.plays && (
                    <span className="flex items-center gap-1">
                      <Music className="w-3 h-3" />
                      {formatCount(result.plays)}
                    </span>
                  )}
                  {result.followers && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {formatCount(result.followers)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
            <p className="text-xs text-muted-foreground mt-1">Try different keywords or check spelling</p>
            
            {/* Helpful tips */}
            <div className="mt-6 p-4 bg-muted rounded-lg text-left">
              <p className="text-xs font-semibold mb-2">💡 Tips:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Make sure songs/albums have been minted</li>
                <li>• Check if users have created profiles</li>
                <li>• Try searching in different categories</li>
                <li>• Use broader search terms</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="mt-3 text-xs text-muted-foreground text-center">
        <kbd className="px-2 py-1 bg-muted rounded">↑↓</kbd> to navigate •{' '}
        <kbd className="px-2 py-1 bg-muted rounded">Enter</kbd> to select •{' '}
        <kbd className="px-2 py-1 bg-muted rounded">Esc</kbd> to close
      </div>
    </div>
  );
};

export default AdvancedSearch;
