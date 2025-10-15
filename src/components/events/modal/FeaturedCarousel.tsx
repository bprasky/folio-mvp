"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function FeaturedCarousel({
  products,
}: {
  products: Array<{
    id: string;
    title: string | null;
    imageUrl: string | null;
    brand?: string | null;
    slug?: string | null;
  }>;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => ref.current?.scrollBy({ left: delta, behavior: "smooth" });

  if (!products?.length) return null;

  return (
    <div className="relative">
      <div className="hidden md:flex items-center justify-end mb-3 gap-2">
        <button
          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm hover:bg-white/15"
          onClick={() => scrollBy(-360)}
        >
          ◀
        </button>
        <button
          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm hover:bg-white/15"
          onClick={() => scrollBy(360)}
        >
          ▶
        </button>
      </div>

      <div ref={ref} className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        {products.map((p) => {
          const href = p.slug ? `/products/${p.slug}` : `/products/${p.id}`;
          return (
            <Link key={p.id} href={href} className="snap-start shrink-0 w-[220px] group">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl ring-1 ring-white/10 bg-white/5">
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.title ?? "Product"}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    sizes="220px"
                  />
                ) : (
                  <div className="h-full w-full bg-neutral-700" />
                )}
              </div>
              <div className="mt-2 text-sm leading-tight">
                <div className="line-clamp-2 opacity-95">{p.title ?? "Untitled product"}</div>
                {p.brand ? <div className="text-xs opacity-70 mt-0.5">{p.brand}</div> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}








