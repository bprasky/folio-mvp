// BoostReelCell — single product cell in the homepage boost reel (Task 05)
//
// Two variants:
//   1. Product cell — image, name, vendor, optional gold "Boosted" badge.
//   2. "+N View all" affordance cell — last slot when totalTagged > 7.

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from '@/components/FolioImage';

import type { BoostReelItem } from "@/lib/homepage/getHomepageData";

interface ProductCellProps {
  item: BoostReelItem;
  /** Click handler emitted from BoostReel for analytics. */
  onClick?: (item: BoostReelItem) => void;
}

// Fallback chain. Layers are tried in order; on image load error we
// advance to the next. By the time we reach `text`, every URL on the
// item has either succeeded earlier or failed.
type FallbackLayer =
  | { kind: "catalog"; src: string }
  | { kind: "crop"; src: string }
  | { kind: "focal"; src: string; focalX: number; focalY: number }
  | { kind: "text" };

const FOCAL_ZOOM = 2.5; // CSS scale factor for the focal-crop layer.

export function BoostReelCell({ item, onClick }: ProductCellProps) {
  const href = item.productSlug
    ? `/products/${item.productSlug}`
    : `/products/${item.productId}`;

  const layers = useMemo<FallbackLayer[]>(() => {
    const out: FallbackLayer[] = [];
    if (item.imageUrl) out.push({ kind: "catalog", src: item.imageUrl });
    if (item.cropUrl) out.push({ kind: "crop", src: item.cropUrl });
    if (item.sourceImageUrl) {
      out.push({
        kind: "focal",
        src: item.sourceImageUrl,
        focalX: clampPct(item.focalX),
        focalY: clampPct(item.focalY),
      });
    }
    out.push({ kind: "text" });
    return out;
  }, [item.imageUrl, item.cropUrl, item.sourceImageUrl, item.focalX, item.focalY]);

  const [layerIdx, setLayerIdx] = useState(0);
  // Reset to the top of the chain when the cell is reused for a different
  // product (e.g., reel re-shuffles after a chip click).
  useEffect(() => {
    setLayerIdx(0);
  }, [item.productId]);

  const layer = layers[Math.min(layerIdx, layers.length - 1)];
  const advance = () => setLayerIdx((idx) => Math.min(idx + 1, layers.length - 1));

  return (
    <Link
      href={href}
      onClick={() => onClick?.(item)}
      className="relative block group"
      data-boost-id={item.boostId ?? undefined}
      data-product-id={item.productId}
      data-slot={item.slotPosition}
      data-boosted={item.isBoosted ? "true" : "false"}
    >
      <div className="relative aspect-square rounded-md sm:rounded-xl overflow-hidden bg-surface-ground">
        <BoostReelCellLayer layer={layer} item={item} onError={advance} />

        {item.isBoosted && (
          <span
            className="absolute top-2 right-2 px-2 py-0.5 rounded-full folio-eyebrow"
            style={{
              background: "var(--folio-gold)",
              color: "white",
            }}
          >
            Boosted
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p
          className="folio-ui line-clamp-2 sm:truncate text-folio-text-primary"
          title={item.name}
        >
          {item.name}
        </p>
        {item.vendorName && (
          <p
            className="folio-meta truncate text-folio-text-secondary"
            title={item.vendorName}
          >
            {item.vendorName}
          </p>
        )}
      </div>
    </Link>
  );
}

function clampPct(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 50;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function BoostReelCellLayer({
  layer,
  item,
  onError,
}: {
  layer: FallbackLayer;
  item: BoostReelItem;
  onError: () => void;
}) {
  if (layer.kind === "catalog" || layer.kind === "crop") {
    return (
      <Image
        src={layer.src}
        alt={item.name}
        fill
        sizes="(max-width: 639px) 104px, (min-width: 1440px) 160px, 12vw"
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        onError={onError}
      />
    );
  }

  if (layer.kind === "focal") {
    // Focal-cropped project image. The image fills the cell with object-fit
    // cover, then is scaled up FOCAL_ZOOM× anchored at the tag's focal point
    // so the tagged region stays visually centered. overflow-hidden on the
    // parent container clips the rest. next/image is fine here — anchoring
    // happens via transform-origin, which composes with object-fit.
    return (
      <Image
        src={layer.src}
        alt={item.name}
        fill
        sizes="(max-width: 639px) 104px, (min-width: 1440px) 160px, 12vw"
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        style={{
          transform: `scale(${FOCAL_ZOOM})`,
          transformOrigin: `${layer.focalX}% ${layer.focalY}%`,
        }}
        onError={onError}
      />
    );
  }

  // Last resort: every image in the chain failed or was missing.
  return <BoostReelCellTextFallback name={item.name} vendorName={item.vendorName} />;
}

function BoostReelCellTextFallback({
  name,
  vendorName,
}: {
  name: string;
  vendorName: string | null | undefined;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center bg-surface-ground">
      <p
        className="folio-ui line-clamp-3 text-folio-text-primary"
        title={name}
      >
        {name}
      </p>
      {vendorName && (
        <p className="folio-meta line-clamp-1 text-folio-text-secondary">
          {vendorName}
        </p>
      )}
    </div>
  );
}

interface ViewAllCellProps {
  count: number;
  postSlug: string;
}

export function BoostReelViewAllCell({ count, postSlug }: ViewAllCellProps) {
  return (
    <Link
      href={`/p/${postSlug}#tagged-products`}
      className="relative block group"
    >
      <div
        className="relative aspect-square rounded-md sm:rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          background: "var(--surface-ground)",
          border: "1px solid var(--folio-border-subtle)",
        }}
      >
        <div className="text-center px-2">
          <p
            className="text-folio-text-primary"
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "var(--type-h3)",
              lineHeight: "var(--lh-h3)",
              fontWeight: "var(--w-h3)",
            }}
          >
            +{count}
          </p>
          <p className="folio-eyebrow text-folio-text-secondary mt-1">
            View all
          </p>
        </div>
      </div>
      <div className="mt-2 h-[36px]" aria-hidden />
    </Link>
  );
}
