'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface SearchInputProps {
  placeholder?: string;
  className?: string;
  initialQuery?: string;
}

/**
 * Search input component that navigates to search page
 */
export default function SearchInput({
  placeholder = 'Search moments...',
  className = '',
  initialQuery = '',
}: SearchInputProps) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 pl-12 border border-folio-border-subtle rounded focus:outline-none focus:border-[#1A1A1A] transition-colors bg-surface-canvas text-folio-text-primary placeholder:text-folio-text-tertiary"
        />
        <svg
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-folio-text-secondary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
    </form>
  );
}

