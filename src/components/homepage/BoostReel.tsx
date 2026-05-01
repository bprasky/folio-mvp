// BoostReel — homepage editorial reel of products tagged in the XL post (Task 05)
//
// Cells: 7 product slots + 1 "+N View all" affordance. First two product slots
// are paid (gold "Boosted" badge). Slots 3–7 are organic, ordered by tag-creation.
//
// Instrumentation: viewability-gated impression events fire once per session
// per boosted item via IntersectionObserver. Click events on boosted cells
// carry placement: 'homepage_reel' to the analytics pipeline.

"use client";

import { useEffect, useRef } from "react";

import type { BoostReelItem } from "@/lib/homepage/getHomepageData";

import { BoostReelCell, BoostReelViewAllCell } from "./BoostReelCell";

interface Props {
  items: BoostReelItem[];
  totalTagged: number;
  postSlug: string;
}

const VIEWABILITY_THRESHOLD = 0.5; // 50% visible
const VIEWABILITY_DWELL_MS = 1000; // 1s

export function BoostReel({ items, totalTagged, postSlug }: Props) {
  const reportedRef = useRef<Set<string>>(new Set());
  const dwellTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewability-gated impression tracking for boosted cells.
  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof IntersectionObserver === "undefined") return;

    const cells = containerRef.current.querySelectorAll<HTMLElement>(
      '[data-boosted="true"]',
    );

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const boostId = el.getAttribute("data-boost-id");
          const productId = el.getAttribute("data-product-id");
          const slot = el.getAttribute("data-slot");
          if (!boostId || !productId) continue;

          if (entry.isIntersecting && entry.intersectionRatio >= VIEWABILITY_THRESHOLD) {
            if (reportedRef.current.has(boostId)) continue;
            if (dwellTimers.current.has(boostId)) continue;

            const timer = setTimeout(() => {
              if (!reportedRef.current.has(boostId)) {
                reportedRef.current.add(boostId);
                emitBoostImpression({ boostId, productId, slot: Number(slot) });
              }
              dwellTimers.current.delete(boostId);
            }, VIEWABILITY_DWELL_MS);
            dwellTimers.current.set(boostId, timer);
          } else {
            const timer = dwellTimers.current.get(boostId);
            if (timer) {
              clearTimeout(timer);
              dwellTimers.current.delete(boostId);
            }
          }
        }
      },
      { threshold: [0, VIEWABILITY_THRESHOLD, 1] },
    );

    cells.forEach((cell) => observer.observe(cell));

    return () => {
      observer.disconnect();
      dwellTimers.current.forEach(clearTimeout);
      dwellTimers.current.clear();
    };
  }, [items]);

  const handleClick = (item: BoostReelItem) => {
    if (item.isBoosted && item.boostId) {
      emitBoostClick({
        boostId: item.boostId,
        productId: item.productId,
        slot: item.slotPosition,
      });
    }
  };

  const remaining = Math.max(0, totalTagged - items.length);

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-8 gap-4"
      role="list"
      aria-label="Products tagged in this editorial"
    >
      {items.map((item) => (
        <div key={item.productId} role="listitem">
          <BoostReelCell item={item} onClick={handleClick} />
        </div>
      ))}
      {remaining > 0 && (
        <div role="listitem">
          <BoostReelViewAllCell count={remaining} postSlug={postSlug} />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Analytics emitters — colocated with the component that owns the contract.
// ────────────────────────────────────────────────────────────────────────────

interface BoostEvent {
  boostId: string;
  productId: string;
  slot: number;
}

function emitBoostImpression(evt: BoostEvent) {
  postEvent("boost_impression", { ...evt, placement: "homepage_reel" });
}

function emitBoostClick(evt: BoostEvent) {
  postEvent("boost_click", { ...evt, placement: "homepage_reel" });
}

function postEvent(name: string, payload: Record<string, unknown>) {
  // Best-effort: use sendBeacon for reliability on viewport-leave; fall back
  // to fetch with keepalive. Failures are swallowed — analytics must never
  // break the user experience.
  try {
    const body = JSON.stringify({ event: name, ...payload, ts: Date.now() });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/boost", blob);
      return;
    }
    fetch("/api/analytics/boost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* swallow */
  }
}
