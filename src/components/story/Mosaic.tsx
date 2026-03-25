"use client";

// Mosaic — The CSS grid orchestrator. Rule 5: The Mosaic Flows.
//
// 2-column grid with 10px gaps. Iterates over roomTiles, renders
// RoomTilePair + RoomExpand for each, inserts BreatherQuote at positions
// defined by breathers data. Manages expand state (only one room open).

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
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  // Auto-expand from deep link
  useEffect(() => {
    if (autoExpandRoom) {
      setExpandedSlug(autoExpandRoom);
      // Scroll to room after a brief delay for rendering
      const timer = setTimeout(() => {
        const el = document.getElementById(`room-${autoExpandRoom}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [autoExpandRoom]);

  const handleToggle = useCallback(
    (roomSlug: string) => {
      setExpandedSlug((prev) => (prev === roomSlug ? null : roomSlug));
    },
    []
  );

  // Build a breather lookup: afterRoomSlug → BreatherData
  const breatherMap = new Map<string, BreatherData>();
  for (const b of breathers) {
    breatherMap.set(b.insertAfterRoomSlug, b);
  }

  return (
    <div className="grid grid-cols-2 gap-[10px]">
      {roomTiles.map((room) => {
        const isExpanded = expandedSlug === room.roomSlug;
        const breather = breatherMap.get(room.roomSlug);

        return (
          <div key={room.roomId} className="contents">
            <RoomTilePair
              room={room}
              isExpanded={isExpanded}
              onToggle={() => handleToggle(room.roomSlug)}
              reducedMotion={reducedMotion}
            />

            <RoomExpand
              room={room}
              isOpen={isExpanded}
              onCollapse={() => setExpandedSlug(null)}
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
