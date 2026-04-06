'use client';

import { useState, useMemo } from 'react';
import { MomentResult } from '@/lib/search/searchMoments';
import SearchMosaic from './SearchMosaic';
import MomentExpanded from './MomentExpanded';
import FilterChips, { Facet } from './FilterChips';

interface EditionViewProps {
  moments: MomentResult[];
  editionTitle: string;
  scope: 'public' | 'private';
  isDesigner?: boolean;
  onScopeChange?: (scope: 'public' | 'private') => void;
  onLensChange?: (lensId: string | null) => void;
  onMomentClick?: (moment: MomentResult) => void;
  onMomentSave?: (momentId: string) => void;
  onMomentShare?: (momentId: string) => void;
  filterOptions?: {
    facets: {
      styles: Facet[];
      materials: Facet[];
      colors: Facet[];
      vendors: Facet[];
      categories: Facet[];
      mood?: Facet[];
      elements?: Facet[];
    };
    activeFilters: Record<string, string>;
  };
  filtersLoading?: boolean;
  onFilterChange?: (filterType: string, value: string | null) => void;
  searchQuery?: string;
}

/**
 * Full-bleed editorial layout for search results
 * No "X results found" - feels like a magazine
 */
export default function EditionView({
  moments,
  editionTitle,
  scope,
  isDesigner = false,
  onScopeChange,
  onLensChange,
  onMomentClick,
  onMomentSave,
  onMomentShare,
  filterOptions,
  filtersLoading = false,
  onFilterChange,
  searchQuery = '',
}: EditionViewProps) {
  const [selectedMoment, setSelectedMoment] = useState<MomentResult | null>(null);
  
  const handleMomentClick = (moment: MomentResult) => {
    setSelectedMoment(moment);
    onMomentClick?.(moment);
  };
  
  const handleCloseExpanded = () => {
    setSelectedMoment(null);
  };

  // Grammar classification: adjectives vs nouns
  const adjectiveFilters = [
    'grey', 'gray', 'modern', 'minimal', 'warm', 'dark', 'light', 'bold', 'soft', 
    'rustic', 'contemporary', 'traditional', 'coastal', 'industrial', 'scandinavian',
    'mid-century', 'bohemian', 'farmhouse', 'transitional', 'eclectic', 'vintage',
    'luxury', 'premium', 'elegant', 'sophisticated', 'refined', 'classic', 'timeless'
  ];
  
  const nounFilters = [
    'lighting', 'rug', 'marble', 'tile', 'wood', 'brass', 'stone', 'fabric', 
    'furniture', 'fixture', 'hardware', 'appliance', 'cabinet', 'countertop',
    'sink', 'faucet', 'mirror', 'art', 'accessory', 'decor', 'pillow', 'curtain',
    'window', 'door', 'floor', 'wall', 'ceiling', 'trim', 'molding'
  ];

  // Generate dynamic edition title from query and filters with grammar logic
  const dynamicEditionTitle = useMemo(() => {
    const activeFilters = filterOptions?.activeFilters || {};
    
    // Classify filters into adjectives and nouns
    const adjectiveLabels: string[] = [];
    const nounLabels: string[] = [];
    
    // Process each filter type
    Object.entries(activeFilters).forEach(([filterType, value]) => {
      let label = '';
      
      // Get label from facets
      if (filterType === 'color') {
        const facet = filterOptions?.facets.colors.find(f => f.value === value);
        label = facet?.label || formatTitleCase(value);
      } else if (filterType === 'material') {
        const facet = filterOptions?.facets.materials.find(f => f.value === value);
        label = facet?.label || formatTitleCase(value);
      } else if (filterType === 'style') {
        const facet = filterOptions?.facets.styles.find(f => f.value === value);
        label = facet?.label || formatTitleCase(value);
      } else if (filterType === 'category') {
        const facet = filterOptions?.facets.categories.find(f => f.value === value);
        label = facet?.label || formatTitleCase(value);
      } else {
        label = formatTitleCase(value);
      }
      
      if (!label) return;
      
      // Classify as adjective or noun
      const lowerLabel = label.toLowerCase();
      const isAdjective = adjectiveFilters.some(adj => 
        lowerLabel.includes(adj) || adj.includes(lowerLabel)
      );
      const isNoun = nounFilters.some(noun => 
        lowerLabel.includes(noun) || noun.includes(lowerLabel)
      );
      
      if (isAdjective && !isNoun) {
        adjectiveLabels.push(label);
      } else if (isNoun || !isAdjective) {
        nounLabels.push(label);
      } else {
        // Default to noun if ambiguous
        nounLabels.push(label);
      }
    });
    
    // Limit filters for readability (2 adjectives max, 2 nouns max)
    const titleAdjectives = adjectiveLabels.slice(0, 2);
    const titleNouns = nounLabels.slice(0, 2);
    
    // Get search term (query) or default
    const searchTerm = searchQuery.trim() || 'All';
    const formattedTerm = formatTitleCase(searchTerm);
    
    // Build title: "The ${adjectives} ${searchTerm} ${nouns} Edition"
    let title = 'The';
    
    // Add adjectives before search term
    if (titleAdjectives.length > 0) {
      title += ` ${titleAdjectives.join(' ')}`;
    }
    
    // Add search term
    title += ` ${formattedTerm}`;
    
    // Add nouns after search term
    if (titleNouns.length > 0) {
      if (titleNouns.length === 1) {
        title += ` ${titleNouns[0]}`;
      } else {
        title += ` ${titleNouns.join(' & ')}`;
      }
    }
    
    title += ' Edition';
    
    // Clean up multiple spaces
    return title.replace(/\s+/g, ' ').trim();
  }, [searchQuery, filterOptions]);

  // Get active filter chips for metadata line
  const activeFilterChips = useMemo(() => {
    if (!filterOptions?.activeFilters || !filterOptions?.facets) return [];
    
    const chips: Array<{ filterType: string; label: string }> = [];
    const { activeFilters, facets } = filterOptions;
    
    Object.entries(activeFilters).forEach(([filterType, value]) => {
      let label = '';
      if (filterType === 'color') {
        label = facets.colors.find(f => f.value === value)?.label || formatTitleCase(value);
      } else if (filterType === 'material') {
        label = facets.materials.find(f => f.value === value)?.label || formatTitleCase(value);
      } else if (filterType === 'style') {
        label = facets.styles.find(f => f.value === value)?.label || formatTitleCase(value);
      } else if (filterType === 'category') {
        label = facets.categories.find(f => f.value === value)?.label || formatTitleCase(value);
      } else {
        label = formatTitleCase(value);
      }
      
      if (label) {
        chips.push({ filterType, label });
      }
    });
    
    return chips;
  }, [filterOptions]);
  
  return (
    <div className="min-h-screen bg-surface-canvas w-full max-w-[100vw] overflow-hidden">
      {/* Edition Title Treatment - Below FOLIO masthead, tight spacing */}
      <div className="w-full px-2 sm:px-3 pt-4 pb-8">
        <div className="text-center">
          {/* Edition Title - Italic serif, centered, elegant spacing */}
          <h1 className="font-serif italic text-3xl md:text-4xl lg:text-5xl text-folio-text-primary mb-6">
            {dynamicEditionTitle}
          </h1>
          
          {/* Metadata Line - Moment count and filter pills, muted styling */}
          <div className="flex items-center justify-center gap-3 text-sm text-folio-text-tertiary flex-wrap">
            <span className="font-sans">{moments.length} {moments.length === 1 ? 'moment' : 'moments'}</span>
            {activeFilterChips.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {activeFilterChips.map((chip) => (
                  <button
                    key={`${chip.filterType}-${chip.label}`}
                    onClick={() => onFilterChange?.(chip.filterType, null)}
                    className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-ground hover:bg-surface-ground text-folio-text-primary hover:text-folio-text-primary transition-all font-sans text-xs backdrop-blur-sm border border-folio-border-subtle hover:border-folio-border-subtle"
                    title={`Remove ${chip.label} filter`}
                  >
                    <span>{chip.label}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-folio-text-tertiary">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Scope Toggle - Only for designers, positioned below metadata with tight spacing */}
          {isDesigner && onScopeChange && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="flex items-center gap-2 bg-surface-canvas border border-folio-border-subtle rounded-sm p-1">
                <button
                  onClick={() => onScopeChange('public')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    scope === 'public'
                      ? 'bg-neutral-900 text-white'
                      : 'text-folio-text-secondary hover:text-folio-text-primary'
                  }`}
                >
                  All Folio
                </button>
                <button
                  onClick={() => onScopeChange('private')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    scope === 'private'
                      ? 'bg-neutral-900 text-white'
                      : 'text-folio-text-secondary hover:text-folio-text-primary'
                  }`}
                >
                  My Work
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Filter Chips - Editorial curation, subtle and minimal */}
      {filterOptions && onFilterChange && (
        <div className="w-full px-2 sm:px-3 pb-4">
          <FilterChips
            facets={filterOptions.facets}
            activeFilters={filterOptions.activeFilters}
            onFilterChange={onFilterChange}
            isLoading={filtersLoading}
          />
        </div>
      )}

      {/* Search Mosaic - Editorial Grid */}
      <div className="w-full px-0 pb-16">
        <SearchMosaic
          moments={moments}
          scope={scope}
          onMomentClick={handleMomentClick}
          onMomentSave={onMomentSave}
          onMomentShare={onMomentShare}
        />
      </div>
      
      {/* Expanded Moment Modal */}
      {selectedMoment && (
        <MomentExpanded
          moment={selectedMoment}
          onClose={handleCloseExpanded}
          onSave={() => {
            onMomentSave?.(selectedMoment.id);
            handleCloseExpanded();
          }}
          onShare={() => {
            onMomentShare?.(selectedMoment.id);
          }}
        />
      )}
    </div>
  );
}

/**
 * Format string to title case for edition titles
 */
function formatTitleCase(str: string): string {
  return str
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

