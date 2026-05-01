// BoostReelCell — single product cell in the homepage boost reel (Task 05)
//
// Two variants:
//   1. Product cell — image, name, vendor, optional gold "Boosted" badge.
//   2. "+N View all" affordance cell — last slot when totalTagged > 7.
//
// Render fallback: starts with item.imageUrl (catalog). On image-load error
// — typically a 404 from an expired Supabase storage URL or a hotlink-blocked
// vendor CDN — swaps once to item.fallbackImageUrl (a server-generated crop
// of the project image at the tag location). If that also errors, we hide
// the image and the product name still appears underneath.

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

  const initialSrc = item.imageUrl || item.fallbackImageUrl || "";
  const [src, setSrc] = useState(initialSrc);
  const [hidden, setHidden] = useState(false);

  const handleError = () => {
    if (item.fallbackImageUrl && src !== item.fallbackImageUrl) {
      setSrc(item.fallbackImageUrl);
    } else {
      setHidden(true);
    }
  };

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
        {src && !hidden && (
          <Image
            key={src}
            src={src}
            alt={item.name}
            fill
            sizes="(min-width: 1440px) 160px, 12vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={handleError}
          />
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
