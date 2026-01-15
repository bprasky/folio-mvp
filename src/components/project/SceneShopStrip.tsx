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
            className="group min-w-[140px] max-w-[160px] ridge-card overflow-hidden flex flex-col"
          >
            {p.imageUrl && (
              <div className="h-[90px] w-full overflow-hidden bg-[var(--bg-elevated)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt={p.name ?? ""}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                />
              </div>
            )}
            <div className="px-3 py-2 space-y-1">
              <div className="folio-ui text-[var(--text-primary)] line-clamp-2">
                {p.name ?? "Product"}
              </div>
              {p.vendorName && (
                <div className="folio-meta uppercase tracking-[0.16em]">
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
