'use client';

import { useState, useEffect } from 'react';
import { DirectoryEntry, DirectoryStats, SortField, SortDirection, DirectoryFilters } from '@/types/directory';
import DirectoryStatsComponent from './DirectoryStats';
import DirectoryFiltersComponent from './DirectoryFilters';
import DirectoryTable from './DirectoryTable';
import DirectorySearch from './DirectorySearch';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

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
    <div className="min-h-screen bg-[var(--bg-base)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="folio-h1 text-[var(--text-primary)] mb-3">
            Vendor Directory
          </h1>
          <p className="folio-body text-[var(--text-secondary)]">
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
          <RidgeCard padding="xl" className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
            <p className="mt-4 folio-body text-[var(--text-secondary)]">Loading directory...</p>
          </RidgeCard>
        ) : error ? (
          <RidgeCard padding="xl" className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button
              variant="ridge"
              onClick={loadDirectory}
            >
              Retry
            </Button>
          </RidgeCard>
        ) : sortedEntries.length === 0 ? (
          <RidgeCard padding="xl" className="text-center">
            <p className="folio-body text-[var(--text-secondary)] mb-4">
              {searchTerm || Object.keys(filters).length > 0
                ? 'No products found matching your filters.'
                : "You haven't tagged any products yet."}
            </p>
            {!searchTerm && Object.keys(filters).length === 0 && (
              <a href="/designer">
                <Button variant="accent">
                  Start Tagging Products
                </Button>
              </a>
            )}
          </RidgeCard>
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

