"use client";

import { RoomCard } from "./RoomCard";
import type { RoomCardData } from "@/lib/editorial/buildRoomCards";

interface Props {
  cards: [RoomCardData, RoomCardData];
  isHighlightedSlug: string | null;
  onExpand: (roomSlug: string) => void;
  onProductTap?: (tagId: string) => void;
  roomRefCallback: (slug: string, el: HTMLDivElement | null) => void;
}

export function RoomDetailStrip({
  cards,
  isHighlightedSlug,
  onExpand,
  onProductTap,
  roomRefCallback,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
      {cards.map((card) => (
        <RoomCard
          key={card.roomId}
          ref={(el) => roomRefCallback(card.roomSlug, el)}
          card={card}
          isHighlighted={isHighlightedSlug === card.roomSlug}
          onExpand={onExpand}
          onProductTap={onProductTap}
        />
      ))}
    </div>
  );
}
