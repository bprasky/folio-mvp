"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { buildRoomCards } from "@/lib/editorial/buildRoomCards";
import { useIsDesktop } from "@/hooks/useMediaQuery";
import { logStorySignal } from "@/app/actions/posting";
import { StoryHero } from "./StoryHero";
import { RoomIndex } from "./RoomIndex";
import { RoomExpanded } from "./RoomExpanded";
import { ProductSheet } from "./ProductSheet";
import { StoryCredits } from "./StoryCredits";

interface Props {
  post: any;
}

export function StoryRenderer({ post }: Props) {
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();

  const storyData = useMemo(() => buildRoomCards(post), [post]);

  // --- State ---
  const [expandedRoomSlug, setExpandedRoomSlug] = useState<string | null>(null);
  const [activeProductTagId, setActiveProductTagId] = useState<string | null>(null);
  const [highlightedRoomSlug, setHighlightedRoomSlug] = useState<string | null>(null);
  const [deepLinked, setDeepLinked] = useState(false);

  // Scroll position to restore when collapsing room
  const savedScrollY = useRef<number>(0);

  // Room element refs for scroll targeting
  const roomRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const roomRefCallback = useCallback(
    (slug: string, el: HTMLDivElement | null) => {
      if (el) roomRefs.current.set(slug, el);
      else roomRefs.current.delete(slug);
    },
    []
  );

  // --- Handlers ---
  const scrollToRoom = useCallback((roomSlug: string) => {
    const el = roomRefs.current.get(roomSlug);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleExpandRoom = useCallback(
    (roomSlug: string) => {
      if (!isDesktop) {
        savedScrollY.current = window.scrollY;
      }
      setExpandedRoomSlug(roomSlug);
      setHighlightedRoomSlug(null);
    },
    [isDesktop]
  );

  const handleCollapseRoom = useCallback(() => {
    const slug = expandedRoomSlug;
    setExpandedRoomSlug(null);
    setActiveProductTagId(null);

    if (!isDesktop) {
      // Restore scroll after overlay closes
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollY.current);
      });
    } else if (slug) {
      // Scroll collapsed card back into view on desktop
      requestAnimationFrame(() => scrollToRoom(slug));
    }
  }, [expandedRoomSlug, isDesktop, scrollToRoom]);

  const handleProductTap = useCallback((tagId: string) => {
    setActiveProductTagId(tagId);
  }, []);

  const handleCloseProductSheet = useCallback(() => {
    setActiveProductTagId(null);
  }, []);

  // --- Keyboard: Escape closes product sheet or expanded room ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeProductTagId) {
          setActiveProductTagId(null);
        } else if (expandedRoomSlug) {
          handleCollapseRoom();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeProductTagId, expandedRoomSlug, handleCollapseRoom]);

  // --- Deep linking ---
  useEffect(() => {
    if (deepLinked) return;

    const roomParam = searchParams.get("room");
    const productParam = searchParams.get("product");
    const expandParam = searchParams.get("expand");
    const refParam = searchParams.get("ref");

    if (!roomParam) return;

    // Wait for room refs to be populated
    const timer = setTimeout(() => {
      // Track attribution
      if (refParam && post?.projectId && storyData.slug) {
        logStorySignal(post.projectId, storyData.slug, "INBOUND_REFERRAL", {
          ref: refParam,
          room: roomParam,
          product: productParam,
        });
      }

      // Scroll to room
      scrollToRoom(roomParam);
      setHighlightedRoomSlug(roomParam);

      if (expandParam === "true" || productParam) {
        setTimeout(() => {
          handleExpandRoom(roomParam);

          if (productParam) {
            setTimeout(() => {
              setActiveProductTagId(productParam);
            }, 400);
          }
        }, 500);
      }

      setDeepLinked(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchParams, deepLinked, scrollToRoom, handleExpandRoom]);

  // --- Find active product across all room cards ---
  const activeProduct = useMemo(() => {
    if (!activeProductTagId) return null;
    for (const card of storyData.roomCards) {
      for (const product of card.products) {
        if (product.tagId === activeProductTagId) return product;
      }
    }
    return null;
  }, [activeProductTagId, storyData.roomCards]);

  // Find images containing the active product for in-situ display
  const activeProductImages = useMemo(() => {
    if (!activeProduct) return [];
    const images: { url: string; id: string }[] = [];
    for (const card of storyData.roomCards) {
      const allImages = [card.heroImage, ...card.additionalImages];
      for (const img of allImages) {
        if (img.tags?.some((t: any) => t.product?.id === activeProduct.id)) {
          images.push({ url: img.url, id: img.id });
        }
      }
    }
    return images;
  }, [activeProduct, storyData.roomCards]);

  // Expanded room card data
  const expandedCard = expandedRoomSlug
    ? storyData.roomCards.find((c) => c.roomSlug === expandedRoomSlug)
    : null;

  // Edge case: no room cards at all (no chapters, no images)
  if (storyData.roomCards.length === 0 && !storyData.heroImage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[16px] font-[var(--font-body)] story-text-secondary">
          No content available for this project.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Layer 0: Hero */}
      <StoryHero
        storyData={storyData}
        onScrollToRoom={scrollToRoom}
        activeRoomSlug={expandedRoomSlug}
      />

      {/* Layer 1: Room Index */}
      <div className="py-6 lg:py-12">
        <RoomIndex
          roomCards={storyData.roomCards}
          breathers={storyData.breathers}
          expandedRoomSlug={expandedRoomSlug}
          highlightedRoomSlug={highlightedRoomSlug}
          onExpandRoom={handleExpandRoom}
          onCollapseRoom={handleCollapseRoom}
          onProductTap={handleProductTap}
          supplementalQuotes={storyData.supplementalQuotes}
          projectId={post?.projectId}
          postSlug={storyData.slug}
          roomRefCallback={roomRefCallback}
        />
      </div>

      {/* Credits */}
      <StoryCredits post={post} />

      {/* Layer 2: Mobile overlay for expanded room */}
      {!isDesktop && (
        <AnimatePresence>
          {expandedCard && (
            <motion.div
              key="room-expanded-overlay"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-0 z-50 bg-surface-canvas overflow-y-auto"
            >
              <RoomExpanded
                card={expandedCard}
                roomCards={storyData.roomCards}
                isDesktop={false}
                onClose={handleCollapseRoom}
                onProductTap={handleProductTap}
                onNavigateRoom={handleExpandRoom}
                supplementalQuotes={storyData.supplementalQuotes}
                projectId={post?.projectId}
                postSlug={storyData.slug}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Layer 3: Product Sheet */}
      <ProductSheet
        product={activeProduct}
        inSituImages={activeProductImages}
        supplementalQuotes={storyData.supplementalQuotes}
        isDesktop={isDesktop}
        onClose={handleCloseProductSheet}
        projectId={post?.projectId}
        postSlug={storyData.slug}
      />
    </div>
  );
}
