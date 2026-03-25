"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { ImageTagDots } from "@/components/project/ImageTagDots";
import type { RoomCardData } from "@/lib/editorial/buildRoomCards";

interface Props {
  card: RoomCardData;
  isHighlighted?: boolean;
  onExpand: (roomSlug: string) => void;
  onProductTap?: (tagId: string) => void;
}

export const RoomCard = forwardRef<HTMLDivElement, Props>(
  function RoomCard({ card, isHighlighted, onExpand, onProductTap }, ref) {
    const {
      roomLabel,
      roomSlug,
      heroImage,
      pullQuote,
      editorialExcerpt,
      products,
      productCount,
    } = card;

    // First 2-3 sentences for desktop sidebar excerpt
    const excerptPreview = editorialExcerpt
      ? truncateToSentences(editorialExcerpt, 3)
      : null;

    // Top 3 products for desktop sidebar thumbnails
    const sidebarProducts = products.slice(0, 3);

    return (
      <div
        ref={ref}
        data-room-slug={roomSlug}
        className={`rounded-xl overflow-hidden ${isHighlighted ? "story-highlight" : ""}`}
      >
        {/* ---- MOBILE LAYOUT (< lg): Photo with glass overlay ---- */}
        <motion.div
          className="lg:hidden relative cursor-pointer"
          whileTap={{ scale: 0.98 }}
          onClick={() => onExpand(roomSlug)}
        >
          {/* Photo */}
          <div className="relative h-[80vh] overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage.url}
              alt={roomLabel}
              className="w-full h-full object-cover"
            />

            {/* Gradient for text readability */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

            {/* Room label — top left */}
            <div className="absolute top-4 left-4 story-glass-badge">
              {roomLabel}
            </div>

            {/* Pull quote + product badge — bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-3">
              {pullQuote && (
                <div className="story-glass-quote px-4 py-3">
                  <p className="font-[var(--font-headline)] italic text-[18px] md:text-[20px] leading-relaxed story-text-on-dark">
                    &ldquo;{pullQuote}&rdquo;
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-[var(--font-body)] story-text-on-dark opacity-80">
                  Tap to explore
                </span>
                {productCount > 0 && (
                  <div className="story-glass-badge text-[12px]">
                    {productCount} product{productCount !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ---- DESKTOP LAYOUT (>= lg): Split photo + sidebar ---- */}
        <div className="hidden lg:flex rounded-xl overflow-hidden h-[70vh] min-h-[500px]">
          {/* Photo area (60%) — tags on hover */}
          <div
            className="relative w-[60%] cursor-pointer group"
            onClick={() => onExpand(roomSlug)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage.url}
              alt={roomLabel}
              className="w-full h-full object-cover"
            />

            {/* Tag dots — fade in on hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <ImageTagDots image={heroImage} />
            </div>
          </div>

          {/* Sidebar (40%) */}
          <div className="w-[40%] story-glass-sidebar flex flex-col justify-between p-6 overflow-y-auto">
            <div className="flex flex-col gap-4">
              {/* Room label */}
              <h3 className="font-[var(--font-body)] font-medium text-[14px] uppercase tracking-[0.16em] story-text-secondary">
                {roomLabel}
              </h3>

              {/* Pull quote */}
              {pullQuote && (
                <blockquote className="font-[var(--font-headline)] italic text-[20px] leading-relaxed story-text-on-light">
                  &ldquo;{pullQuote}&rdquo;
                </blockquote>
              )}

              {/* Divider */}
              <div className="border-t border-[rgba(87,75,67,0.1)]" />

              {/* Editorial excerpt with fade */}
              {excerptPreview && (
                <div className="relative">
                  <p className="text-[15px] leading-relaxed font-[var(--font-body)] story-text-on-light">
                    {excerptPreview}
                  </p>
                  {editorialExcerpt && editorialExcerpt.length > excerptPreview.length && (
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[rgba(255,252,248,0.55)] to-transparent" />
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-[rgba(87,75,67,0.1)]" />

              {/* Product thumbnails */}
              {sidebarProducts.length > 0 && (
                <div>
                  <span className="text-[12px] font-[var(--font-body)] uppercase tracking-[0.12em] story-text-secondary mb-2 block">
                    Products
                  </span>
                  <div className="flex gap-2">
                    {sidebarProducts.map((product) => (
                      <button
                        key={product.tagId}
                        onClick={(e) => {
                          e.stopPropagation();
                          onProductTap?.(product.tagId);
                        }}
                        className="group/product flex flex-col items-center gap-1 w-[72px]"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-[rgba(87,75,67,0.08)] transition-transform group-hover/product:-translate-y-0.5">
                          {(product.cropUrl || product.thumbnailUrl || product.imageUrl) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.cropUrl ?? product.thumbnailUrl ?? product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-medium story-text-secondary">
                              {product.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-[var(--font-body)] story-text-on-light truncate w-full text-center">
                          {product.name}
                        </span>
                      </button>
                    ))}
                    {productCount > 3 && (
                      <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-[rgba(87,75,67,0.05)] text-[12px] story-text-secondary">
                        +{productCount - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Explore link */}
            <button
              onClick={() => onExpand(roomSlug)}
              className="mt-4 text-[14px] font-[var(--font-body)] font-medium story-text-on-light hover:opacity-70 transition-opacity self-start"
            >
              Explore full room →
            </button>
          </div>
        </div>
      </div>
    );
  }
);

/** Truncate text to N sentences. */
function truncateToSentences(text: string, maxSentences: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text.slice(0, 200);
  return sentences.slice(0, maxSentences).join(" ").trim();
}
