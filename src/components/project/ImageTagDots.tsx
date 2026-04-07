"use client";

import { useState, useCallback, useEffect } from "react";
import { useSaveToProjectFolder } from "@/components/projects/useSaveToProjectFolder";
import SaveToFolderModal from "@/components/projects/SaveToFolderModal";
import { TagLiftOff, getInteractionTier } from "./tag-liftoff/TagLiftOff";
import type { LiftOffTag } from "./tag-liftoff/TagLiftOff";

type ImageTagDotsProps = {
  image: any;          // ProjectImage object (must include id + tags if available)
  tags?: any[] | null; // optional explicit tags; fall back to image.tags
};

type NormalizedTag = {
  id: string;
  xPercent: number;  // 0–100
  yPercent: number;  // 0–100
  label: string;
  href?: string;
  productId?: string;
  vendorName?: string | null;
  thumbnailUrl?: string | null;
  // 3D mesh fields
  mesh3dUrl?: string | null;
  meshMaskUrl?: string | null;
  meshStatus?: string | null;
  meshBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  cutoutImageUrl?: string | null;
  category?: string | null;
};

function normalizeTags(image: any, tagsProp?: any[] | null): NormalizedTag[] {
  const raw = Array.isArray(tagsProp)
    ? tagsProp
    : Array.isArray(image?.tags)
    ? image.tags
    : [];

  return raw
    .map((tag: any, idx: number) => {
      let xPercent: number | null = null;
      let yPercent: number | null = null;

      if (typeof tag.xPercent === "number" && typeof tag.yPercent === "number") {
        xPercent = tag.xPercent;
        yPercent = tag.yPercent;
      } else if (typeof tag.x === "number" && typeof tag.y === "number") {
        if (tag.x <= 1 && tag.y <= 1) {
          xPercent = tag.x * 100;
          yPercent = tag.y * 100;
        } else {
          xPercent = tag.x;
          yPercent = tag.y;
        }
      }

      if (xPercent == null || yPercent == null) return null;

      const product = tag.product || tag.productRef || tag.productData || {};
      const label =
        product.name ||
        product.title ||
        tag.label ||
        tag.productName ||
        tag.note ||
        "Tagged product";

      const href =
        product.slug
          ? `/products/${product.slug}`
          : product.id
          ? `/products/${product.id}`
          : product.url || product.productUrl || undefined;

      const thumbnailUrl =
        product.thumbnailUrl ||
        product.imageThumb ||
        product.imageUrl ||
        product.primaryImageUrl ||
        null;

      const vendorName =
        product.vendorName ||
        product.vendor?.name ||
        product.vendor?.companyName ||
        product.brand ||
        null;

      return {
        id: String(tag.id ?? `${image?.id ?? "img"}-tag-${idx}`),
        xPercent,
        yPercent,
        label,
        href,
        productId: product.id ? String(product.id) : undefined,
        vendorName,
        thumbnailUrl,
        // 3D mesh fields from tag record
        mesh3dUrl: tag.mesh3dUrl || null,
        meshMaskUrl: tag.meshMaskUrl || null,
        meshStatus: tag.meshStatus || null,
        meshBoundingBox: tag.meshBoundingBox || null,
        cutoutImageUrl: product.cutoutImageUrl || null,
        category: product.category || null,
      } as NormalizedTag;
    })
    .filter(Boolean) as NormalizedTag[];
}

