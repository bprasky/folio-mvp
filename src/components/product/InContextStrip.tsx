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
}

interface InContextStripProps {
  productId: string;
}

/**
 * Horizontal scroll strip of project photos where this product is tagged.
 * Conditionally renders: only shows if there are tagged photos in published projects.
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
        className="flex gap-2.5 overflow-x-auto pb-2"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {visiblePhotos.map((photo, i) => (
          <Link
            key={i}
            href={`/project/${photo.projectId}`}
            className="flex-shrink-0 relative group"
          >
            <div className="relative overflow-hidden rounded-lg" style={{ width: 80, height: 80 }}>
              <Image
                src={photo.imageUrl}
                alt={photo.projectTitle || "Project photo"}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
            {/* Hover tooltip */}
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-body"
              style={{
                fontSize: "10px",
                background: "rgba(28, 25, 23, 0.85)",
                color: "white",
                zIndex: 20,
              }}
            >
              <div className="font-medium">{photo.projectTitle}</div>
              <div style={{ color: "rgba(255,255,255,0.7)" }}>{photo.designerName}</div>
            </div>
          </Link>
        ))}

        {remaining > 0 && (
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-lg font-body"
            style={{
              width: 80,
              height: 80,
              background: "rgba(201, 169, 110, 0.12)",
              color: "#8a7044",
              fontSize: "12px",
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
