"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from '@/components/FolioImage';
import { InContextModal } from "./InContextModal";

interface ContextPhoto {
  boostId: string;
  imageUrl: string;
  imageId: string;
  room: string | null;
  projectId: string;
  projectTitle: string;
  designerName: string;
  designerImage: string | null;
  articleSlug: string | null;
  articleExcerpt: string | null;
  followUpQuestion: string | null;
  followUpAnswer: string | null;
}

interface InContextStripProps {
  productId: string;
}

/**
 * Horizontal scroll strip of project photos where this product is tagged
 * AND the vendor has boosted. Clicking opens a modal showing the article
 * context + designer follow-up Q&A.
 *
 * Gate: Only boosted tags appear. No boost = no In Context appearance.
 */
export function InContextStrip({ productId }: InContextStripProps) {
  const [photos, setPhotos] = useState<ContextPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<ContextPhoto | null>(null);

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

  return (
    <>
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
          className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {photos.map((photo, i) => (
            <button
              key={photo.boostId || i}
              onClick={() => setSelectedPhoto(photo)}
              className="flex-shrink-0 relative group cursor-pointer text-left border-0 bg-transparent p-0"
            >
              <div
                className="relative overflow-hidden rounded-xl"
                style={{ width: 220, height: 160 }}
              >
                <Image
                  src={photo.imageUrl}
                  alt={photo.projectTitle || "Project photo"}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="220px"
                />
                {/* Bottom gradient overlay with project info */}
                <div
                  className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-8"
                  style={{
                    background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
                  }}
                >
                  <div
                    className="font-body font-medium truncate"
                    style={{ fontSize: 'var(--type-meta)', color: "white", lineHeight: 'var(--lh-h4)' }}
                  >
                    {photo.projectTitle}
                  </div>
                  <div
                    className="font-body truncate"
                    style={{ fontSize: 'var(--type-fine)', color: "rgba(255,255,255,0.7)" }}
                  >
                    {photo.designerName}
                  </div>
                </div>
                {/* Room tag */}
                {photo.room && (
                  <div
                    className="absolute top-2.5 left-2.5 font-body"
                    style={{
                      fontSize: "9px", /* folio-design-system: off-scale */
                      fontWeight: 'var(--w-h1)',
                      letterSpacing: 'var(--ls-wide)',
                      textTransform: "uppercase",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      background: "rgba(255,255,255,0.9)",
                      color: "#5a4a3a",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    {photo.room}
                  </div>
                )}
                {/* Q&A indicator */}
                {photo.followUpAnswer && (
                  <div
                    className="absolute top-2.5 right-2.5 font-body"
                    style={{
                      fontSize: "9px", /* folio-design-system: off-scale */
                      fontWeight: 'var(--w-h1)',
                      padding: "2px 7px",
                      borderRadius: "4px",
                      background: "rgba(201, 169, 110, 0.9)",
                      color: "white",
                    }}
                  >
                    Q&A
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* In Context Modal */}
      <InContextModal
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
    </>
  );
}
