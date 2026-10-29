"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./navigation.module.css";

export function GlobalSearch({ placeholder = "Search Folio" }: { placeholder?: string }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (inputRef.current?.getClientRects().length) inputRef.current.focus();
        else router.push("/search");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <form role="search" className={styles.search} onSubmit={event => {
      event.preventDefault();
      if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }}>
      <Search aria-hidden="true" size={16} strokeWidth={1.5} />
      <input ref={inputRef} type="search" aria-label="Search Folio" value={query}
        onChange={event => setQuery(event.target.value)} placeholder={placeholder}
        onKeyDown={event => { if (event.key === "Escape") setQuery(""); }} />
      {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className={styles.searchClear}><X aria-hidden="true" size={14} /></button>}
    </form>
  );
}
