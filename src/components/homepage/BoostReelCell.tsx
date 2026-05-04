// BoostReelCell — single product cell in the homepage boost reel (Task 05)
//
// Two variants:
//   1. Product cell — image, name, vendor, optional gold "Boosted" badge.
//   2. "+N View all" affordance cell — last slot when totalTagged > 7.

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

import type { BoostReelItem } from "@/lib/homepage/getHomepageData";

interface ProductCellProps {
  item: BoostReelItem;
  /** Click handler emitted from BoostReel for analytics. */
  onClick?: (item: BoostReelItem) => void;
}

export function BoostReelCell({ item, onClick }: ProductCellProps) {
  const href = item.productSlug
    ? `/products/${item.productSlug}`
    : `/products/${item.productId}`;

  const [imageBroken, setImageBroken] = useState(false);
  const showImage = !!item.imageUrl && !imageBroken;

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
      <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-ground">
        {showImage ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(min-width: 1440px) 160px, 12vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setImageBroken(true)}
          />
        ) : (
          <BoostReelCellFallback name={item.name} vendorName={item.vendorName} />
        )}

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
          className="folio-ui truncate text-folio-text-primary"
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

// Fallback that shows when Product.imageUrl is missing or fails to load
// (broken host, 404, blocked by next.config remotePatterns). The cell still
// reads as a product entry — name + vendor — so the reel never collapses
// into empty grey squares while Phase 4 backfill is pending.
function BoostReelCellFallback({
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
        className="relative aspect-square rounded-xl overflow-hidden flex items-center justify-center"
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
