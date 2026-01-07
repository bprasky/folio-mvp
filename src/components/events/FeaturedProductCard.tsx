"use client";
import { useState } from "react";
import { QuickAddToRoom } from "@/components/designer/QuickAddToRoom";
import { isDesigner } from "@/lib/mock/designer";
import { Button } from "@/components/ui/button";

type Props = {
  product: { id:string; name:string; thumb:string };
  user?: { id:string; role?: string };
  eventId?: string;
  subeventId?: string;
};

export function FeaturedProductCard({ product, user, eventId, subeventId }: Props) {
  const [open, setOpen] = useState(false);
  const isDesigner = (user?.role ?? '').toString().toLowerCase() === 'designer';
  console.debug('FeaturedProductCard user role:', user?.role, 'isDesigner:', isDesigner);
  const debugShowPlus = process.env.NEXT_PUBLIC_DEBUG_FEATURED_ADD === '1';
  const showAdd = debugShowPlus || isDesigner;

  return (
    <div className="group relative overflow-hidden rounded-2xl shadow-2xl bg-neutral-900/60 backdrop-blur-xl ring-1 ring-white/10">
      {/* image */}
      <img src={product.thumb} alt={product.name} className="h-40 w-full object-cover" />
      <div className="px-3 py-2 bg-neutral-900/60 text-white/90 backdrop-blur ring-1 ring-white/10">{product.name}</div>

      {/* small "+" button (designer only) */}
      {showAdd && (
        <button
          className="absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-neutral-900/70 text-white backdrop-blur hover:bg-neutral-900/90 focus:outline-none focus:ring-2 focus:ring-white/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-auto"
          onClick={(e)=>{ e.stopPropagation(); setOpen(true); }}
          aria-label="Quick add to project"
          title="Quick add to project"
        >+</button>
      )}

      <QuickAddToRoom
        open={open}
        onOpenChange={setOpen}
        productId={product.id}
        eventId={eventId}
        subeventId={subeventId}
        userId={user?.id || "demo_user"}
      />
    </div>
  );
}