"use client";
import Link from "next/link";

export function RelatedProductsRail({ items }: { items: { id:string; slug:string; name:string; thumb:string }[] }) {
  return (
    <section>
      <div className="mb-3">
        <div className="text-[16px] font-semibold text-folio-text-primary">Related products</div>
        <div className="text-[12px] text-folio-text-secondary">From the same collection or similar materials</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((p)=>(
          <Link key={p.id} href={`/products/${p.slug}`} className="rounded-xl overflow-hidden border border-folio-border-subtle bg-surface-canvas">
            <img src={p.thumb} alt="" className="h-40 w-full object-cover" />
            <div className="p-2 text-[13px] text-folio-text-primary">{p.name}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}





