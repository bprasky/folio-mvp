"use client";

import Link from "next/link";
import clsx from "clsx";

type SceneShopStripProps = {
  products: any[];
  dense?: boolean;
};

export function SceneShopStrip({ products, dense }: SceneShopStripProps) {
  if (!products || products.length === 0) return null;

  const items = products.slice(0, dense ? 4 : 6);

  return (
    <div
      className={clsx(
        "mt-3 flex gap-3 overflow-x-auto no-scrollbar",
        dense && "mt-2"
      )}
    >
      {items.map((p: any) => {
        const id = p.id ?? p.productId ?? p.slug ?? String(p.name ?? "prod");

        const href =
          p.slug ? `/products/${p.slug}` : p.url ?? p.productUrl ?? "#";

        return (
          <Link
            key={id}
            href={href}
            className="group min-w-[140px] max-w-[160px] rounded-2xl bg-white/80 backdrop-blur-xl ring-1 ring-black/5 shadow-[0_8px_24px_rgba(15,14,10,0.08)] overflow-hidden flex flex-col"
          >
            {p.imageUrl && (
              <div className="h-[90px] w-full overflow-hidden bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt={p.name ?? ""}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                />
              </div>
            )}
            <div className="px-3 py-2 space-y-1">
              <div className="text-[11px] font-medium text-neutral-900 line-clamp-2">
                {p.name ?? "Product"}
              </div>
              {p.vendorName && (
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                  {p.vendorName}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

