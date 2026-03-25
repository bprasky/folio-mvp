"use client";

import { useState, useEffect } from "react";

/**
 * Hook that tracks a CSS media query match state.
 * Returns false during SSR to avoid hydration mismatch.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Shorthand: true when viewport >= 1024px (Tailwind `lg` breakpoint). */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
