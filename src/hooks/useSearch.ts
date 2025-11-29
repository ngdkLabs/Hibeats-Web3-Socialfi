import { useState, useEffect, useCallback } from 'react';
import { searchService, SearchResult, SearchFilters } from '@/services/searchService';
import { useDebounce } from './useDebounce';

export function useSearch(initialQuery: string = '', filters: SearchFilters = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedQuery = useDebounce(query, 300);

  // Perform search
  const search = useCallback(async (searchQuery: string, searchFilters: SearchFilters = {}) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const searchResults = await searchService.search(searchQuery, {
        ...filters,
        ...searchFilters,
      });
      setResults(searchResults);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to perform search');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Get suggestions
  const getSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const suggestionResults = await searchService.getSuggestions(searchQuery, 5);
      setSuggestions(suggestionResults);
    } catch (err) {
      console.error('Suggestions error:', err);
      setSuggestions([]);
    }
  }, []);

  // Auto-search on debounced query change
  useEffect(() => {
    if (debouncedQuery) {
      search(debouncedQuery, filters);
      getSuggestions(debouncedQuery);
    } else {
      setResults([]);
      setSuggestions([]);
    }
  }, [debouncedQuery, filters, search, getSuggestions]);

  return {
    query,
    setQuery,
    results,
    suggestions,
    isLoading,
    error,
    search,
  };
}
