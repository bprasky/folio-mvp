'use client';

import { useState, useEffect } from 'react';
import { DirectoryEntry, DirectoryStats, SortField, SortDirection, DirectoryFilters } from '@/types/directory';
import DirectoryStatsComponent from './DirectoryStats';
import DirectoryFiltersComponent from './DirectoryFilters';
import DirectoryTable from './DirectoryTable';
import DirectorySearch from './DirectorySearch';

export default function DesignerDirectoryPage() {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [stats, setStats] = useState<DirectoryStats>({
    totalProducts: 0,
    totalVendors: 0,
    totalProjects: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<DirectoryFilters>({});
  const [sortField, setSortField] = useState<SortField>('lastUsedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  // Load directory data
  useEffect(() => {
    loadDirectory();
  }, [filters]);

  const loadDirectory = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.vendor) params.append('vendor', filters.vendor);
      if (filters.project) params.append('project', filters.project);
      if (filters.room) params.append('room', filters.room);
      if (filters.category) params.append('category', filters.category);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/designer/directory?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to load directory');
      }

      const data = await response.json();
      
      // Convert date strings to Date objects
      const entriesWithDates = data.entries.map((entry: any) => ({
        ...entry,
        lastUsedAt: new Date(entry.lastUsedAt),
      }));

      setEntries(entriesWithDates);
      setStats(data.stats || stats);
    } catch (err: any) {
      console.error('Error loading directory:', err);
      setError(err.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setFilters({ ...filters, search: term });
  };

  const handleFilterChange = (newFilters: DirectoryFilters) => {
    setFilters(newFilters);
  };

  // Sort entries
  const sortedEntries = [...entries].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'productName':
        aValue = a.productName.toLowerCase();
        bValue = b.productName.toLowerCase();
        break;
      case 'productBrand':
        aValue = (a.productBrand || '').toLowerCase();
        bValue = (b.productBrand || '').toLowerCase();
        break;
      case 'category':
        aValue = (a.productCategory || '').toLowerCase();
        bValue = (b.productCategory || '').toLowerCase();
        break;
      case 'lastUsedAt':
        aValue = a.lastUsedAt.getTime();
        bValue = b.lastUsedAt.getTime();
        break;
      case 'tagCount':
        aValue = a.tagCount;
        bValue = b.tagCount;
        break;
      case 'projectCount':
        aValue = a.projects.length;
        bValue = b.projects.length;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-[#FAFAF8] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 
            className="text-5xl font-semibold mb-3 text-[#2C2925]"
            style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}
          >
            Vendor Directory
          </h1>
          <p className="text-[#6B6560] text-base font-normal">
            Every product you've specified across all projects
          </p>
        </div>

        {/* Stats */}
        <DirectoryStatsComponent stats={stats} />

        {/* Search */}
        <div className="mb-6">
          <DirectorySearch
            entries={entries}
            searchTerm={searchTerm}
            filters={filters}
            onFilterChange={handleFilterChange}
            onSearchChange={handleSearch}
          />
        </div>

        {/* Filters */}
        <DirectoryFiltersComponent
          entries={entries}
          filters={filters}
          searchTerm={searchTerm}
          onFilterChange={handleFilterChange}
          onSearchChange={handleSearch}
        />

        {/* Table */}
        {loading ? (
          <div className="bg-white border border-[#E8E6E3] rounded-xl p-12 text-center shadow-sm">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#B5B0A9]"></div>
            <p className="mt-4 text-[#6B6560]">Loading directory...</p>
          </div>
        ) : error ? (
          <div className="bg-white border border-[#E8E6E3] rounded-xl p-12 text-center shadow-sm">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadDirectory}
              className="px-4 py-2 bg-[#7C7268] hover:bg-[#5C554D] text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="bg-white border border-[#E8E6E3] rounded-xl p-12 text-center shadow-sm">
            <p className="text-[#6B6560] mb-4">
              {searchTerm || Object.keys(filters).length > 0
                ? 'No products found matching your filters.'
                : "You haven't tagged any products yet."}
            </p>
            {!searchTerm && Object.keys(filters).length === 0 && (
              <a
                href="/designer"
                className="inline-block px-4 py-2 bg-[#7C7268] hover:bg-[#5C554D] text-white rounded-lg transition-colors"
              >
                Start Tagging Products
              </a>
            )}
          </div>
        ) : (
          <DirectoryTable
            entries={sortedEntries}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
      </div>
    </div>
  );
}

