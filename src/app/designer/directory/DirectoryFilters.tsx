'use client';

import { useState } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { DirectoryEntry, DirectoryFilters as Filters } from '@/types/directory';

interface DirectoryFiltersProps {
  entries: DirectoryEntry[];
  filters: Filters;
  searchTerm: string;
  onFilterChange: (filters: Filters) => void;
  onSearchChange: (term: string) => void;
}

export default function DirectoryFilters({
  entries,
  filters,
  searchTerm,
  onFilterChange,
  onSearchChange,
}: DirectoryFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  // Extract unique values for filter dropdowns
  const uniqueVendors = Array.from(new Set(
    entries.map(e => e.productBrand).filter(Boolean)
  )).sort();

  const uniqueProjects = Array.from(new Set(
    entries.flatMap(e => e.projects.map(p => ({ id: p.projectId, title: p.projectTitle })))
  )).reduce((acc, curr) => {
    if (!acc.find(p => p.id === curr.id)) {
      acc.push(curr);
    }
    return acc;
  }, [] as Array<{ id: string; title: string }>).sort((a, b) => a.title.localeCompare(b.title));

  const uniqueRooms = Array.from(new Set(
    entries.flatMap(e => e.projects.map(p => p.roomName).filter(Boolean))
  )).sort();

  const uniqueCategories = Array.from(new Set(
    entries.map(e => e.productCategory).filter(Boolean)
  )).sort();

  const handleFilterChange = (key: keyof Filters, value: string) => {
    const newFilters = { ...filters };
    if (value === '') {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    onFilterChange({});
    onSearchChange('');
  };

  const hasActiveFilters = Object.keys(filters).length > 0 || searchTerm.length > 0;

  return (
    <div className="glass-surface p-4 mb-6">

      {/* Filter Toggle */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-sm text-folio-text-secondary hover:text-folio-text-primary transition-colors font-medium"
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-folio-text-secondary hover:text-folio-text-secondary transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Filter Dropdowns */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-folio-text-secondary mb-1 font-medium">Vendor</label>
            <select
              value={filters.vendor || ''}
              onChange={(e) => handleFilterChange('vendor', e.target.value)}
              className="w-full px-3 py-2 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary focus:outline-none focus:border-folio-border-strong focus:shadow-[0_0_0_3px_rgba(0,0,0,0.03)] transition-all"
            >
              <option value="">All Vendors</option>
              {uniqueVendors.map(vendor => (
                <option key={vendor} value={vendor}>{vendor}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-folio-text-secondary mb-1 font-medium">Project</label>
            <select
              value={filters.project || ''}
              onChange={(e) => handleFilterChange('project', e.target.value)}
              className="w-full px-3 py-2 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary focus:outline-none focus:border-folio-border-strong focus:shadow-[0_0_0_3px_rgba(0,0,0,0.03)] transition-all"
            >
              <option value="">All Projects</option>
              {uniqueProjects.map(project => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-folio-text-secondary mb-1 font-medium">Room</label>
            <select
              value={filters.room || ''}
              onChange={(e) => handleFilterChange('room', e.target.value)}
              className="w-full px-3 py-2 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary focus:outline-none focus:border-folio-border-strong focus:shadow-[0_0_0_3px_rgba(0,0,0,0.03)] transition-all"
            >
              <option value="">All Rooms</option>
              {uniqueRooms.map(room => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-folio-text-secondary mb-1 font-medium">Category</label>
            <select
              value={filters.category || ''}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full px-3 py-2 bg-surface-canvas border border-folio-border-subtle rounded-lg text-folio-text-primary focus:outline-none focus:border-folio-border-strong focus:shadow-[0_0_0_3px_rgba(0,0,0,0.03)] transition-all"
            >
              <option value="">All Categories</option>
              {uniqueCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

