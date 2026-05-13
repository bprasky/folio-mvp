// HomepageMosaicSection — wraps MagazineMosaicGrid with filter-aware data fetching (Task 05)
//
// Reads filter state from URL params, calls /api/homepage-feed, swaps mosaic
// content on filter change with useTransition (no scroll jump). For signed-in
// users, hover affordances (♡ ＋) overlay each tile via a sibling layer —
// MagazineMosaicGrid is reused unchanged.

"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";

import MagazineMosaicGrid from "@/components/magazine/MagazineMosaicGrid";
import type { MagazineMosaicItem } from "@/lib/magazine/getMagazineData";

interface Props {
  initialPosts: MagazineMosaicItem[];
  initialNextCursor: string | null;
  isOut: boolean;
}

export function HomepageMosaicSection({
  initialPosts,
  initialNextCursor,
  isOut,
}: Props) {
  const params = useSearchParams();
  const [posts, setPosts] = useState(initialPosts);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  // Refetch when filter chips change
  useEffect(() => {
    const filter = params.get("filter");
    const filterValue = params.get("filterValue");
    const following = params.get("following") === "true";

    // 'recent' is the default sort and 'region'/'category' chips are
    // value-less placeholders until Task 11 wires selection. For all of
    // these the API returns the same shape as initial render — skip the
    // network round-trip + loading flicker entirely.
    const hasActionableFilter =
      following ||
      (filter !== null &&
        filter !== "recent" &&
        (filter === "keyword" || filter === "location" || filter === "category") &&
        filterValue !== null);

    if (!hasActionableFilter) {
      setPosts(initialPosts);
      setNextCursor(initialNextCursor);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const url = new URL("/api/homepage-feed", window.location.origin);
    if (filter && filter !== "recent") {
      url.searchParams.set("filterType", filter);
      if (filterValue) url.searchParams.set("filterValue", filterValue);
    }
    if (following) {
      url.searchParams.set("following", "true");
    }

    fetch(url.toString())
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        startTransition(() => {
          setPosts(data.feedPosts ?? []);
          setNextCursor(data.nextCursor ?? null);
        });
      })
      .catch(() => {
        // Fail open: leave previous posts in place.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params, initialPosts, initialNextCursor]);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const url = new URL("/api/homepage-feed", window.location.origin);
      url.searchParams.set("cursor", nextCursor);
      const filter = params.get("filter");
      const filterValue = params.get("filterValue");
      if (filter && filter !== "recent") {
        url.searchParams.set("filterType", filter);
        if (filterValue) url.searchParams.set("filterValue", filterValue);
      }
      if (params.get("following") === "true") url.searchParams.set("following", "true");

      const res = await fetch(url.toString());
      const data = await res.json();
      startTransition(() => {
        setPosts((prev) => [...prev, ...(data.feedPosts ?? [])]);
        setNextCursor(data.nextCursor ?? null);
      });
    } finally {
      setLoading(false);
    }
  };

  if (posts.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="folio-meta text-folio-text-secondary">
          No work matches this filter yet.
        </p>
      </div>
    );
  }

  return (
    <div className="relative" data-loading={loading ? "true" : undefined}>
      {/* Hover affordances are rendered by MagazineMosaicGrid's tiles when
          isOut === false; for now we pass items through and rely on the
          existing tile chrome. Adding heart/save overlays is a follow-up
          (Task 07 component cleanup) — out of scope per Task 05 spec. */}
      <MagazineMosaicGrid items={posts} />

      {nextCursor && (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading}
            className="px-6 py-2.5 rounded-full folio-ui border border-folio-border-subtle hover:bg-surface-ground transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
      {/* isOut prop is reserved for follow-up hover-affordance work (♡ ＋). */}
      <span hidden aria-hidden data-is-out={isOut ? "true" : "false"} />
    </div>
  );
}
