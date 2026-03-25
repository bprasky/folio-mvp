"use client";

import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RoomCard } from "./RoomCard";
import { RoomExpanded } from "./RoomExpanded";
import { BreatherQuote } from "./BreatherQuote";
import { RoomDetailStrip } from "./RoomDetailStrip";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import type { RoomCardData, BreatherData } from "@/lib/editorial/buildRoomCards";

interface Props {
  roomCards: RoomCardData[];
  breathers: BreatherData[];
  expandedRoomSlug: string | null;
  highlightedRoomSlug: string | null;
  onExpandRoom: (roomSlug: string) => void;
  onCollapseRoom: () => void;
  onProductTap: (tagId: string) => void;
  supplementalQuotes: any[];
  projectId?: string;
  postSlug?: string;
  roomRefCallback: (slug: string, el: HTMLDivElement | null) => void;
}

export function RoomIndex({
  roomCards,
  breathers,
  expandedRoomSlug,
  highlightedRoomSlug,
  onExpandRoom,
  onCollapseRoom,
  onProductTap,
  supplementalQuotes,
  projectId,
  postSlug,
  roomRefCallback,
}: Props) {
  const isDesktop = useIsDesktop();

  const expandedCard = expandedRoomSlug
    ? roomCards.find((c) => c.roomSlug === expandedRoomSlug)
    : null;

  // Build breather lookup: slug → breather
  const breatherMap = useMemo(() => {
    const m = new Map<string, BreatherData>();
    for (const b of breathers) m.set(b.insertAfterRoomSlug, b);
    return m;
  }, [breathers]);

  // Build paired E-card groups for desktop detail strips
  const ePairs = useMemo(() => {
    const pairs = new Map<string, [RoomCardData, RoomCardData]>();
    const seen = new Set<string>();
    for (const card of roomCards) {
      if (card.layout === "E" && card.pairedWith && !seen.has(card.roomSlug)) {
        const partner = roomCards.find((c) => c.roomSlug === card.pairedWith);
        if (partner) {
          pairs.set(card.roomSlug, [card, partner]);
          seen.add(card.roomSlug);
          seen.add(partner.roomSlug);
        }
      }
    }
    return { pairs, seen };
  }, [roomCards]);

  // Render items: iterate cards, skip second of E pairs, insert breathers
  const items: React.ReactNode[] = [];
  for (let i = 0; i < roomCards.length; i++) {
    const card = roomCards[i];

    // Skip if this card is the second partner in an E-pair (already rendered with first)
    if (ePairs.seen.has(card.roomSlug) && !ePairs.pairs.has(card.roomSlug)) {
      continue;
    }

    // E-pair: render detail strip
    if (isDesktop && ePairs.pairs.has(card.roomSlug)) {
      const pair = ePairs.pairs.get(card.roomSlug)!;
      items.push(
        <RoomDetailStrip
          key={`strip-${card.roomSlug}`}
          cards={pair}
          isHighlightedSlug={highlightedRoomSlug}
          onExpand={onExpandRoom}
          onProductTap={onProductTap}
          roomRefCallback={roomRefCallback}
        />
      );
    } else {
      // Regular card
      const isExpanded = expandedRoomSlug === card.roomSlug;
      items.push(
        <div key={card.roomId}>
          <RoomCard
            ref={(el) => roomRefCallback(card.roomSlug, el)}
            card={card}
            isHighlighted={highlightedRoomSlug === card.roomSlug}
            onExpand={onExpandRoom}
            onProductTap={onProductTap}
          />

          {/* Desktop: inline expansion below the card */}
          {isDesktop && (
            <AnimatePresence>
              {isExpanded && expandedCard && (
                <motion.div
                  key={`expanded-${card.roomSlug}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <RoomExpanded
                    card={expandedCard}
                    roomCards={roomCards}
                    isDesktop
                    onClose={onCollapseRoom}
                    onProductTap={onProductTap}
                    onNavigateRoom={onExpandRoom}
                    supplementalQuotes={supplementalQuotes}
                    projectId={projectId}
                    postSlug={postSlug}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      );
    }

    // Insert breather after this card if one exists
    const breather = breatherMap.get(card.roomSlug);
    if (breather) {
      items.push(
        <BreatherQuote key={`breather-${card.roomSlug}`} breather={breather} />
      );
    }
  }

  return (
    <div className="flex flex-col gap-3 lg:gap-6 px-3 lg:px-0 max-w-6xl mx-auto">
      {items}
    </div>
  );
}
