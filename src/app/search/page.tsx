'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import EditionView from '@/components/search/EditionView';
import { MomentResult } from '@/lib/search/searchMoments';
import type { Facet } from '@/components/search/FilterChips';

interface FilterOptions {
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
  totalResults: number;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [moments, setMoments] = useState<MomentResult[]>([]);
  const [editionTitle, setEditionTitle] = useState('All Moments');
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const query = searchParams.get('q') || '';
  const lens = searchParams.get('lens') || undefined;
  const scopeParam = searchParams.get('scope') as 'public' | 'private' | null;
  
  // Extract filter params from URL
  const activeFilters: Record<string, string> = {};
  const room = searchParams.get('room');
  const vendor = searchParams.get('vendor');
  const vendorId = searchParams.get('vendorId');
  const category = searchParams.get('category');
  const color = searchParams.get('color');
  const material = searchParams.get('material');
  const style = searchParams.get('style');
  
  if (room) activeFilters.room = room;
  if (vendor) activeFilters.vendor = vendor;
  if (vendorId) activeFilters.vendorId = vendorId;
  if (category) activeFilters.category = category;
  if (color) activeFilters.color = color;
  if (material) activeFilters.material = material;
  if (style) activeFilters.style = style;
  
  // Check if user is a designer (can access private search)
  const isDesigner = session?.user?.role?.toLowerCase() === 'designer' || 
                     session?.user?.role?.toLowerCase() === 'admin';
  
  // Initialize scope from URL or default to public
  const initialScope = (scopeParam === 'private' && isDesigner) ? 'private' : 'public';
  const [scope, setScope] = useState<'public' | 'private'>(initialScope);
  const [error, setError] = useState<string | null>(null);
  
  // Sync scope with URL param
  useEffect(() => {
    if (scopeParam === 'private' && isDesigner) {
      setScope('private');
    } else if (scopeParam === 'public' || !scopeParam) {
      setScope('public');
    }
  }, [scopeParam, isDesigner]);
  
