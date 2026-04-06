"use client";

import Image from "next/image";
import Link from "next/link";
import { type MagazineProduct } from "@/lib/magazine/getMagazineData";
import { getProductDisplayImage } from "@/lib/products/getProductDisplayImage";
import { decodeHtmlEntities } from "@/lib/utils";

interface Props {
  products: MagazineProduct[];
}

/**
 * EditorialProductCutoutsRail
 *
 * Featured Products strip for editorial hero.
 * Image-dominant cards: full-bleed photography inside 20px rounded containers
 * with text overlay at the bottom over a dark gradient.
 * Matches the festival page card pattern.
 */
export default function EditorialProductCutoutsRail({ products }: Props) {
  const displayProducts = products.slice(0, 4);

  if (!displayProducts.length) return null;

  return (
    <section className="space-y-6">
      <h3
        className="text-[13px] font-normal uppercase tracking-[0.12em]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        Featured Products
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {displayProducts.map((product) => {
          const productHref = `/products/${product.id}`;
          const imageUrl = getProductDisplayImage(product, {
            use2DCutout: false,
            placeholder: '',
          });

          return (
            <Link
              key={product.id}
              href={productHref}
              className="group relative rounded-[20px] overflow-hidden block"
              style={{ aspectRatio: '3 / 4' }}
            >
              {/* Full-bleed image or warm gray placeholder */}
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={decodeHtmlEntities(product.name)}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div
                  className="absolute inset-0 rounded-[20px] border border-folio-border-subtle"
                  style={{ backgroundColor: 'rgb(200, 195, 190)' }}
                />
              )}

              {/* Bottom gradient for text legibility */}
              <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

              {/* Text overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 z-20 p-3">
                <p className="text-white text-sm font-semibold leading-snug line-clamp-2">
                  {decodeHtmlEntities(product.name)}
                </p>
                {product.vendorName && (
                  <p className="text-white/80 text-[11px] mt-0.5 capitalize">
                    {product.vendorName}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
