"use client";

import { AnimatePresence, motion } from "framer-motion";
import { RoomCard } from "./RoomCard";
import { RoomExpanded } from "./RoomExpanded";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import type { RoomCardData } from "@/lib/editorial/buildRoomCards";

interface Props {
  roomCards: RoomCardData[];
  expandedRoomSlug: string | null;
  highlightedRoomSlug: string | null;
  onExpandRoom: (roomSlug: string) => void;
  onCollapseRoom: () => void;
  onProductTap: (tagId: string) => void;
  supplementalQuotes: any[];
  projectId?: string;
  postSlug?: string;
  /** Ref map so parent can scroll to rooms */
  roomRefCallback: (slug: string, el: HTMLDivElement | null) => void;
}

export function RoomIndex({
  roomCards,
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

  return (
    <div className="flex flex-col gap-3 lg:gap-6 px-3 lg:px-0 max-w-6xl mx-auto">
      {roomCards.map((card) => {
        const isExpanded = expandedRoomSlug === card.roomSlug;

        return (
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
      })}
    </div>
  );
}
