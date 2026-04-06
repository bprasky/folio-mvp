/**
 * Quote selector with checkboxes for Instagram carousel
 */

'use client';

import { useState, useEffect } from 'react';

interface QuoteSelectorProps {
  quotes: string[];
  selectedQuotes: string[];
  onSelectionChange: (selected: string[]) => void;
}

export default function QuoteSelector({
  quotes,
  selectedQuotes: initialSelected,
  onSelectionChange,
}: QuoteSelectorProps) {
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>(initialSelected);

  useEffect(() => {
    // Auto-select all quotes by default
    if (quotes.length > 0 && selectedQuotes.length === 0) {
      const autoSelected = quotes.slice(0, 4); // Max 4 quotes
      setSelectedQuotes(autoSelected);
      onSelectionChange(autoSelected);
    }
  }, [quotes, selectedQuotes.length, onSelectionChange]);

  const handleToggle = (quote: string) => {
    const newSelected = selectedQuotes.includes(quote)
      ? selectedQuotes.filter((q) => q !== quote)
      : [...selectedQuotes, quote].slice(0, 4); // Max 4 quotes

    setSelectedQuotes(newSelected);
    onSelectionChange(newSelected);
  };

  if (quotes.length === 0) {
    return (
      <div className="text-sm text-folio-text-secondary italic">
        No quotes available from this project's article.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-folio-text-secondary mb-4">
        Select quotes to include in your carousel (max 4):
      </p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {quotes.map((quote, index) => (
          <label
            key={index}
            className="flex items-start gap-3 p-3 rounded-lg border border-folio-border-subtle hover:border-[var(--accent)]/30 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedQuotes.includes(quote)}
              onChange={() => handleToggle(quote)}
              className="mt-1 h-4 w-4 text-[var(--accent)] rounded focus:ring-[var(--accent)]"
            />
            <span className="flex-1 text-sm text-folio-text-primary italic leading-relaxed">
              "{quote}"
            </span>
          </label>
        ))}
      </div>
      {selectedQuotes.length > 0 && (
        <p className="text-xs text-folio-text-secondary mt-2">
          {selectedQuotes.length} quote{selectedQuotes.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}

