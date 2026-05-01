"use client";

import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { TaggedImage } from "@/components/project/interaction/TaggedImage";
import type { RoomCardData, RoomLayout } from "@/lib/editorial/buildRoomCards";

interface Props {
  card: RoomCardData;
  isHighlighted?: boolean;
  onExpand: (roomSlug: string) => void;
  onProductTap?: (tagId: string) => void;
}

// ---------------------------------------------------------------------------
// Parallax travel distances by layout
// ---------------------------------------------------------------------------
const PARALLAX: Record<RoomLayout, number> = { A: 20, B: 20, C: 40, E: 12 };
const PARALLAX_MOBILE: Record<RoomLayout, number> = { A: 10, B: 10, C: 20, E: 6 };

export const RoomCard = forwardRef<HTMLDivElement, Props>(
  function RoomCard({ card, isHighlighted, onExpand, onProductTap }, ref) {
    const {
      roomLabel, roomSlug, heroImage, pullQuote, editorialExcerpt,
      products, productCount, layout,
    } = card;

    const excerptPreview = editorialExcerpt
      ? truncateToSentences(editorialExcerpt, 3)
      : null;
    const sidebarProducts = products.slice(0, 3);

    // --- Parallax ---
    const cardRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
      target: cardRef,
      offset: ["start end", "end start"],
    });
    const travel = PARALLAX[layout] ?? 20;
    const photoY = useTransform(scrollYProgress, [0, 1], [travel, -travel]);

    // --- Stagger reveal (desktop sidebar / full-bleed overlay) ---
    const [revealed, setRevealed] = useState(false);
    useEffect(() => {
      const el = cardRef.current;
      if (!el) return;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) { setRevealed(true); obs.disconnect(); } },
        { threshold: 0.3 },
      );
      obs.observe(el);
      return () => obs.disconnect();
    }, []);

    // --- Mobile transient overlay ---
    const [overlayState, setOverlayState] = useState<"clean" | "peek_scroll" | "peek_hold">("clean");
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchStartPos = useRef<{ x: number; y: number } | null>(null);

    // Intersection observer for scroll peek
    useEffect(() => {
      const el = cardRef.current;
      if (!el) return;
      const obs = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            setOverlayState((prev) => {
              if (prev !== "clean") return prev;
              // Auto-fade after 2s
              peekTimer.current = setTimeout(() => setOverlayState("clean"), 2000);
              return "peek_scroll";
            });
          } else {
            setOverlayState((prev) => (prev === "peek_scroll" ? "clean" : prev));
            if (peekTimer.current) clearTimeout(peekTimer.current);
          }
        },
        { rootMargin: "-30% 0px -30% 0px", threshold: 0 },
      );
      obs.observe(el);
      return () => { obs.disconnect(); if (peekTimer.current) clearTimeout(peekTimer.current); };
    }, []);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      const t = e.touches[0];
      touchStartPos.current = { x: t.clientX, y: t.clientY };
      holdTimer.current = setTimeout(() => {
        setOverlayState("peek_hold");
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(10);
      }, 300);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
      if (!touchStartPos.current) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - touchStartPos.current.x);
      const dy = Math.abs(t.clientY - touchStartPos.current.y);
      // Cancel hold if moved > 10px (scrolling)
      if (dx > 10 || dy > 10) {
        if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      }
    }, []);

    const handleTouchEnd = useCallback(() => {
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      if (overlayState === "peek_hold") {
        setOverlayState("clean");
      }
    }, [overlayState]);

    const handleMobileTap = useCallback(() => {
      // Only expand if not in a hold state
      if (overlayState !== "peek_hold") {
        onExpand(roomSlug);
      }
    }, [overlayState, onExpand, roomSlug]);

    const showOverlay = overlayState !== "clean";

    return (
      <div
        ref={(el) => {
          // Merge refs
          (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        data-room-slug={roomSlug}
        className={`rounded-xl overflow-hidden ${isHighlighted ? "story-highlight" : ""}`}
      >
        {/* ================================================================
            MOBILE LAYOUT (< lg): Transient overlay model
            ================================================================ */}
        <div
          className="lg:hidden relative cursor-pointer"
          onClick={handleMobileTap}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div
            className={`relative overflow-hidden rounded-xl story-parallax-wrap ${
              layout === "C" ? "h-[88vh]" : "h-[80vh]"
            }`}
          >
            <motion.img
              src={heroImage.url}
              alt={roomLabel}
              className="absolute inset-0 w-full h-full object-cover story-parallax-photo"
              style={{ y: photoY }}
            />

            {/* Room label — always visible (tiny pill) */}
            <div className="absolute top-4 left-4 story-glass-badge text-[var(--type-fine)] px-2 py-1">
              {roomLabel}
            </div>

            {/* Transient overlay: quote + badge */}
            <div
              className={`absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-3 story-overlay-transient ${
                showOverlay ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {pullQuote && (
                <div className="story-glass-quote px-4 py-3">
                  <p className="font-[var(--font-headline)] italic text-[var(--type-h4)] md:text-[var(--type-h4)] leading-relaxed story-text-on-dark">
                    &ldquo;{pullQuote}&rdquo;
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[var(--type-meta)] font-[var(--font-body)] story-text-on-dark opacity-80">
                  Tap to explore
                </span>
                {productCount > 0 && (
                  <div className="story-glass-badge text-[var(--type-meta)]">
                    {productCount} product{productCount !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>

            {/* Tag dots — only during long-press peek */}
            {overlayState === "peek_hold" && (
              <div className="absolute inset-0">
                <TaggedImage surface="post" image={heroImage} />
              </div>
            )}
          </div>
        </div>

        {/* ================================================================
            DESKTOP LAYOUT (>= lg): Layout-aware variants
            ================================================================ */}

        {/* Layout C: Full-bleed hero room */}
        {layout === "C" ? (
          <DesktopLayoutC
            card={card}
            excerptPreview={excerptPreview}
            sidebarProducts={sidebarProducts}
            photoY={photoY}
            revealed={revealed}
            onExpand={onExpand}
            onProductTap={onProductTap}
          />
        ) : layout === "E" ? (
          <DesktopLayoutE
            card={card}
            photoY={photoY}
            revealed={revealed}
            onExpand={onExpand}
            onProductTap={onProductTap}
          />
        ) : (
          /* Layout A and B — split with sidebar */
          <DesktopLayoutSplit
            card={card}
            excerptPreview={excerptPreview}
            sidebarProducts={sidebarProducts}
            photoY={photoY}
            revealed={revealed}
            reversed={layout === "B"}
            onExpand={onExpand}
            onProductTap={onProductTap}
          />
        )}
      </div>
    );
  }
);

// ---------------------------------------------------------------------------
// Desktop Layout A/B — Split (60/40 or 40/60 reversed)
// ---------------------------------------------------------------------------

function DesktopLayoutSplit({
  card, excerptPreview, sidebarProducts, photoY, revealed, reversed, onExpand, onProductTap,
}: {
  card: RoomCardData;
  excerptPreview: string | null;
  sidebarProducts: RoomCardData["products"];
  photoY: any;
  revealed: boolean;
  reversed: boolean;
  onExpand: (slug: string) => void;
  onProductTap?: (tagId: string) => void;
}) {
  return (
    <div className={`hidden lg:flex rounded-xl overflow-hidden h-[70vh] min-h-[500px] ${
      reversed ? "flex-row-reverse" : ""
    }`}>
      {/* Photo area (60%) */}
      <div
        className="relative w-[60%] cursor-pointer group story-parallax-wrap"
        onClick={() => onExpand(card.roomSlug)}
      >
        <motion.img
          src={card.heroImage.url}
          alt={card.roomLabel}
          className="absolute inset-0 w-full h-full object-cover story-parallax-photo"
          style={{ y: photoY }}
        />
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <TaggedImage surface="post" image={card.heroImage} />
        </div>
      </div>

      {/* Sidebar (40%) */}
      <div className={`w-[40%] story-glass-sidebar flex flex-col justify-between p-6 overflow-y-auto ${
        revealed ? "story-revealed" : ""
      } ${reversed ? "border-r border-l-0 rounded-l-xl rounded-r-none !border-radius-0" : ""}`}
        style={reversed ? { borderLeft: "none", borderRight: "1px solid rgba(255,252,248,0.3)", borderRadius: "12px 0 0 12px" } : undefined}
      >
        <div className="flex flex-col gap-4">
          <h3 className="story-reveal-child font-[var(--font-body)] font-medium text-[var(--type-ui)] uppercase tracking-[var(--ls-eyebrow)] story-text-secondary">
            {card.roomLabel}
          </h3>
          {card.pullQuote && (
            <blockquote className="story-reveal-child story-reveal-delay-1 font-[var(--font-headline)] italic text-[var(--type-h4)] leading-relaxed story-text-on-light">
              &ldquo;{card.pullQuote}&rdquo;
            </blockquote>
          )}
          <div className="story-reveal-child story-reveal-delay-2 border-t border-[rgba(87,75,67,0.1)]" />
          {excerptPreview && (
            <div className="story-reveal-child story-reveal-delay-3 relative">
              <p className="text-[var(--type-body)] leading-relaxed font-[var(--font-body)] story-text-on-light">
                {excerptPreview}
              </p>
              {card.editorialExcerpt && card.editorialExcerpt.length > (excerptPreview?.length ?? 0) && (
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[rgba(255,252,248,0.55)] to-transparent" />
              )}
            </div>
          )}
          <div className="story-reveal-child story-reveal-delay-3 border-t border-[rgba(87,75,67,0.1)]" />
          {sidebarProducts.length > 0 && (
            <div className="story-reveal-child story-reveal-delay-4">
              <span className="text-[var(--type-meta)] font-[var(--font-body)] uppercase tracking-[var(--ls-wide)] story-text-secondary mb-2 block">
                Products
              </span>
              <div className="flex gap-2">
                {sidebarProducts.map((product) => (
                  <button
                    key={product.tagId}
                    onClick={(e) => { e.stopPropagation(); onProductTap?.(product.tagId); }}
                    className="group/product flex flex-col items-center gap-1 w-[72px]"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-[rgba(87,75,67,0.08)] transition-transform group-hover/product:-translate-y-0.5">
                      {(product.cropUrl || product.thumbnailUrl || product.imageUrl) ? (
                        <img src={product.cropUrl ?? product.thumbnailUrl ?? product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--type-fine)] font-medium story-text-secondary">
                          {product.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-[var(--type-eyebrow)] font-[var(--font-body)] story-text-on-light truncate w-full text-center">
                      {product.name}
                    </span>
                  </button>
                ))}
                {card.productCount > 3 && (
                  <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-[rgba(87,75,67,0.05)] text-[var(--type-meta)] story-text-secondary">
                    +{card.productCount - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => onExpand(card.roomSlug)}
          className="story-reveal-child story-reveal-delay-5 mt-4 text-[var(--type-ui)] font-[var(--font-body)] font-medium story-text-on-light hover:opacity-70 transition-opacity self-start"
        >
          Explore full room →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop Layout C — Full-Bleed Hero Room
// ---------------------------------------------------------------------------

function DesktopLayoutC({
  card, excerptPreview, sidebarProducts, photoY, revealed, onExpand, onProductTap,
}: {
  card: RoomCardData;
  excerptPreview: string | null;
  sidebarProducts: RoomCardData["products"];
  photoY: any;
  revealed: boolean;
  onExpand: (slug: string) => void;
  onProductTap?: (tagId: string) => void;
}) {
  return (
    <div
      className={`hidden lg:block relative rounded-xl overflow-hidden h-[80vh] min-h-[600px] cursor-pointer group story-parallax-wrap ${
        revealed ? "story-revealed" : ""
      }`}
      onClick={() => onExpand(card.roomSlug)}
    >
      <motion.img
        src={card.heroImage.url}
        alt={card.roomLabel}
        className="absolute inset-0 w-full h-full object-cover story-parallax-photo"
        style={{ y: photoY }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {/* Tag dots on hover */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <TaggedImage surface="post" image={card.heroImage} />
      </div>

      {/* Glass overlay — bottom left */}
      <div className="absolute bottom-6 left-6 max-w-md story-glass-quote px-5 py-4">
        <h3 className="story-reveal-child font-[var(--font-body)] font-medium text-[var(--type-ui)] uppercase tracking-[var(--ls-eyebrow)] story-text-on-dark opacity-80">
          {card.roomLabel}
        </h3>
        {card.pullQuote && (
          <p className="story-reveal-child story-reveal-delay-1 mt-2 font-[var(--font-headline)] italic text-[var(--type-h4)] leading-relaxed story-text-on-dark">
            &ldquo;{card.pullQuote}&rdquo;
          </p>
        )}
        {excerptPreview && (
          <p className="story-reveal-child story-reveal-delay-2 mt-2 text-[var(--type-ui)] leading-relaxed font-[var(--font-body)] story-text-on-dark opacity-80 line-clamp-3">
            {excerptPreview}
          </p>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onExpand(card.roomSlug); }}
          className="story-reveal-child story-reveal-delay-3 mt-3 text-[var(--type-ui)] font-[var(--font-body)] font-medium story-text-on-dark hover:opacity-70 transition-opacity"
        >
          Explore full room →
        </button>
      </div>

      {/* Product pills — bottom right */}
      {sidebarProducts.length > 0 && (
        <div className="absolute bottom-6 right-6 flex gap-2">
          {sidebarProducts.map((product) => (
            <button
              key={product.tagId}
              onClick={(e) => { e.stopPropagation(); onProductTap?.(product.tagId); }}
              className="story-reveal-child story-reveal-delay-4 story-glass-badge flex items-center gap-2 hover:scale-105 transition-transform"
            >
              {(product.cropUrl || product.thumbnailUrl || product.imageUrl) && (
                <img
                  src={product.cropUrl ?? product.thumbnailUrl ?? product.imageUrl}
                  alt={product.name}
                  className="w-6 h-6 rounded object-cover"
                />
              )}
              <span className="text-[var(--type-eyebrow)] max-w-[80px] truncate">{product.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop Layout E — Condensed (for detail strip pairing)
// ---------------------------------------------------------------------------

function DesktopLayoutE({
  card, photoY, revealed, onExpand, onProductTap,
}: {
  card: RoomCardData;
  photoY: any;
  revealed: boolean;
  onExpand: (slug: string) => void;
  onProductTap?: (tagId: string) => void;
}) {
  return (
    <div
      className={`hidden lg:flex flex-col rounded-xl overflow-hidden cursor-pointer ${
        revealed ? "story-revealed" : ""
      }`}
      onClick={() => onExpand(card.roomSlug)}
    >
      {/* Photo — shorter */}
      <div className="relative h-[50vh] min-h-[320px] story-parallax-wrap">
        <motion.img
          src={card.heroImage.url}
          alt={card.roomLabel}
          className="absolute inset-0 w-full h-full object-cover story-parallax-photo"
          style={{ y: photoY }}
        />
      </div>

      {/* Condensed info */}
      <div className="p-4 story-glass-sidebar rounded-t-none rounded-b-xl border-l-0 border-t border-[rgba(255,252,248,0.3)]"
        style={{ borderLeft: "none", borderRadius: "0 0 12px 12px" }}
      >
        <h3 className="story-reveal-child font-[var(--font-body)] font-medium text-[var(--type-ui)] uppercase tracking-[var(--ls-eyebrow)] story-text-secondary">
          {card.roomLabel}
        </h3>
        {card.pullQuote && (
          <p className="story-reveal-child story-reveal-delay-1 mt-2 font-[var(--font-headline)] italic text-[var(--type-body)] leading-relaxed story-text-on-light line-clamp-2">
            &ldquo;{card.pullQuote}&rdquo;
          </p>
        )}
        <div className="story-reveal-child story-reveal-delay-2 mt-3 flex items-center justify-between">
          {card.productCount > 0 && (
            <span className="text-[var(--type-meta)] font-[var(--font-body)] story-text-secondary">
              {card.productCount} product{card.productCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-[var(--type-meta)] font-[var(--font-body)] font-medium story-text-on-light">
            Explore →
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateToSentences(text: string, maxSentences: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text.slice(0, 200);
  return sentences.slice(0, maxSentences).join(" ").trim();
}
