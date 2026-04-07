"use client";
import React, { useState } from "react";
import { ProductAsset } from "@/lib/mock/product";

export function Gallery({ assets }: { assets: ProductAsset[] }) {
  const [active, setActive] = useState(0);
  const a = assets[active];

  return (
    <div className="rounded-2xl border border-folio-border-subtle bg-surface-canvas p-3">
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-ground">
        {a.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.src} alt={a.alt || ""} className="h-full w-full object-cover" />
        ) : (
          <video src={a.src} controls className="h-full w-full object-cover" />
        )}
      </div>
      <div className="mt-3 grid grid-cols-6 gap-2">
        {assets.map((t, i) => (
          <button key={i} onClick={()=>setActive(i)}
            className={`aspect-[4/3] overflow-hidden rounded-lg border ${i===active ? "border-[#111827]" : "border-folio-border-subtle"} bg-surface-ground`}>
            {t.type === "image" ? <img src={t.src} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs text-folio-text-secondary">video</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
