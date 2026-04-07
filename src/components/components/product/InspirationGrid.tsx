"use client";
import React from "react";
import { TaggedImage } from "@/lib/mock/product";

export function InspirationGrid({ items }: { items: TaggedImage[] }) {
  return (
    <section>
      <div className="mb-3">
        <div className="text-[16px] font-semibold text-folio-text-primary">Inspiration using this product</div>
        <div className="text-[12px] text-folio-text-secondary">Most-liked affiliate-tagged images from Folio</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((it)=>(
          <div key={it.id} className="rounded-xl overflow-hidden border border-folio-border-subtle bg-surface-canvas">
            <img src={it.src} alt="" className="h-48 w-full object-cover" />
            <div className="flex items-center justify-between px-2 py-1 text-[12px]">
              <span className="text-folio-text-secondary">{it.room}</span>
              <span className="text-folio-text-primary">♥ {it.likes}</span>
            </div>
            <div className="px-2 pb-2 text-[12px] text-folio-text-secondary">by {it.by}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
