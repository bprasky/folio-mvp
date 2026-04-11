"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

interface ContextPhoto {
  imageUrl: string;
  room: string | null;
  projectId: string;
  projectTitle: string;
  designerName: string;
  articleSlug: string | null; // Published post slug for /p/[slug] route
}

interface InContextStripProps {
  productId: string;
}

/**
 * Horizontal scroll strip of project photos where this product is tagged.
 * Links to the published article (/p/[slug]) when available, never to the
 * private project management view.
 */
export function InContextStrip({ productId }: InContextStripProps) {
  const [photos, setPhotos] = useState<ContextPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const res = await fetch(`/api/products/${productId}/context-photos`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setPhotos(data.photos || []);
      } catch {
        console.error("Failed to fetch context photos");
      } finally {
        setLoading(false);
      }
    }
    fetchPhotos();
  }, [productId]);

  if (loading || photos.length === 0) return null;

  const visiblePhotos = photos.slice(0, 8);
  const remaining = photos.length - 8;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: [0.25, 0.8, 0.25, 1] }}
    >
      <h2
        className="font-headline font-light mb-4"
        style={{ fontSize: "clamp(20px, 2.5vw, 28px)", color: "var(--folio-text-primary, #1a1a1a)" }}
      >
        In Context
      </h2>

      <div
        className="flex gap-3 overflow-x-auto pb-3"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {visiblePhotos.map((photo, i) => {
          // Link to published article when available, skip if no published post
          const href = photo.articleSlug
            ? `/p/${photo.articleSlug}`
            : null;

          const card = (
            <div className="flex-shrink-0 relative group" key={i}>
              <div
                className="relative overflow-hidden rounded-xl"
                style={{ width: 160, height: 120 }}
              >
                <Image
                  src={photo.imageUrl}
                  alt={photo.projectTitle || "Project photo"}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="160px"
                />
                {/* Bottom gradient overlay with project info */}
                <div
                  className="absolute inset-x-0 bottom-0 px-2.5 pb-2 pt-6"
                  style={{
                    background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)",
                  }}
                >
                  <div
                    className="font-body font-medium truncate"
                    style={{ fontSize: "11px", color: "white", lineHeight: 1.3 }}
                  >
                    {photo.projectTitle}
                  </div>
                  <div
                    className="font-body truncate"
                    style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)" }}
                  >
                    {photo.designerName}
                  </div>
                </div>
                {/* Room tag */}
                {photo.room && (
                  <div
                    className="absolute top-2 left-2 font-body"
                    style={{
                      fontSize: "9px",
                      fontWeight: 500,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(255,255,255,0.85)",
                      color: "#5a4a3a",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    {photo.room}
                  </div>
                )}
              </div>
            </div>
          );

          if (href) {
            return (
              <Link key={i} href={href} className="flex-shrink-0 relative group">
                {card}
              </Link>
            );
          }

          // No published article — render as non-clickable
          return card;
        })}

        {remaining > 0 && (
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-xl font-body"
            style={{
              width: 160,
              height: 120,
              background: "rgba(201, 169, 110, 0.12)",
              color: "#8a7044",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            +{remaining} more
          </div>
        )}
      </div>
    </motion.section>
  );
}
