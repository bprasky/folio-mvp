"use client";

// RoomExpand — Full-width animated expansion for a room.
// Contains: editorial narrative, photo gallery (with product tag dots),
// tagged products, and collapse control.
// Rule 4: Expand Is the Only Way to Get Depth.

import { useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ImageTagDots } from "@/components/project/ImageTagDots";
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
        contentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
          <div
            className="px-4 md:px-8 py-8 rounded-[12px]"
            style={{ background: "rgba(87, 75, 67, 0.02)" }}
          >
            {/* 1. Editorial narrative */}
            {room.editorialNarrative && (
              <div className="max-w-[680px] mb-8">
                <p
                  className="whitespace-pre-line"
                  style={{
                    fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                    fontSize: "14.5px",
                    lineHeight: 1.7,
                    color: "rgba(87, 75, 67, 0.85)",
                  }}
                >
                  {room.editorialNarrative}
                </p>
              </div>
            )}

            {/* 2. Photo gallery */}
            {room.additionalImages.length > 0 && (
              <div className="mb-8">
                <div
                  className="flex gap-3 overflow-x-auto pb-2"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {room.additionalImages.map((img) => (
                    <div
                      key={img.id}
                      className="relative flex-shrink-0 rounded-[10px] overflow-hidden"
                      style={{ height: 130, width: "auto" }}
                    >
                      <div className="relative h-[130px] w-[200px]">
                        <Image
                          src={img.url}
                          alt={room.roomLabel}
                          fill
                          className="object-cover"
                          sizes="200px"
                        />
                        <ImageTagDots image={img} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Tagged products */}
            {room.products.length > 0 && (
              <div className="mb-6">
                <h4
                  className="mb-3 uppercase tracking-[1.5px]"
                  style={{
                    fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                    fontSize: "10px",
                    fontWeight: 500,
                    color: "rgba(87, 75, 67, 0.3)",
                  }}
                >
                  Tagged Products
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
                            fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "rgba(87, 75, 67, 0.85)",
                          }}
                        >
                          {product.name}
                        </div>
                        {(product.vendor?.name || product.vendor?.companyName) && (
                          <div
                            className="truncate"
                            style={{
                              fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                              fontSize: "11px",
                              color: "rgba(87, 75, 67, 0.45)",
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

            {/* 4. Collapse control */}
            <div className="flex justify-end">
              <button
                onClick={onCollapse}
                className="text-[11px] transition-colors hover:opacity-70"
                style={{
                  fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
                  color: "rgba(87, 75, 67, 0.3)",
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
