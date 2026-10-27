"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from '@/components/FolioImage';
import Link from "next/link";
import { X } from "lucide-react";

interface InContextPhoto {
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

interface InContextModalProps {
  photo: InContextPhoto | null;
  onClose: () => void;
}

/**
 * Modal showing the article context where a product is featured.
 * Displays the project image, article excerpt, designer info,
 * and follow-up Q&A from the vendor boost system.
 */
export function InContextModal({ photo, onClose }: InContextModalProps) {
  if (!photo) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden"
          style={{ background: "var(--surface-canvas, #ffffff)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 rounded-full p-1.5 cursor-pointer"
            style={{
              background: "rgba(0,0,0,0.3)",
              backdropFilter: "blur(4px)",
            }}
            aria-label="Close"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          {/* Hero image */}
          <div className="relative w-full" style={{ aspectRatio: "16/10" }}>
            <Image
              src={photo.imageUrl}
              alt={photo.projectTitle}
              fill
              className="object-cover"
              sizes="(min-width: 640px) 512px, 100vw"
            />
            {/* Room badge */}
            {photo.room && (
              <div
                className="absolute top-3 left-3 font-body"
                style={{
                  fontSize: "9px", /* folio-design-system: off-scale */
                  fontWeight: 'var(--w-h1)',
                  letterSpacing: 'var(--ls-wide)',
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  background: "rgba(255,255,255,0.9)",
                  color: "#5a4a3a",
                }}
              >
                {photo.room}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-5 py-4">
            {/* Project title + designer */}
            <div className="flex items-center gap-3 mb-3">
              {photo.designerImage ? (
                <Image
                  src={photo.designerImage}
                  alt={photo.designerName}
                  width={32}
                  height={32}
                  className="rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-body"
                  style={{
                    background: "rgba(201, 169, 110, 0.15)",
                    color: "#8a7044",
                    fontSize: 'var(--type-meta)',
                    fontWeight: 'var(--w-h1)',
                  }}
                >
                  {photo.designerName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div
                  className="font-body font-medium"
                  style={{ fontSize: 'var(--type-ui)', color: "var(--folio-text-primary, #1a1a1a)" }}
                >
                  {photo.projectTitle}
                </div>
                <div
                  className="font-body"
                  style={{ fontSize: 'var(--type-meta)', color: "var(--folio-text-tertiary, #9b9b9b)" }}
                >
                  by {photo.designerName}
                </div>
              </div>
            </div>

            {/* Article excerpt */}
            {photo.articleExcerpt && (
              <p
                className="font-body mb-4"
                style={{
                  fontSize: 'var(--type-meta)',
                  lineHeight: 'var(--lh-body)',
                  color: "var(--folio-text-secondary, #6b6b6b)",
                }}
              >
                {photo.articleExcerpt}
              </p>
            )}

            {/* Follow-up Q&A */}
            {photo.followUpAnswer && (
              <div
                className="rounded-lg px-4 py-3 mb-4"
                style={{
                  background: "rgba(245, 239, 232, 0.6)",
                  borderLeft: "2px solid var(--folio-gold-ornament)",
                }}
              >
                {photo.followUpQuestion && (
                  <div
                    className="font-body font-medium mb-1.5"
                    style={{ fontSize: 'var(--type-eyebrow)', color: "var(--folio-text-tertiary, #9b9b9b)", textTransform: "uppercase", letterSpacing: 'var(--ls-wide)' }}
                  >
                    {photo.followUpQuestion}
                  </div>
                )}
                <p
                  className="font-headline italic"
                  style={{
                    fontSize: 'var(--type-ui)',
                    lineHeight: 'var(--lh-body)',
                    color: "var(--folio-text-primary, #1a1a1a)",
                  }}
                >
                  &ldquo;{photo.followUpAnswer}&rdquo;
                </p>
                <div
                  className="font-body mt-2"
                  style={{ fontSize: 'var(--type-eyebrow)', color: "var(--folio-text-tertiary, #9b9b9b)" }}
                >
                  — {photo.designerName}
                </div>
              </div>
            )}

            {/* Read full article link */}
            {photo.articleSlug && (
              <Link
                href={`/p/${photo.articleSlug}`}
                className="block text-center font-body rounded-lg py-2.5 transition-colors"
                style={{
                  fontSize: 'var(--type-meta)',
                  fontWeight: 'var(--w-h1)',
                  background: "#3a2a1a",
                  color: "#f5efe8",
                  borderRadius: "8px",
                }}
              >
                Read full article →
              </Link>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