  // Fetch search results
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          q: query,
          scope,
          ...(lens && { lens }),
          ...(room && { room }),
          ...(vendor && { vendor }),
          ...(vendorId && { vendorId }),
          ...(category && { category }),
          ...(color && { color }),
          ...(material && { material }),
          ...(style && { style }),
        });
        
        const res = await fetch(`/api/search/moments?${params}`);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Search failed' }));
          throw new Error(errorData.error || 'Search failed');
        }
        
        const data = await res.json();
        
        setMoments(data.moments || []);
        setEditionTitle(data.edition?.title || 'All Moments');
      } catch (err) {
        console.error('Search error:', err);
        setError(err instanceof Error ? err.message : 'Failed to search moments');
        setMoments([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResults();
  }, [query, scope, lens, room, vendor, vendorId, category, color, material, style]);
  
  // Fetch filter options
  useEffect(() => {
    const fetchFilters = async () => {
      console.log('[SearchPage] Fetching filter options...', { query, scope, room, vendor, category, color, material, style });
      setFiltersLoading(true);
      
      try {
        const params = new URLSearchParams({
          q: query,
          scope,
          ...(room && { room }),
          ...(vendor && { vendor }),
          ...(vendorId && { vendorId }),
          ...(category && { category }),
          ...(color && { color }),
          ...(material && { material }),
          ...(style && { style }),
        });
        
        const url = `/api/search/filters?${params}`;
        console.log('[SearchPage] Filter API URL:', url);
        
        const res = await fetch(url);
        
        console.log('[SearchPage] Filter API response status:', res.status, res.ok);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[SearchPage] Failed to fetch filter options:', res.status, errorText);
          return;
        }
        
        const data = await res.json();
        console.log('[SearchPage] Filter options received:', {
          hasFacets: !!data.facets,
          stylesCount: data.facets?.styles?.length || 0,
          materialsCount: data.facets?.materials?.length || 0,
          colorsCount: data.facets?.colors?.length || 0,
          vendorsCount: data.facets?.vendors?.length || 0,
          categoriesCount: data.facets?.categories?.length || 0,
          activeFilters: data.activeFilters,
          totalResults: data.totalResults,
          debug: data._debug,
        });
        
        // Log debug info separately for visibility
        if (data._debug) {
          console.log('[SearchPage] DEBUG INFO:', data._debug);
          if (data._debug.sampleRecord) {
            console.log('[SearchPage] Sample record structure:', data._debug.sampleRecord);
          }
          if (data._debug.anyRecordInfo) {
            console.log('[SearchPage] Any record in DB:', data._debug.anyRecordInfo);
          }
        }
        
        setFilterOptions(data);
      } catch (err) {
        console.error('[SearchPage] Filter options error:', err);
      } finally {
        setFiltersLoading(false);
      }
    };
    
    fetchFilters();
  }, [query, scope, room, vendor, vendorId, category, color, material, style]);
  
  const handleLensChange = (lensId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (lensId) {
      params.set('lens', lensId);
    } else {
      params.delete('lens');
    }
    router.push(`/search?${params.toString()}`);
  };
  
  const handleMomentClick = async (moment: MomentResult) => {
    // Track click for signals
    try {
      await fetch('/api/search/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'click',
          momentId: moment.id,
          query,
        }),
      });
    } catch (err) {
      console.error('Failed to capture signal:', err);
      // Don't block user interaction
    }
  };
  
  const handleMomentSave = async (momentId: string) => {
    // Track save for signals
    try {
      await fetch('/api/search/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          momentId,
          query,
        }),
      });
      
      // TODO: Implement actual save functionality
      console.log('Save moment:', momentId);
    } catch (err) {
      console.error('Failed to save moment:', err);
    }
  };
  
  const handleMomentShare = async (momentId: string) => {
    // Track share for signals
    try {
      await fetch('/api/search/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'share',
          momentId,
          query,
        }),
      });
      
      // TODO: Implement actual share functionality
      if (navigator.share) {
        const moment = moments.find(m => m.id === momentId);
        if (moment) {
          await navigator.share({
            title: moment.projectTitle,
            text: `Check out this moment by ${moment.designerName}`,
            url: `${window.location.origin}/project/${moment.projectId}?image=${momentId}`,
          });
        }
      } else {
        // Fallback: copy to clipboard
        const moment = moments.find(m => m.id === momentId);
        if (moment) {
          const url = `${window.location.origin}/project/${moment.projectId}?image=${momentId}`;
          await navigator.clipboard.writeText(url);
          alert('Link copied to clipboard!');
        }
      }
    } catch (err) {
      console.error('Failed to share moment:', err);
    }
  };
  
  const handleScopeChange = (newScope: 'public' | 'private') => {
    setScope(newScope);
    // Update URL to reflect scope change
    const params = new URLSearchParams(searchParams.toString());
    if (newScope === 'private') {
      params.set('scope', 'private');
    } else {
      params.delete('scope');
    }
    router.push(`/search?${params.toString()}`);
  };
  
  const handleFilterChange = (filterType: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === null) {
      // Remove filter
      params.delete(filterType);
    } else {
      // Add/update filter
      params.set(filterType, value);
    }
    
    // Reset to page 1 when filtering
    params.delete('cursor');
    
    router.push(`/search?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A1A1A] mx-auto mb-4"></div>
          <p className="text-[#6A6A6A] font-serif">Curating edition...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-[#FFFAF5] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4 font-serif">{error}</p>
          <button
            onClick={() => router.push('/search')}
            className="px-6 py-3 bg-[#1A1A1A] text-white rounded hover:bg-[#333] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <EditionView
      moments={moments}
      editionTitle={editionTitle}
      scope={scope}
      isDesigner={isDesigner}
      onScopeChange={isDesigner ? handleScopeChange : undefined}
      onLensChange={handleLensChange}
      onMomentClick={handleMomentClick}
      onMomentSave={handleMomentSave}
      onMomentShare={handleMomentShare}
      filterOptions={filterOptions ? {
        facets: filterOptions.facets,
        activeFilters: filterOptions.activeFilters,
      } : undefined}
      filtersLoading={filtersLoading}
      onFilterChange={handleFilterChange}
      searchQuery={query}
    />
  );
}

