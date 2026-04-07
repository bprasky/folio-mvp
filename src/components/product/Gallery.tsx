"use client";
import { useState } from "react";
import { ProductAsset } from "@/lib/mock/product";
import { GlassPanel } from "@/components/ui/GlassPanel";

export function Gallery({ assets }: { assets: ProductAsset[] }) {
  const [active, setActive] = useState(0);
  const a = assets[active];

  return (
    <GlassPanel className="p-4">
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-elevated dark:bg-surface-elevated">
        {a.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.src} alt={a.alt || ""} className="h-full w-full object-cover" />
        ) : (
          <video src={a.src} controls className="h-full w-full object-cover" />
        )}
      </div>
      <div className="mt-3 grid grid-cols-6 gap-2">
        {assets.map((t, i) => (
          <button 
            key={i} 
            onClick={()=>setActive(i)}
            className={`aspect-[4/3] overflow-hidden rounded-lg border transition-all ${
              i===active 
                ? "border-folio-text-primary dark:border-folio-border-subtle ring-2 ring-stone-900/20 dark:ring-stone-100/20" 
                : "border-folio-border-subtle dark:border-folio-border-subtle hover:border-folio-border-strong dark:hover:border-folio-border-subtle0"
            } bg-surface-elevated dark:bg-surface-elevated`}
            aria-label={`View ${t.type} ${i + 1}`}
          >
            {t.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.src} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-folio-text-secondary dark:text-folio-text-tertiary">
                video
              </div>
            )}
          </button>
        ))}
      </div>
    </GlassPanel>
  );
}


