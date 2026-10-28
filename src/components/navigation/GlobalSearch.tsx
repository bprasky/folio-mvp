"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface GlobalSearchProps {
  placeholder?: string;
}

export function GlobalSearch({ placeholder = "Search..." }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
    }
  };

  return (
    <form role="search" onSubmit={handleSubmit} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-folio-text-tertiary" />
        <input
          ref={inputRef}
          type="text"
          aria-label="Search Folio"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          // Pill background is a tinted overlay rather than a fixed surface
          // colour so the input adapts to whichever surface --surface is
          // pointing at (white on the homepage, cream on article pages).
          style={{ backgroundColor: "color-mix(in oklab, currentColor 5%, transparent)" }}
          className="h-10 w-full rounded-full border border-folio-border-subtle pl-10 pr-10 folio-ui text-folio-text-primary placeholder:text-folio-text-secondary focus:border-folio-border-subtle focus:outline-none focus:ring-1 focus:ring-[var(--ridge-outer)] transition-colors"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-folio-text-tertiary hover:text-folio-text-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {/* Keyboard shortcut hint */}
      <div className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 hidden xl:flex items-center gap-1 folio-meta text-folio-text-tertiary">
        <kbd className="px-1.5 py-0.5 rounded border border-folio-border-subtle bg-surface-ground font-mono">
          ⌘K
        </kbd>
      </div>
    </form>
  );
}

