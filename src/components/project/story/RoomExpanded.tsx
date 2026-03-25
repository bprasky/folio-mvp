"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { ImageTagDots } from "@/components/project/ImageTagDots";
import { logStorySignal } from "@/app/actions/posting";
import type { RoomCardData } from "@/lib/editorial/buildRoomCards";

interface Props {
  card: RoomCardData;
  roomCards: RoomCardData[];
  isDesktop: boolean;
  onClose: () => void;
  onProductTap: (tagId: string) => void;
  onNavigateRoom: (roomSlug: string) => void;
  supplementalQuotes: any[];
  projectId?: string;
  postSlug?: string;
}

export function RoomExpanded({
  card,
  roomCards,
  isDesktop,
  onClose,
  onProductTap,
  onNavigateRoom,
  supplementalQuotes,
  projectId,
  postSlug,
}: Props) {
  const enterTime = useRef(Date.now());

  // Signal: ROOM_EXPAND on mount, ROOM_DWELL on unmount
  useEffect(() => {
    enterTime.current = Date.now();
    if (projectId && postSlug) {
      logStorySignal(projectId, postSlug, "ROOM_EXPAND", { room: card.roomSlug });
    }
    return () => {
      const dwell = Date.now() - enterTime.current;
      if (projectId && postSlug) {
        logStorySignal(projectId, postSlug, "ROOM_DWELL", { room: card.roomSlug, dwellMs: dwell });
      }
    };
  }, [card.roomSlug, projectId, postSlug]);

  const prevRoom = card.index > 0 ? roomCards[card.index - 1] : null;
  const nextRoom = card.index < roomCards.length - 1 ? roomCards[card.index + 1] : null;

  return (
    <div className={`${isDesktop ? "py-6" : "pb-8"}`}>
      {/* Header — mobile only */}
      {!isDesktop && (
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 glass-sticky">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-[14px] font-[var(--font-body)] font-medium story-text-on-light"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to rooms
          </button>
          <span className="text-[14px] font-[var(--font-body)] font-medium story-text-secondary">
            {card.roomLabel}
          </span>
        </div>
      )}

      <div className={`max-w-5xl mx-auto px-4 lg:px-0 flex flex-col gap-8 ${isDesktop ? "pt-6" : "pt-4"}`}>
        {/* Hero photo with tag dots */}
        <div className="relative rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.heroImage.url}
            alt={card.roomLabel}
            className="w-full h-auto"
          />
          <ImageTagDots image={card.heroImage} />
        </div>

        {/* Pull quote */}
        {card.pullQuote && (
          <blockquote className="px-2">
            <p className="font-[var(--font-headline)] italic text-[22px] md:text-[26px] leading-relaxed story-text-on-light">
              &ldquo;{card.pullQuote}&rdquo;
            </p>
          </blockquote>
        )}

        {/* Divider */}
        <div className="border-t border-[rgba(87,75,67,0.1)]" />

        {/* Editorial narrative */}
        {card.editorialExcerpt && (
          <div className="px-2">
            <p className="text-[16px] leading-[1.7] font-[var(--font-body)] story-text-on-light whitespace-pre-line">
              {card.editorialExcerpt}
            </p>
          </div>
        )}

        {/* Secondary photos gallery */}
        {card.additionalImages.length > 0 && (
          <>
            <div className="border-t border-[rgba(87,75,67,0.1)]" />
            <div className={`grid gap-3 ${
              card.additionalImages.length === 1
                ? "grid-cols-1"
                : "grid-cols-2 lg:grid-cols-3"
            }`}>
              {card.additionalImages.map((img) => (
                <div key={img.id} className="relative rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={card.roomLabel}
                    className="w-full h-auto"
                  />
                  <ImageTagDots image={img} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Product grid */}
        {card.products.length > 0 && (
          <>
            <div className="border-t border-[rgba(87,75,67,0.1)]" />
            <div>
              <h3 className="text-[13px] font-[var(--font-body)] font-medium uppercase tracking-[0.14em] story-text-secondary mb-4">
                Products in this room
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {card.products.map((product) => (
                  <button
                    key={product.tagId}
                    onClick={() => onProductTap(product.tagId)}
                    className="glass-surface p-3 flex flex-col gap-2 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-[rgba(87,75,67,0.06)]">
                      {(product.cropUrl || product.thumbnailUrl || product.imageUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.cropUrl ?? product.thumbnailUrl ?? product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[14px] font-medium story-text-secondary">
                          {product.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-[14px] font-[var(--font-body)] font-medium story-text-on-light truncate">
                      {product.name}
                    </span>
                    {(product.vendor?.companyName ?? product.vendor?.name) && (
                      <span className="text-[13px] font-[var(--font-body)] story-text-secondary truncate">
                        {product.vendor?.companyName ?? product.vendor?.name}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Room navigation */}
        <div className="border-t border-[rgba(87,75,67,0.1)]" />
        <div className="flex items-center justify-between py-2">
          {prevRoom ? (
            <button
              onClick={() => onNavigateRoom(prevRoom.roomSlug)}
              className="flex items-center gap-1 text-[14px] font-[var(--font-body)] story-text-on-light hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-4 h-4" />
              {prevRoom.roomLabel}
            </button>
          ) : (
            <div />
          )}

          {isDesktop && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-[13px] font-[var(--font-body)] story-text-secondary hover:opacity-70 transition-opacity"
            >
              Collapse <ChevronUp className="w-4 h-4" />
            </button>
          )}

          {nextRoom ? (
            <button
              onClick={() => onNavigateRoom(nextRoom.roomSlug)}
              className="flex items-center gap-1 text-[14px] font-[var(--font-body)] story-text-on-light hover:opacity-70 transition-opacity"
            >
              {nextRoom.roomLabel}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
