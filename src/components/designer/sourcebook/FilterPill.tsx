'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface FilterPillOption {
  value: string;
  label: string;
}

interface FilterPillProps {
  label: string;
  options: FilterPillOption[];
  value: string;
  onChange: (value: string) => void;
  searchable?: boolean;
}

export default function FilterPill({ label, options, value, onChange, searchable = false }: FilterPillProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const isActive = value !== '';
  const selectedLabel = options.find(o => o.value === value)?.label;

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          inline-flex items-center gap-1 px-2.5 h-8 text-[13px] whitespace-nowrap
          bg-white border rounded-lg cursor-pointer transition-all duration-150
          ${isActive
            ? 'border-[rgba(201,169,110,0.5)] text-[#c9a96e] bg-[rgba(201,169,110,0.05)]'
            : 'border-[rgba(0,0,0,0.1)] text-folio-text-secondary hover:border-[rgba(201,169,110,0.3)] hover:text-folio-text-primary'
          }
        `}
      >
        {isActive ? `${label}: ${selectedLabel}` : label}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-52 bg-white rounded-lg shadow-lg border border-[rgba(0,0,0,0.08)] py-1 max-h-64 overflow-auto">
          {searchable && (
            <div className="px-2 pb-1 pt-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-[12px] rounded border border-neutral-200 focus:border-[#c9a96e] focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
            className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${
              value === '' ? 'text-[#c9a96e] font-medium' : 'text-folio-text-secondary hover:bg-[rgba(0,0,0,0.03)]'
            }`}
          >
            All {label}s
          </button>
          {filtered.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => { onChange(option.value); setOpen(false); setSearch(''); }}
              className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${
                value === option.value ? 'text-[#c9a96e] font-medium' : 'text-folio-text-primary hover:bg-[rgba(0,0,0,0.03)]'
              }`}
            >
              {option.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-folio-text-tertiary">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
