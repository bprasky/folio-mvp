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
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-full border border-[var(--ridge-outer)] bg-[var(--bg-elevated)] pl-10 pr-10 folio-ui text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--ridge-outer)] focus:bg-[var(--bg-base)] focus:outline-none focus:ring-1 focus:ring-[var(--ridge-outer)] transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {/* Keyboard shortcut hint */}
      <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 folio-meta text-[var(--text-tertiary)]">
        <kbd className="px-1.5 py-0.5 rounded border border-[var(--ridge-outer)] bg-[var(--bg-elevated)] font-mono">
          ⌘K
        </kbd>
      </div>
    </form>
  );
}

