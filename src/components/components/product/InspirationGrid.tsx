"use client";
import React from "react";
import { TaggedImage } from "@/lib/mock/product";

export function InspirationGrid({ items }: { items: TaggedImage[] }) {
  return (
    <section>
      <div className="mb-3">
        <div className="text-[var(--type-body)] font-semibold text-[#111827]">Inspiration using this product</div>
        <div className="text-[var(--type-meta)] text-[#6B7280]">Most-liked affiliate-tagged images from Folio</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((it)=>(
          <div key={it.id} className="rounded-xl overflow-hidden border border-[#E5E7EB] bg-white">
            <img src={it.src} alt="" className="h-48 w-full object-cover" />
            <div className="flex items-center justify-between px-2 py-1 text-[var(--type-meta)]">
              <span className="text-[#6B7280]">{it.room}</span>
              <span className="text-[#111827]">♥ {it.likes}</span>
            </div>
            <div className="px-2 pb-2 text-[var(--type-meta)] text-[#6B7280]">by {it.by}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