export function ImageTagDots({ image, tags: tagsProp }: ImageTagDotsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const { openSaveDialog, modalProps } = useSaveToProjectFolder();

  const tags = normalizeTags(image, tagsProp);
  if (!tags.length) return null;

  const imageUrl = image?.url || '';

  const handleAddToProject = (tag: NormalizedTag) => {
    if (!tag.productId) {
      console.warn("[ImageTagDots] No productId on tag", tag);
      return;
    }
    openSaveDialog({
      productId: tag.productId,
      source: "project-published-tag",
    });
  };

  const handleDotClick = (tag: NormalizedTag, e: React.MouseEvent) => {
    e.stopPropagation();
    const tier = getInteractionTier(tag as LiftOffTag);

    if (tier === 'tooltip-only') {
      // Existing behavior: toggle tooltip
      setActiveId((prev) => (prev === tag.id ? null : tag.id));
      setLiftedId(null);
    } else {
      // Enhanced behavior: toggle lift-off
      setLiftedId((prev) => (prev === tag.id ? null : tag.id));
      setActiveId(null);
    }
  };

  const handleDismissLift = () => {
    setLiftedId(null);
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        {tags.map((tag) => {
          const tier = getInteractionTier(tag as LiftOffTag);
          const isTooltipOnly = tier === 'tooltip-only';
          const isHovered = activeId === tag.id;
          const isLifted = liftedId === tag.id;

          return (
            <div key={tag.id}>
              {/* Tag dot — positioned at tag coordinates */}
              <div
                className="pointer-events-auto absolute z-10"
                style={{
                  left: `${tag.xPercent}%`,
                  top: `${tag.yPercent}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onMouseEnter={() => setActiveId(tag.id)}
                onMouseLeave={() =>
                  setActiveId((prev) => (prev === tag.id ? null : prev))
                }
              >
                {/* Dot button */}
                <button
                  type="button"
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-[0_0_0_1px_rgba(15,14,10,0.2)] transition-all hover:scale-110"
                  onClick={(e) => handleDotClick(tag, e)}
                >
                  <span className="h-2 w-2 rounded-full bg-[var(--text-primary)]" />
                </button>

                {/* Tooltip card — only for tooltip-only tier (existing behavior) */}
                {isTooltipOnly && activeId === tag.id && (
                  <div
                    className="absolute left-1/2 top-full mt-1 -translate-x-1/2 w-max max-w-[220px] ridge-card px-3 py-2 folio-meta text-folio-text-primary shadow-[0_14px_40px_rgba(15,14,10,0.35)] z-20 pointer-events-auto"
                    onMouseEnter={() => setActiveId(tag.id)}
                    onMouseLeave={() => setActiveId((prev) => (prev === tag.id ? null : prev))}
                  >
                    <div className="flex items-center gap-2">
                      {tag.thumbnailUrl && (
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl bg-surface-ground">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={tag.thumbnailUrl}
                            alt={tag.label}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="truncate font-medium">
                          {tag.href ? (
                            <a
                              href={tag.href}
                              className="hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {tag.label}
                            </a>
                          ) : (
                            tag.label
                          )}
                        </div>
                        {tag.vendorName && (
                          <div className="truncate text-[10px] uppercase tracking-[0.16em] text-folio-text-secondary">
                            {tag.vendorName}
                          </div>
                        )}
                      </div>
                    </div>

                    {tag.productId && (
                      <button
                        type="button"
                        className="mt-2 w-full inline-flex items-center justify-center gap-1 rounded-full bg-[var(--text-primary)] px-2.5 py-1 text-[10px] font-medium text-white hover:opacity-90 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToProject(tag);
                        }}
                      >
                        <span className="folio-meta">+</span>
                        <span>Add to project</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* TagLiftOff — for tags with mask/mesh data */}
              {!isTooltipOnly && (
                <TagLiftOff
                  tag={tag as LiftOffTag}
                  imageUrl={imageUrl}
                  isHovered={isHovered}
                  isLifted={isLifted}
                  onLift={() => setLiftedId(tag.id)}
                  onDismiss={handleDismissLift}
                  onAddToProject={() => handleAddToProject(tag)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Click-outside dismiss for lifted tags */}
      {liftedId && (
        <div
          className="fixed inset-0 z-[3]"
          onClick={handleDismissLift}
        />
      )}

      {/* Save to Project Modal */}
      {modalProps.productId && (
        <SaveToFolderModal
          isOpen={modalProps.isOpen}
          onClose={modalProps.onClose}
          productId={modalProps.productId}
          eventId={modalProps.eventId}
          eventTitle={modalProps.eventTitle}
          onSuccess={modalProps.onSuccess}
        />
      )}
    </>
  );
}
