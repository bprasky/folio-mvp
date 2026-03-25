"use client";

import { useState } from "react";
import clsx from "clsx";
import { useSaveToProjectFolder } from "@/components/projects/useSaveToProjectFolder";
import SaveToFolderModal from "@/components/projects/SaveToFolderModal";

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
};

function normalizeTags(image: any, tagsProp?: any[] | null): NormalizedTag[] {
  const raw = Array.isArray(tagsProp)
    ? tagsProp
    : Array.isArray(image?.tags)
    ? image.tags
    : [];

  return raw
    .map((tag: any, idx: number) => {
      // Try to infer coords:
      // - If xPercent/yPercent exist (0–100), use them.
      // - Else if x/y exist as 0–1, convert to percent.
      // - Else if x/y exist as 0–100, use directly.
      // - Else skip.
      let xPercent: number | null = null;
      let yPercent: number | null = null;

      if (typeof tag.xPercent === "number" && typeof tag.yPercent === "number") {
        xPercent = tag.xPercent;
        yPercent = tag.yPercent;
      } else if (typeof tag.x === "number" && typeof tag.y === "number") {
        // Check if values are in 0-1 range or 0-100 range
        if (tag.x <= 1 && tag.y <= 1) {
          // Assume 0–1 range, convert to percent
          xPercent = tag.x * 100;
          yPercent = tag.y * 100;
        } else {
          // Assume already in 0–100 range
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

      // Build product URL
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
      } as NormalizedTag;
    })
    .filter(Boolean) as NormalizedTag[];
}

export function ImageTagDots({ image, tags: tagsProp }: ImageTagDotsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { openSaveDialog, modalProps } = useSaveToProjectFolder();

  const tags = normalizeTags(image, tagsProp);
  if (!tags.length) return null;

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

  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        {tags.map((tag) => (
          <div
            key={tag.id}
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
            {/* Dot button (for click/tap) */}
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center glass-badge p-0 shadow-[0_0_0_1px_rgba(15,14,10,0.2)] transition-all hover:scale-110"
              onClick={(e) => {
                e.stopPropagation();
                setActiveId((prev) => (prev === tag.id ? null : tag.id));
              }}
            >
              <span className="h-2 w-2 rounded-full bg-[var(--text-primary)]" />
            </button>

            {/* Tooltip card - positioned closer to eliminate gap */}
            {activeId === tag.id && (
              <div
                className="absolute left-1/2 top-full mt-1 -translate-x-1/2 w-max max-w-[220px] ridge-card px-3 py-2 folio-meta text-[var(--text-primary)] shadow-[0_14px_40px_rgba(15,14,10,0.35)] z-20 pointer-events-auto"
                onMouseEnter={() => setActiveId(tag.id)}
                onMouseLeave={() => setActiveId((prev) => (prev === tag.id ? null : prev))}
              >
                <div className="flex items-center gap-2">
                  {tag.thumbnailUrl && (
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)]">
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
                      <div className="truncate text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                        {tag.vendorName}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add to project button */}
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
        ))}
      </div>

      {/* Save to Project Modal - using unified hook */}
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

