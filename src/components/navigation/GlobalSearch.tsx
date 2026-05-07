"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface GlobalSearchProps {
  placeholder?: string;
  /**
   * Render as an icon-only trigger that expands into a full-width overlay
   * when tapped. Used in dense mobile headers where a full input field
   * would crowd out the logo.
   */
  iconOnly?: boolean;
}

export function GlobalSearch({ placeholder = "Search...", iconOnly = false }: GlobalSearchProps) {
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

  // Auto-focus the input when the icon-only overlay opens
  useEffect(() => {
    if (iconOnly && isOpen) {
      inputRef.current?.focus();
    }
  }, [iconOnly, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
    }
  };

  if (iconOnly) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-lg hover:bg-surface-ground transition-colors"
          aria-label="Search"
        >
          <Search className="h-5 w-5 text-folio-text-primary" />
        </button>

        {isOpen && (
          <div className="fixed inset-x-0 top-16 z-50 px-4 py-3 bg-surface-canvas border-b border-folio-border-subtle">
            <form onSubmit={handleSubmit} className="relative w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-folio-text-tertiary" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className="h-10 w-full rounded-full border border-folio-border-subtle bg-surface-ground pl-10 pr-10 folio-ui text-folio-text-primary placeholder:text-folio-text-secondary focus:border-folio-border-subtle focus:bg-surface-canvas focus:outline-none focus:ring-1 focus:ring-[var(--ridge-outer)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-folio-text-tertiary hover:text-folio-text-secondary"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-folio-text-tertiary" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-full border border-folio-border-subtle bg-surface-ground pl-10 pr-10 folio-ui text-folio-text-primary placeholder:text-folio-text-secondary focus:border-folio-border-subtle focus:bg-surface-canvas focus:outline-none focus:ring-1 focus:ring-[var(--ridge-outer)] transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-folio-text-tertiary hover:text-folio-text-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {/* Keyboard shortcut hint */}
      <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 folio-meta text-folio-text-tertiary">
        <kbd className="px-1.5 py-0.5 rounded border border-folio-border-subtle bg-surface-ground font-mono">
          ⌘K
        </kbd>
      </div>
    </form>
  );
}

