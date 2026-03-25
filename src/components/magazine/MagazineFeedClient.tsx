"use client";

// src/components/magazine/MagazineFeedClient.tsx
//
// Client-side feed orchestrator: filter chips + paginated mosaic grid.
// Receives initial data from server, then handles filter changes and
// "More stories" pagination entirely client-side.

import { useState, useCallback, useEffect } from "react";
import clsx from "clsx";
import MagazineMosaicGrid from "./MagazineMosaicGrid";
import type { MagazineMosaicItem } from "@/lib/magazine/getMagazineData";

// --- Types ---

interface SmartFilter {
  id: string;
  label: string;
  type: "category" | "keyword" | "location";
  count: number;
}

interface MagazineFeedClientProps {
  initialPosts: MagazineMosaicItem[];
  initialNextCursor: string | null;
  initialFilters: SmartFilter[];
}

// --- Skeleton Cards ---

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-[20px] overflow-hidden bg-[var(--bg-elevated)] animate-pulse",
        className
      )}
    />
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 auto-rows-[8px]">
      <SkeletonCard className="col-span-1 sm:col-span-2 lg:col-span-3" style-row-span={32} />
      <SkeletonCard className="col-span-1 sm:col-span-1 lg:col-span-2" style-row-span={26} />
      <SkeletonCard className="col-span-1" style-row-span={18} />
    </div>
  );
}

// Inline style version for row spans (Tailwind can't do dynamic gridRowEnd)
function SkeletonGridWithStyles() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 auto-rows-[8px]">
      <div
        className="rounded-[20px] overflow-hidden bg-[var(--bg-elevated)] animate-pulse col-span-1 sm:col-span-2 lg:col-span-3"
        style={{ gridRowEnd: "span 32" }}
      />
      <div
        className="rounded-[20px] overflow-hidden bg-[var(--bg-elevated)] animate-pulse col-span-1 sm:col-span-2"
        style={{ gridRowEnd: "span 26" }}
      />
      <div
        className="rounded-[20px] overflow-hidden bg-[var(--bg-elevated)] animate-pulse col-span-1"
        style={{ gridRowEnd: "span 18" }}
      />
    </div>
  );
}

// --- Empty State ---

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h3
        className="text-2xl italic text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)" }}
      >
        Nothing here yet
      </h3>
      <p
        className="mt-2 text-sm text-[var(--text-secondary)]"
        style={{ fontFamily: "var(--font-instrument, 'Instrument Sans', sans-serif)" }}
      >
        Be the first to publish in this collection.
      </p>
    </div>
  );
}

// --- Main Component ---

export default function MagazineFeedClient({
  initialPosts,
  initialNextCursor,
  initialFilters,
}: MagazineFeedClientProps) {
  const [posts, setPosts] = useState<MagazineMosaicItem[]>(initialPosts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [activeFilter, setActiveFilter] = useState<SmartFilter | null>(null);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reset to initial data if initialPosts change (server re-render)
  useEffect(() => {
    setPosts(initialPosts);
    setNextCursor(initialNextCursor);
  }, [initialPosts, initialNextCursor]);

  const fetchPosts = useCallback(
    async (filter: SmartFilter | null, cursor: string | null) => {
      const params = new URLSearchParams();
      if (filter) {
        params.set("filter", JSON.stringify({ type: filter.type, value: filter.label }));
      }
      if (cursor) {
        params.set("cursor", cursor);
      }
      const res = await fetch(`/api/magazine/posts?${params.toString()}`);
      if (!res.ok) {
        console.error("[FEED] Failed to fetch posts:", res.status);
        return { posts: [] as MagazineMosaicItem[], nextCursor: null };
      }
      return res.json() as Promise<{
        posts: MagazineMosaicItem[];
        nextCursor: string | null;
      }>;
    },
    []
  );

  const handleFilterClick = useCallback(
    async (filter: SmartFilter | null) => {
      if (
        (filter === null && activeFilter === null) ||
        (filter && activeFilter && filter.id === activeFilter.id)
      ) {
        return; // Already active
      }

      setActiveFilter(filter);
      setIsFilterLoading(true);
      setPosts([]);
      setNextCursor(null);

      try {
        const data = await fetchPosts(filter, null);
        setPosts(data.posts);
        setNextCursor(data.nextCursor);
      } catch (error) {
        console.error("[FEED] Filter fetch error:", error);
        setPosts([]);
        setNextCursor(null);
      } finally {
        setIsFilterLoading(false);
      }
    },
    [activeFilter, fetchPosts]
  );

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const data = await fetchPosts(activeFilter, nextCursor);
      setPosts((prev) => [...prev, ...data.posts]);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error("[FEED] Load more error:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, activeFilter, fetchPosts]);

  return (
    <div>
      {/* Filter Chips */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
      >
        {/* "All" chip — always first */}
        <button
          onClick={() => handleFilterClick(null)}
          className={clsx(
            "folio-ui px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-full",
            activeFilter === null
              ? "ridge-btn text-[var(--text-primary)] bg-[var(--bg-elevated)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 border border-transparent"
          )}
        >
          All
        </button>

        {/* Dynamic filter chips */}
        {initialFilters.map((filter) => {
          const isActive = activeFilter?.id === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => handleFilterClick(filter)}
              className={clsx(
                "folio-ui px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-full",
                isActive
                  ? "ridge-btn text-[var(--text-primary)] bg-[var(--bg-elevated)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 border border-transparent"
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* Feed Content */}
      <div className="mt-6">
        {isFilterLoading ? (
          <SkeletonGridWithStyles />
        ) : posts.length === 0 ? (
          <EmptyState />
        ) : (
          <MagazineMosaicGrid items={posts} />
        )}
      </div>

      {/* Load More / Loading More */}
      {isLoadingMore && (
        <div className="mt-6">
          <SkeletonGridWithStyles />
        </div>
      )}

      {!isFilterLoading && !isLoadingMore && nextCursor && posts.length > 0 && (
        <div className="flex justify-center mt-10 mb-4">
          <button
            onClick={handleLoadMore}
            className="folio-ui px-6 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-full transition-all duration-200 hover:border-[var(--border-default)]"
            style={{ fontFamily: "var(--font-instrument, 'Instrument Sans', sans-serif)" }}
          >
            More stories
          </button>
        </div>
      )}
    </div>
  );
}
