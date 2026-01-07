'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getLensesForScope, groupLensesByType, Lens } from '@/lib/search/lenses';

interface LensBarProps {
  scope: 'public' | 'private';
  onLensChange: (lensId: string | null) => void;
}

/**
 * Horizontal lens selector
 * Feels like magazine section tabs
 */
export default function LensBar({ scope, onLensChange }: LensBarProps) {
  const searchParams = useSearchParams();
  const currentLens = searchParams.get('lens') || null;
  const [selectedLens, setSelectedLens] = useState<string | null>(currentLens);
  const lenses = getLensesForScope(scope);
  const grouped = groupLensesByType(lenses);
  
  // Sync with URL params
  useEffect(() => {
    setSelectedLens(currentLens);
  }, [currentLens]);
  
  const handleLensClick = (lensId: string | null) => {
    setSelectedLens(lensId);
    onLensChange(lensId);
  };
  
  return (
    <div className="flex flex-wrap gap-2 pb-4 border-b border-[#E0E0E0]">
      {/* All Moments (default) */}
      <button
        onClick={() => handleLensClick(null)}
        className={`px-4 py-2 text-sm font-medium transition-colors ${
          selectedLens === null
            ? 'text-[#1A1A1A] border-b-2 border-[#1A1A1A]'
            : 'text-[#666] hover:text-[#1A1A1A]'
        }`}
      >
        All
      </button>
      
      {/* Rooms */}
      {grouped.rooms.length > 0 && (
        <>
          {grouped.rooms.map((lens) => (
            <button
              key={lens.id}
              onClick={() => handleLensClick(lens.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                selectedLens === lens.id
                  ? 'text-[#1A1A1A] border-b-2 border-[#1A1A1A]'
                  : 'text-[#666] hover:text-[#1A1A1A]'
              }`}
            >
              {lens.label}
            </button>
          ))}
        </>
      )}
      
      {/* Materials */}
      {grouped.materials.length > 0 && (
        <>
          {grouped.materials.map((lens) => (
            <button
              key={lens.id}
              onClick={() => handleLensClick(lens.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                selectedLens === lens.id
                  ? 'text-[#1A1A1A] border-b-2 border-[#1A1A1A]'
                  : 'text-[#666] hover:text-[#1A1A1A]'
              }`}
            >
              {lens.label}
            </button>
          ))}
        </>
      )}
      
      {/* Styles */}
      {grouped.styles.length > 0 && (
        <>
          {grouped.styles.map((lens) => (
            <button
              key={lens.id}
              onClick={() => handleLensClick(lens.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                selectedLens === lens.id
                  ? 'text-[#1A1A1A] border-b-2 border-[#1A1A1A]'
                  : 'text-[#666] hover:text-[#1A1A1A]'
              }`}
            >
              {lens.label}
            </button>
          ))}
        </>
      )}
      
      {/* Status (private only) */}
      {scope === 'private' && grouped.status.length > 0 && (
        <>
          {grouped.status.map((lens) => (
            <button
              key={lens.id}
              onClick={() => handleLensClick(lens.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                selectedLens === lens.id
                  ? 'text-[#1A1A1A] border-b-2 border-[#1A1A1A]'
                  : 'text-[#666] hover:text-[#1A1A1A]'
              }`}
            >
              {lens.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

