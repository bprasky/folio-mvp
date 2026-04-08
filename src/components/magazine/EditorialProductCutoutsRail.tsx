"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { type MagazineProduct } from "@/lib/magazine/getMagazineData";
import { getProductDisplayImage } from "@/lib/products/getProductDisplayImage";
import { decodeHtmlEntities } from "@/lib/utils";

const Product3DViewer = dynamic(
  () => import("@/components/product/Product3DViewer"),
  { ssr: false }
);

interface Props {
  products: MagazineProduct[];
}

/**
 * EditorialProductCutoutsRail
 *
 * Featured Products strip for editorial hero.
 * Products with 3D meshes render as auto-rotating 3D viewers.
 * Products without meshes use full-bleed photography cards.
 */
export default function EditorialProductCutoutsRail({ products }: Props) {
  const displayProducts = products.slice(0, 4);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
          const has3D = !!product.threeDAssetUrl;
          const isHovered = hoveredId === product.id;

          return (
            <Link
              key={product.id}
              href={productHref}
              className="group relative rounded-[20px] overflow-hidden block"
              style={{ aspectRatio: '3 / 4' }}
              onMouseEnter={() => setHoveredId(product.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* 3D viewer for products with meshes */}
              {has3D ? (
                <div className="absolute inset-0">
                  <Product3DViewer
                    glbUrl={product.threeDAssetUrl!}
                    fallbackImageUrl={imageUrl || undefined}
                    productName={product.name}
                  />
                </div>
              ) : imageUrl ? (
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

              {/* Bottom gradient for text legibility — skip for 3D (transparent bg) */}
              {!has3D && (
                <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              )}

              {/* Text overlay at bottom */}
              <div className={`absolute bottom-0 left-0 right-0 z-20 p-3 ${has3D ? 'text-folio-text-primary' : ''}`}>
                <p className={`text-sm font-semibold leading-snug line-clamp-2 ${has3D ? 'text-folio-text-primary' : 'text-white'}`}>
                  {decodeHtmlEntities(product.name)}
                </p>
                {product.vendorName && (
                  <p className={`text-[11px] mt-0.5 capitalize ${has3D ? 'text-folio-text-secondary' : 'text-white/80'}`}>
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
