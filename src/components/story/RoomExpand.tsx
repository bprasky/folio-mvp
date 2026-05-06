"use client";

// RoomExpand — Full-width page-filling expansion for a room.
// When expanded, the room's hero photo fills the full width and gallery
// images are large and immersive. Collapsing returns to the mosaic.
// Rule 4: Expand Is the Only Way to Get Depth.

import { useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { TaggedImage } from "@/components/project/interaction/TaggedImage";
import type { RoomTileData } from "@/lib/story/buildRoomTiles";

interface RoomExpandProps {
  room: RoomTileData;
  isOpen: boolean;
  onCollapse: () => void;
  onProductClick: (product: any) => void;
  reducedMotion: boolean;
}

export function RoomExpand({
  room,
  isOpen,
  onCollapse,
  onProductClick,
  reducedMotion,
}: RoomExpandProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll expanded section into view
  useEffect(() => {
    if (isOpen && contentRef.current) {
      const timer = setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          ref={contentRef}
          className="col-span-2 overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { height: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.3, delay: 0.08 } }
          }
        >
          <div className="py-6">
            {/* Room label + collapse */}
            <div className="flex items-center justify-between mb-6">
              <span
                className="uppercase tracking-[1.5px]" /* folio-design-system: off-scale */
                style={{
                  fontSize: 'var(--type-fine)',
                  fontWeight: 'var(--w-h1)',
                  color: "rgba(87, 75, 67, 0.55)"
                }}
              >
                {room.roomLabel}
              </span>
              <button
                onClick={onCollapse}
                className="text-[var(--type-eyebrow)] transition-colors hover:opacity-70"
                style={{
                  color: "rgba(87, 75, 67, 0.3)"
                }}
              >
                Collapse ↑
              </button>
            </div>

            {/* Editorial narrative */}
            {room.editorialNarrative && (
              <div className="mb-8" style={{ maxWidth: "var(--story-prose-width)" }}>
                <p
                  className="whitespace-pre-line"
                  style={{
                    fontSize: 'var(--type-body)',
                    lineHeight: 1.75, /* folio-design-system: off-scale */
                    color: "rgba(87, 75, 67, 0.85)"
                  }}
                >
                  {room.editorialNarrative}
                </p>
              </div>
            )}

            {/* Gallery — large immersive images, not thumbnails */}
            {room.additionalImages.length > 0 && (
              <div className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px]">
                  {room.additionalImages.map((img) => (
                    <div
                      key={img.id}
                      className="relative w-full overflow-hidden rounded-[12px]"
                    >
                      <Image
                        src={img.url}
                        alt={room.roomLabel}
                        width={960}
                        height={640}
                        className="w-full h-auto"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                      {/* Tag dots always visible in expanded gallery */}
                      <TaggedImage surface="post" image={img} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tagged products */}
            {room.products.length > 0 && (
              <div className="mb-6">
                <h4
                  className="mb-3 uppercase tracking-[1.5px]" /* folio-design-system: off-scale */
                  style={{
                    fontSize: 'var(--type-fine)',
                    fontWeight: 'var(--w-h1)',
                    color: "rgba(87, 75, 67, 0.3)"
                  }}
                >
                  Tagged Products
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {room.products.map((product: any) => (
                    <button
                      key={product.id}
                      onClick={() => onProductClick(product)}
                      className="flex items-center gap-2.5 p-2 rounded-[10px] text-left transition-colors hover:bg-[rgba(87,75,67,0.04)]"
                    >
                      {(product.imageUrl || product.primaryImageUrl || product.thumbnailUrl) && (
                        <div className="h-9 w-9 flex-shrink-0 rounded-lg overflow-hidden bg-[rgba(87,75,67,0.04)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.imageUrl || product.primaryImageUrl || product.thumbnailUrl}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div
                          className="truncate"
                          style={{
                            fontSize: 'var(--type-meta)',
                            fontWeight: 'var(--w-h1)',
                            color: "rgba(87, 75, 67, 0.85)"
                          }}
                        >
                          {product.name}
                        </div>
                        {(product.vendor?.name || product.vendor?.companyName) && (
                          <div
                            className="truncate"
                            style={{
                              fontSize: 'var(--type-eyebrow)',
                              color: "rgba(87, 75, 67, 0.45)"
                            }}
                          >
                            {product.vendor.name || product.vendor.companyName}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom collapse */}
            <div
              className="flex justify-end pt-4 border-t"
              style={{ borderColor: "rgba(87, 75, 67, 0.06)" }}
            >
              <button
                onClick={onCollapse}
                className="text-[var(--type-eyebrow)] transition-colors hover:opacity-70"
                style={{
                  color: "rgba(87, 75, 67, 0.3)"
                }}
              >
                Collapse ↑
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
