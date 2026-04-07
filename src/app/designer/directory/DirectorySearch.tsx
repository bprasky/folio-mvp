'use client';

import { useState, useEffect } from 'react';
import { Search, Mic, MicOff, X } from 'lucide-react';
import { DirectoryFilters, DirectoryEntry } from '@/types/directory';
import { parseNaturalQuery } from './parseNaturalQuery';
import { useVoiceSearch } from './useVoiceSearch';

interface DirectorySearchProps {
  entries: DirectoryEntry[];
  searchTerm: string;
  filters: DirectoryFilters;
  onSearchChange: (term: string) => void;
  onFilterChange: (filters: DirectoryFilters) => void;
}

export default function DirectorySearch({
  entries,
  searchTerm,
  filters,
  onSearchChange,
  onFilterChange,
}: DirectorySearchProps) {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [interpretedQuery, setInterpretedQuery] = useState<string | null>(null);
  const { isListening, transcript, error: voiceError, startListening, stopListening, reset } = useVoiceSearch();

  // Update local search when prop changes
  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);

  // Handle voice transcript
  useEffect(() => {
    if (transcript) {
      setLocalSearchTerm(transcript);
      handleNaturalQuery(transcript);
      reset();
    }
  }, [transcript]);

  // Extract available options for parsing
  const availableProjects = Array.from(
    new Map(entries.flatMap(e => e.projects.map(p => [p.projectId, p])))
      .values()
  ).map(p => ({ id: p.projectId, title: p.projectTitle }));

  const availableVendors = Array.from(
    new Set(entries.map(e => e.productBrand).filter(Boolean))
  ) as string[];

  const availableRooms = Array.from(
    new Set(entries.flatMap(e => e.projects.map(p => p.roomName).filter(Boolean)))
  ) as string[];

  const handleNaturalQuery = (query: string) => {
    if (!query.trim()) {
      onSearchChange('');
      onFilterChange({});
      setInterpretedQuery(null);
      return;
    }

    // Check if query looks like natural language (contains common words)
    const isNaturalLanguage = /(what|which|where|show|all|everything|from|in|for|did|we|use)/i.test(query);

    if (isNaturalLanguage) {
      // Parse natural language query
      const parsed = parseNaturalQuery(query, availableProjects, availableVendors, availableRooms);
      
      // Apply parsed filters
      onFilterChange(parsed.filters);
      if (parsed.interpretedQuery) {
        setInterpretedQuery(parsed.interpretedQuery);
      } else {
        setInterpretedQuery(null);
      }
      
      // Clear search term if filters were extracted
      if (Object.keys(parsed.filters).length > 0) {
        onSearchChange('');
        setLocalSearchTerm('');
      } else {
        // Use as keyword search
        onSearchChange(query);
      }
    } else {
      // Regular keyword search
      onSearchChange(query);
      setInterpretedQuery(null);
    }
  };

  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value);
    
    // Debounce natural language parsing for longer queries
    if (value.length > 10) {
      const timeoutId = setTimeout(() => {
        handleNaturalQuery(value);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      // Immediate search for short queries
      onSearchChange(value);
      setInterpretedQuery(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNaturalQuery(localSearchTerm);
    }
  };

  const clearSearch = () => {
    setLocalSearchTerm('');
    onSearchChange('');
    onFilterChange({});
    setInterpretedQuery(null);
    reset();
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-folio-text-tertiary" size={18} />
        <input
          type="text"
          placeholder="Search or ask: 'what lighting did we use in Meru kitchen?'"
          value={localSearchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-12 pr-24 py-3 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary placeholder-folio-text-tertiary focus:outline-none focus:border-folio-border-strong focus:ring-0 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.03)] transition-all"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {localSearchTerm && (
            <button
              onClick={clearSearch}
              className="p-1.5 text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={handleMicClick}
            disabled={!navigator.mediaDevices}
            className={`p-1.5 rounded-lg transition-all ${
              isListening
                ? 'text-red-500 bg-red-50 animate-pulse'
                : 'text-folio-text-tertiary hover:text-folio-text-secondary hover:bg-surface-ground'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isListening ? 'Stop listening' : 'Start voice search'}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        </div>
      </div>

      {/* Voice Error */}
      {voiceError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {voiceError}
        </div>
      )}

      {/* Listening Indicator */}
      {isListening && (
        <div className="flex items-center gap-2 text-sm text-folio-text-secondary bg-surface-ground border border-folio-border-subtle rounded-lg px-3 py-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span>Listening...</span>
        </div>
      )}

      {/* Interpreted Query Feedback */}
      {interpretedQuery && (
        <div className="flex items-center justify-between bg-surface-ground border border-folio-border-subtle rounded-lg px-4 py-2">
          <span className="text-sm text-folio-text-secondary">{interpretedQuery}</span>
          <button
            onClick={clearSearch}
            className="text-xs text-folio-text-secondary hover:text-folio-text-secondary underline transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

