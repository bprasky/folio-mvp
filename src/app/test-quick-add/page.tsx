"use client";
import { FeaturedProductCard } from "@/components/events/FeaturedProductCard";

export default function TestQuickAddPage() {
  const mockProducts = [
    { id: "prod_1", name: "Terra Travertine Side Table", thumb: "/demo/terra1.jpg" },
    { id: "prod_2", name: "Oak Ribbon Chair", thumb: "/demo/rel3.jpg" },
    { id: "prod_3", name: "Calacatta Coffee Table", thumb: "/demo/rel2.jpg" },
  ];

  const mockUser = { id: "user_123", role: "designer" };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Quick Add Demo</h1>
      <p className="text-[var(--text-secondary)] mb-8">
        This page demonstrates the Designer Quick-Add feature. 
        Click the "+" button on any product to save it to a project and room.
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {mockProducts.map((product) => (
          <FeaturedProductCard
            key={product.id}
            product={product}
            user={mockUser}
            eventId="event_123"
            subeventId="subevent_456"
          />
        ))}
      </div>
    </div>
  );
}