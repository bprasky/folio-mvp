'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

interface GlobalSearchBarProps {
  variant?: 'default' | 'compact';
  placeholder?: string;
  className?: string;
}

export default function GlobalSearchBar({ 
  variant = 'default',
  placeholder = 'Search moments...',
  className = ''
}: GlobalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
      setIsExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('');
      setIsExpanded(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`}>
        {!isExpanded ? (
          <button
            onClick={() => setIsExpanded(true)}
            className="p-2 text-[#4A4A4A] hover:text-[#1A1A1A] transition-colors"
            aria-label="Open search"
          >
            <Search size={20} />
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (!query) setIsExpanded(false); }}
                placeholder={placeholder}
                className="w-48 md:w-64 pl-3 pr-8 py-1.5 text-sm border border-[#E0E0E0] rounded-sm 
                           focus:outline-none focus:border-[#1A1A1A] bg-white
                           font-sans text-[#1A1A1A] placeholder:text-[#9A9A9A]"
              />
              <button
                type="button"
                onClick={() => { setQuery(''); setIsExpanded(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-[#4A4A4A]"
              >
                <X size={14} />
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2 text-sm border border-[#E0E0E0] rounded-sm 
                     focus:outline-none focus:border-[#1A1A1A] bg-white
                     font-sans text-[#1A1A1A] placeholder:text-[#9A9A9A] transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-[#4A4A4A]"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </form>
  );
}

