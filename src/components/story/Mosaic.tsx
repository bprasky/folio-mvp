"use client";

// Mosaic — The CSS grid orchestrator. Rule 5: The Mosaic Flows.
//
// 2-column grid with 10px gaps. Iterates over roomTiles, renders
// RoomTilePair + RoomExpand for each, inserts BreatherQuote at positions
// defined by breathers data. Multiple rooms can be expanded simultaneously
// — expansion happens in-place inside QuoteTile, so per-room state has no
// global cost.

import { useState, useCallback, useEffect } from "react";
import { RoomTilePair } from "./RoomTilePair";
import { RoomExpand } from "./RoomExpand";
import { BreatherQuote } from "./BreatherQuote";
import type { RoomTileData, BreatherData } from "@/lib/story/buildRoomTiles";

interface MosaicProps {
  roomTiles: RoomTileData[];
  breathers: BreatherData[];
  supplementalQuotes: any[];
  onProductClick: (product: any) => void;
  /** Room slug to auto-expand (from URL ?room= param) */
  autoExpandRoom?: string | null;
  reducedMotion: boolean;
}

export function Mosaic({
  roomTiles,
  breathers,
  supplementalQuotes,
  onProductClick,
  autoExpandRoom,
  reducedMotion,
}: MosaicProps) {
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(() => new Set());

  // Auto-expand from deep link
  useEffect(() => {
    if (autoExpandRoom) {
      setExpandedSlugs((prev) => {
        const next = new Set(prev);
        next.add(autoExpandRoom);
        return next;
      });
      // Scroll to room after a brief delay for rendering
      const timer = setTimeout(() => {
        const el = document.getElementById(`room-${autoExpandRoom}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [autoExpandRoom]);

  const handleToggle = useCallback((roomSlug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(roomSlug)) next.delete(roomSlug);
      else next.add(roomSlug);
      return next;
    });
  }, []);

  const handleCollapse = useCallback((roomSlug: string) => {
    setExpandedSlugs((prev) => {
      if (!prev.has(roomSlug)) return prev;
      const next = new Set(prev);
      next.delete(roomSlug);
      return next;
    });
  }, []);

  // Build a breather lookup: afterRoomSlug → BreatherData
  const breatherMap = new Map<string, BreatherData>();
  for (const b of breathers) {
    breatherMap.set(b.insertAfterRoomSlug, b);
  }

  return (
    <div className="grid grid-cols-2 gap-[10px]">
      {roomTiles.map((room, index) => {
        const isExpanded = expandedSlugs.has(room.roomSlug);
        const breather = breatherMap.get(room.roomSlug);

        return (
          <div key={room.roomId} className="contents">
            <RoomTilePair
              room={room}
              index={index}
              isExpanded={isExpanded}
              onToggle={() => handleToggle(room.roomSlug)}
              onProductClick={onProductClick}
              reducedMotion={reducedMotion}
            />

            <RoomExpand
              room={room}
              isOpen={isExpanded}
              onCollapse={() => handleCollapse(room.roomSlug)}
              onProductClick={onProductClick}
              reducedMotion={reducedMotion}
            />

            {breather && (
              <BreatherQuote
                quote={breather.quote}
                attribution={breather.attribution}
                reducedMotion={reducedMotion}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
