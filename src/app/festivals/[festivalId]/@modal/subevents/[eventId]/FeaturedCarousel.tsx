"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { FeaturedProductCard } from "@/components/events/FeaturedProductCard";
import { Button } from "@/components/ui/button";

/**
 * FeaturedCarousel - Horizontal scrolling product carousel
 * Folio Design System: Uses ridge-style navigation buttons and accent accents
 */
export default function FeaturedCarousel({
  products,
  eventId,
  subeventId,
}: {
  products: Array<{
    id: string;
    title: string | null;
    imageUrl: string | null;
    brand?: string | null;
    slug?: string | null;
  }>;
  eventId?: string;
  subeventId?: string;
}) {
  const { data: session } = useSession();
  const ref = React.useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => ref.current?.scrollBy({ left: delta, behavior: "smooth" });

  if (!products?.length) return null;

  return (
    <div className="relative">
      <div className="hidden md:flex items-center justify-end mb-3 gap-2">
        <Button
          variant="ridge"
          size="sm"
          className="rounded-full bg-surface-canvas/20 border-[var(--bg-base)]/30 text-white hover:bg-surface-canvas/30"
          onClick={() => scrollBy(-360)}
        >
          ◀
        </Button>
        <Button
          variant="ridge"
          size="sm"
          className="rounded-full bg-surface-canvas/20 border-[var(--bg-base)]/30 text-white hover:bg-surface-canvas/30"
          onClick={() => scrollBy(360)}
        >
          ▶
        </Button>
      </div>

      <div ref={ref} className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        {products.map((p) => {
          // Convert to FeaturedProduct format
          const featuredProduct = {
            id: p.id,
            name: p.title || "Untitled product",
            thumb: p.imageUrl ?? '',
            vendor: {
              id: "unknown",
              name: p.brand || "Vendor",
              companyName: p.brand || null,
            },
            rank: 0,
          };

          return (
            <div key={p.id} className="snap-start shrink-0 w-[220px]">
              <FeaturedProductCard
                product={featuredProduct}
                user={session?.user}
                eventId={eventId}
                subeventId={subeventId}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}





