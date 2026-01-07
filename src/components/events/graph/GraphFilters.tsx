"use client";

import { Filter } from 'lucide-react';

interface GraphFiltersProps {
  filters: {
    nodeType: 'all' | 'designers' | 'vendors' | 'products' | 'reps';
    minWeight: number;
  };
  onFiltersChange: (filters: any) => void;
}

export default function GraphFilters({ filters, onFiltersChange }: GraphFiltersProps) {
  const nodeTypes = [
    { value: 'all', label: 'All' },
    { value: 'designers', label: 'Designers' },
    { value: 'vendors', label: 'Vendors' },
    { value: 'products', label: 'Products' },
    { value: 'reps', label: 'Reps' },
  ];

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
      <div className="flex items-center space-x-2 mb-4">
        <Filter className="w-4 h-4 text-stone-500" />
        <h3 className="font-medium text-ink">Filters</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-2">
            Node Type
          </label>
          <select
            value={filters.nodeType}
            onChange={(e) =>
              onFiltersChange({ ...filters, nodeType: e.target.value as any })
            }
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-accent-400 focus:border-accent-400"
          >
            {nodeTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-2">
            Min Weight: {filters.minWeight.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={filters.minWeight}
            onChange={(e) =>
              onFiltersChange({ ...filters, minWeight: parseFloat(e.target.value) })
            }
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}




