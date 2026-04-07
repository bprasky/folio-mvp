"use client";
import Link from "next/link";

export function RelatedProductsRail({ items }: { items: { id:string; slug:string; name:string; thumb:string }[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-3">
        <div className="text-[16px] font-semibold text-[#111827]">Related products</div>
        <div className="text-[12px] text-[#6B7280]">From the same collection or similar materials</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((p)=>(
          <Link key={p.id} href={`/products/${p.slug}`} className="rounded-xl overflow-hidden border border-[#E5E7EB] bg-white">
            <img src={p.thumb} alt="" className="h-40 w-full object-cover" />
            <div className="p-2 text-[13px] text-[#111827]">{p.name}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}





